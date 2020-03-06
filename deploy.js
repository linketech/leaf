#!/usr/bin/env node
const cp = require('child_process')
const fs = require('fs-extra')
const path = require('path')
const { Command } = require('commander')
const R = require('ramda')
const yaml = require('js-yaml')
const globby = require('globby')
const { getConfig, leafConfigFields } = require('./lib/config-loader')
const { ensureFCCustomDomains } = require('./lib/alicloud')

const program = new Command()

program
	.option('-d, --debug', 'Deploy and start locally. Docker is required.')
	.option('-b, --build', 'Use docker to install deps.')
	.parse(process.argv)

const copyAllTo = (srcPath, dstPath, globList, opts) => {
	const srcList = globby.sync(globList, { ...opts, cwd: srcPath })
	// console.debug('copy', srcList, 'to', dstPath)
	srcList.forEach((e) => {
		const src = path.join(srcPath, e)
		const dest = path.join(dstPath, e)
		fs.ensureDirSync(path.dirname(dest))
		fs.copySync(src, dest)
	})
}

const config = getConfig(program.args[0])
console.log('deploy function', config.name)

const Runtime = 'nodejs10'
const templateYML = {
	ROSTemplateFormatVersion: '2015-09-01',
	Transform: 'Aliyun::Serverless-2018-04-03',
	Resources: {
		[config.serviceName]: {
			Type: 'Aliyun::Serverless::Service',
			Properties: {
				Description: config.description,
				LogConfig: {
					Project: config.logProjectName,
					Logstore: config.logStoreName,
				},
			},
			[config.functionName]: {
				Type: 'Aliyun::Serverless::Function',
				Properties: {
					Handler: '_index.handler',
					Runtime,
					CodeUri: './',
					MemorySize: config.serverless.memory,
					Timeout: config.serverless.timeout,
					EnvironmentVariables: config.env,
					InstanceConcurrency: 100,
				},
				Events: {
					httpTrigger: {
						Type: 'HTTP',
						Properties: { AuthType: 'ANONYMOUS', Methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'] },
					},
				},
			},
		},
		[config.domain]: {
			Type: 'Aliyun::Serverless::CustomDomain',
			Properties: {
				Protocol: 'HTTP',
				RouteConfig: { routes: { '/*': { ServiceName: config.serviceName, FunctionName: config.functionName } } },
			},
		},
		[config.logProjectName]: {
			Type: 'Aliyun::Serverless::Log',
			Properties: {
				Description: `log project for ${config.domain}`,
			},
			[config.logStoreName]: {
				Type: 'Aliyun::Serverless::Log::Logstore',
				Properties: {
					TTL: config.serverless.logTTL,
					ShardCount: 1,
				},
			},
		},
	},
}

const templateDockerfile = `
	FROM aliyunfc/runtime-nodejs10:build
	COPY ./package.json .
	RUN npx tyarn install --production
	${config.build ? `RUN ${config.build}` : ''}
`.replace(/\n\t/g, '\n')

async function main() {
	// generate config
	console.debug('generating config files')
	copyAllTo(path.join(__dirname, 'template'), config.dstPath, ['**/*'], { dot: true })
	if (!program.debug) {
		// 本地运行的时候不知为何访问静态资源文件会触发文件改动，导致容器hot reload引起出错。
		// 这里让.funignore忽略所有文件，忽略文件改动。deploy到云端不受影响
		copyAllTo(path.join(__dirname, 'template.prod'), config.dstPath, ['**/*'], { dot: true })
	}
	fs.writeFileSync(path.join(config.dstPath, 'package.json'), JSON.stringify(config.packageJson, null, 2))
	fs.writeFileSync(path.join(config.dstPath, 'leaf.json'), JSON.stringify(R.pickAll(leafConfigFields, config), null, 2))
	fs.writeFileSync(path.join(config.dstPath, 'template.yml'), yaml.safeDump(templateYML))

	if (program.build) {
		fs.writeFileSync(path.join(config.dstPath, 'Dockerfile'), templateDockerfile)
	}

	// copy src files
	console.debug('copying file to', config.dstCodePath)
	copyAllTo(config.srcPath, config.dstCodePath, ['**/*', '!**/node_modules', '!.leaf'], { dot: true, ignore: config.ignoreList })

	// local deploy
	console.debug('building')
	const funOpts = { cwd: config.dstPath, stdio: 'inherit' }
	if (program.build) {
		const tag = `leaf-build-cache-${Date.now()}`
		cp.execSync(`docker build . -t ${tag}`, funOpts)
		cp.execSync(`docker create -it --name ${tag} ${tag} bash`, funOpts)
		cp.execSync(`docker cp ${tag}:/code/node_modules .`, funOpts)
		cp.execSync(`docker rm -f ${tag}`, funOpts)
	} else {
		cp.execSync('npm install --production', funOpts)
	}

	await ensureFCCustomDomains(config.domain)
	if (program.debug) {
		cp.execSync(`npx @alicloud/fun local start ${config.domain}`, funOpts)
	} else {
		cp.execSync('npx @alicloud/fun deploy -y', funOpts)
		fs.removeSync(config.dstPath)
		console.log(`https://${config.domain} deploy success.`)
	}
}

main().catch((e) => {
	console.error(e.message)
	console.debug(e.stack)
})
