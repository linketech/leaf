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
	config.packageJson.dependencies = Object.assign(config.packageJson.dependencies, { '@webserverless/fc-express': '^0.1.1' })
	config.packageJson.dependencies = config.packageJson.dependencies || ''
	Object.assign(config, R.pickAll(['name'], config.packageJson))

	// read leaf.json
	const configFile = tryToRequireJson(path.join(config.srcPath, 'leaf.json'))
	if (configFile) {
		Object.assign(config, R.pickAll(['name'], configFile))
	}

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
				Properties: { Handler: '_index.handler', Runtime, CodeUri: './' },
				Events: {
					httpTrigger: {
						Type: 'HTTP',
						Properties: { AuthType: 'ANONYMOUS', Methods: ['POST', 'GET'] },
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

const templateFunfile = `RUNTIME ${Runtime}`

const templateIndexHandler = fs.readFileSync(path.join(__dirname, 'template/index.js'))

// copy src files
const srcList = globby.sync(['**/*', '!**/node_modules', '!temp'], { cwd: config.srcPath })
// console.log('copy', srcList, 'to', config.dstPath)
srcList.forEach((e) => {
	const src = path.join(config.srcPath, e)
	const dest = path.join(config.dstPath, e)
	fs.ensureDirSync(path.dirname(dest))
	fs.copySync(src, dest)
})

// generate config
fs.writeFileSync(path.join(config.dstPath, 'template.yml'), yaml.safeDump(templateYML))
fs.writeFileSync(path.join(config.dstPath, 'Funfile'), templateFunfile)
fs.writeFileSync(path.join(config.dstPath, '_index.js'), templateIndexHandler)
fs.writeFileSync(path.join(config.dstPath, 'package.json'), JSON.stringify(config.packageJson, null, 2))

// local deploy
const funOpts = { cwd: config.dstPath, stdio: 'inherit' }
cp.execSync('npx fun install', funOpts)
if (program.debug) {
	cp.execSync('npx fun local start', funOpts)
} else {
	cp.execSync('npx fun deploy', funOpts)
	fs.removeSync(config.dstPath)
}
