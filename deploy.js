#!/usr/bin/env node
const cp = require('child_process')
const fs = require('fs-extra')
const path = require('path')
const { Command } = require('commander')
const R = require('ramda')
const yaml = require('js-yaml')
const globby = require('globby')

const program = new Command()

program
	.option('-d, --debug', 'deploy and start locally. Docker is required.')
	.parse(process.argv)

const checkFile = (jsonFilePath, isWhat) => fs.existsSync(jsonFilePath) && fs.statSync(jsonFilePath)[isWhat]()
const tryToRequireJson = jsonFilePath => (checkFile(jsonFilePath, 'isFile') ? JSON.parse(fs.readFileSync(jsonFilePath)) : null)

const copyAllTo = (srcPath, dstPath, globList) => {
	const srcList = globby.sync(globList, { cwd: srcPath, dot: true })
	// console.debug('copy', srcList, 'to', dstPath)
	srcList.forEach((e) => {
		const src = path.join(srcPath, e)
		const dest = path.join(dstPath, e)
		fs.ensureDirSync(path.dirname(dest))
		fs.copySync(src, dest)
	})
}

const getConfig = () => {
	const dir = R.pathOr('', [0], program.args)
	const config = {
		name: path.basename(dir || __dirname),
		srcPath: dir || '.',
	}
	config.dstPath = path.join(config.srcPath, 'temp')

	// do some check
	if (!checkFile(config.srcPath, 'isDirectory')) {
		throw new Error(`${config.srcPath} is not a directory`)
	}

	// read package.json
	config.packageJson = tryToRequireJson(path.join(config.srcPath, 'package.json'))
	if (!config.packageJson) {
		throw new Error(`package.json not found in ${config.srcPath}`)
	}
	const staticOnly = !config.packageJson.main
	const additionDependencies = { '@webserverless/fc-express': '^0.1.1', 'serve-static': '^1.14.1', 'koa-static': '^5.0.0' }
	config.packageJson.dependencies = Object.assign(config.packageJson.dependencies, additionDependencies)
	config.packageJson.dependencies = config.packageJson.dependencies || ''
	Object.assign(config, R.pickAll(['name'], config.packageJson))
	config.env = config.packageJson.leafEnv || {}
	config.static = config.packageJson.leafStatic || (staticOnly ? ['.'] : [])

	// read leaf.json
	const configFile = tryToRequireJson(path.join(config.srcPath, 'leaf.json'))
	if (configFile) {
		Object.assign(config, R.pickBy(v => !!v, R.pickAll(['name', 'static', 'env'], configFile)))
	}

	// env
	Object.entries(config.env).forEach(([key, value]) => { config.env[key] = value === null ? process.env[key] : value })

	// fc
	config.functionName = config.name.split(/[^\w]+/g).join('-')
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
			Properties: { Description: config.packageJson.description },
			[config.functionName]: {
				Type: 'Aliyun::Serverless::Function',
				Properties: {
					Handler: '_index.handler',
					Runtime,
					CodeUri: './',
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
		[`${config.functionName}.leaf.dbjtech.com`]: {
			Type: 'Aliyun::Serverless::CustomDomain',
			Properties: {
				Protocol: 'HTTP',
				RouteConfig: { routes: { '/': { ServiceName: 'leaf', FunctionName: config.functionName } } },
			},
		},
	},
}

const templateFunfile = `
	RUNTIME ${Runtime}
	COPY ./package.json .
	RUN npm install
	${R.pathOr(false, ['packageJson', 'scripts', 'build'], config) ? 'RUN npm run build' : ''}
`.replace(/\n\t/g, '\n')

try {
	// copy src files
	copyAllTo(config.srcPath, config.dstPath, ['**/*', '!**/node_modules', '!temp'])

	// generate config
	copyAllTo(path.join(__dirname, 'template'), config.dstPath, ['**/*'])
	fs.writeFileSync(path.join(config.dstPath, 'template.yml'), yaml.safeDump(templateYML))
	fs.writeFileSync(path.join(config.dstPath, 'Funfile'), templateFunfile)
	fs.writeFileSync(path.join(config.dstPath, 'package.json'), JSON.stringify(config.packageJson, null, 2))
	fs.writeFileSync(path.join(config.dstPath, 'leaf.json'), JSON.stringify(R.pickAll(['name', 'static', 'env'], config), null, 2))

	const funOpts = { cwd: config.dstPath, stdio: 'inherit' }

	// local deploy
	cp.execSync('npx fun install', funOpts)
	if (program.debug) {
		cp.execSync('npx fun local start', funOpts)
	} else {
		cp.execSync('npx fun deploy', funOpts)
		fs.removeSync(config.dstPath)
	}
} catch (e) {
	console.error(e.message)
	// console.debug(e.stack)
}
