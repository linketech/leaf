#!/usr/bin/env node
const cp = require('child_process')
const fs = require('fs-extra')
const path = require('path')
const { Command } = require('commander')
const R = require('ramda')
const yaml = require('js-yaml')
const globby = require('globby')
const { ensureFCCustomDomains } = require('./lib/alicloud')

const program = new Command()

program
	.option('-d, --debug', 'deploy and start locally. Docker is required.')
	.parse(process.argv)

const checkFile = (filePath, isWhat) => fs.existsSync(filePath) && fs.statSync(filePath)[isWhat]()
const tryToRequire = (filePath, defaultValue = null) => (checkFile(filePath, 'isFile') ? fs.readFileSync(filePath, { encoding: 'utf8' }) : defaultValue)
const tryToRequireJson = jsonFilePath => JSON.parse(tryToRequire(jsonFilePath, '{}'))
const jsonRequirer = srcPath => file => tryToRequireJson(path.join(srcPath, file))
const pickAllWithValule = (fields, obj) => R.pickBy(v => v !== undefined, R.pickAll(fields, obj))

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

const leafConfigFields = ['name', 'description', 'server', 'static', 'env', 'build']

// extract fields of name, desc, leafXXX
function getLeafConfigFromPackageJson(packageJson) {
	const leafConfig = R.pickAll(['name', 'description'], packageJson)
	Object.entries(packageJson).forEach(([k, v]) => {
		const field = R.pathOr(null, [1], /^leaf([A-Z][\w]*)$/.exec(k))
		if (field) {
			leafConfig[field.toLowerCase()] = v
		}
	})
	return leafConfig
}

const getConfig = () => {
	const dir = R.pathOr('', [0], program.args)
	const srcPath = dir || '.'
	const requireJson = jsonRequirer(srcPath)

	// do some check
	if (!checkFile(srcPath, 'isDirectory')) {
		throw new Error(`${srcPath} is not a directory`)
	}

	// .leafignore
	const ignoreList = tryToRequire(path.join(srcPath, '.leafignore'), '').split(/\r?\n/).filter(e => !!e)

	// read package.json and leaf.json and merge
	const packageJson = requireJson('package.json')
	const packageJson4LeafConfig = getLeafConfigFromPackageJson(packageJson)
	const leafJson = requireJson('leaf.json')
	const config = {
		// default value
		name: path.basename(dir || process.cwd()),
		description: '',
		server: '.',
		static: [],
		env: {},
		build: R.pathOr('', ['scripts', 'build'], packageJson),
		// overwrite
		...pickAllWithValule(leafConfigFields, packageJson4LeafConfig),
		...pickAllWithValule(leafConfigFields, leafJson),
		// fields can not be overwrited
		srcPath,
		dstPath: path.join(srcPath, '_temp'),
		dstCodePath: path.join(srcPath, '_temp', 'src'),
		ignoreList,
	}
	// read server package.json
	let packageJson4Server = requireJson(path.join(config.server, 'package.json'))
	if (R.isEmpty(packageJson4Server)) {
		// throw new Error(`package.json not found in ${config.server}. Please check the leaf config of "server".`)
		config.static = ['.']
		packageJson4Server = {
			main: '../_static-http-server.js',
			dependencies: { koa: '^2.11.0' },
		}
	}
	const additionDependencies = {
		'raw-body': '^2.4.1',
		'koa-static': '^5.0.0',
		'serve-static': '^1.14.1',
	}
	packageJson4Server.dependencies = Object.assign(packageJson4Server.dependencies || {}, additionDependencies)
	if (packageJson4Server.main) {
		packageJson4Server.main = path.join(config.server, 'src', packageJson4Server.main).replace(/\\/g, '/')
	}

	// package.json for generate
	config.packageJson = packageJson4Server

	// static
	config.static = config.static || []

	// env
	Object.entries(config.env).forEach(([key, value]) => { config.env[key] = value === null && process.env[key] ? process.env[key] : value })

	// fc
	config.functionName = config.name.split(/[^\w]+/g).join('-')
	config.domain = `${config.functionName}.leaf.linketech.cn`
	return config
}

const config = getConfig()
console.log('deploy function', config.name)

const Runtime = 'nodejs10'
const templateYML = {
	ROSTemplateFormatVersion: '2015-09-01',
	Transform: 'Aliyun::Serverless-2018-04-03',
	Resources: {
		leaf: {
			Type: 'Aliyun::Serverless::Service',
			Properties: { Description: config.description },
			[config.functionName]: {
				Type: 'Aliyun::Serverless::Function',
				Properties: {
					Handler: '_index.handler',
					Runtime,
					CodeUri: './',
					MemorySize: 256,
					Timeout: 60,
					EnvironmentVariables: config.env,
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
				RouteConfig: { routes: { '/*': { ServiceName: 'leaf', FunctionName: config.functionName } } },
			},
		},
	},
}

const templateFunfile = `
	RUNTIME ${Runtime}
	COPY ./package.json .
	RUN npm install --production --registry https://registry.npm.taobao.org
	${config.build ? 'RUN npm run build' : ''}
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

	if (config.build) {
		fs.writeFileSync(path.join(config.dstPath, 'Funfile'), templateFunfile)
	}

	// copy src files
	console.debug('copying file to', config.dstCodePath)
	copyAllTo(config.srcPath, config.dstCodePath, ['**/*', '!**/node_modules', '!_temp'], { ignore: config.ignoreList })

	// local deploy
	console.debug('building')
	const funOpts = { cwd: config.dstPath, stdio: 'inherit' }
	if (config.build) {
		cp.execSync('npx fun install', funOpts)
	} else {
		cp.execSync('npm install --production --registry https://registry.npm.taobao.org', funOpts)
	}

	await ensureFCCustomDomains(config.domain)
	if (program.debug) {
		cp.execSync(`npx fun local start ${config.domain}`, funOpts)
	} else {
		cp.execSync('npx fun deploy', funOpts)
		fs.removeSync(config.dstPath)
	}
}

main().catch((e) => {
	console.error(e.message)
	console.debug(e.stack)
})
