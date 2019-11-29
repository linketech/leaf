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

const checkFile = (filePath, isWhat) => fs.existsSync(filePath) && fs.statSync(filePath)[isWhat]()
const tryToRequire = (filePath, defaultValue = null) => (checkFile(filePath, 'isFile') ? fs.readFileSync(filePath, { encoding: 'utf8' }) : defaultValue)
const tryToRequireJson = jsonFilePath => JSON.parse(tryToRequire(jsonFilePath, '{}'))
const jsonRequirer = srcPath => file => tryToRequireJson(path.join(srcPath, file))
const pickAllWithValule = (fields, obj) => R.pickBy(v => !!v, R.pickAll(fields, obj))

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

const leafConfigFields = ['name', 'description', 'server', 'static', 'env']

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

function tryToHackIndexJs(content) {
	if (!/app\s*=\s*[Ee]xpress\(\)/g.test(content) && !/app\s*=\s*new\s+[Kk]oa\(\)/g.test(content)) {
		return content
	}
	return `${content}\nmodule.exports = { app }\n`
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
	const packageJson4LeafConfig = getLeafConfigFromPackageJson(requireJson('package.json'))
	const leafJson = requireJson('leaf.json')
	const config = {
		// default value
		name: path.basename(dir || __dirname),
		description: '',
		server: '.',
		static: [],
		env: {},
		build: R.pathOr('', ['scripts', 'build'], packageJson4LeafConfig),
		// overwrite
		...pickAllWithValule(leafConfigFields, packageJson4LeafConfig),
		...pickAllWithValule(leafConfigFields, leafJson),
		// fields can not be overwrited
		srcPath,
		dstPath: path.join(srcPath, 'temp'),
		ignoreList,
	}
	// read server package.json
	const packageJson4Server = requireJson(path.join(config.server, 'package.json'))
	if (R.isEmpty(packageJson4Server)) {
		throw new Error(`package.json not found in ${config.server}. Please check the leaf config of "server".`)
	}
	const additionDependencies = { '@webserverless/fc-express': '^0.1.1', 'serve-static': '^1.14.1', 'koa-static': '^5.0.0' }
	packageJson4Server.dependencies = Object.assign(packageJson4Server.dependencies || {}, additionDependencies)
	const staticOnly = !packageJson4Server.main
	if (!staticOnly) {
		packageJson4Server.main = path.join(config.server, packageJson4Server.main).replace(/\\/g, '/')
	}

	// package.json for generate
	config.packageJson = packageJson4Server

	// static
	config.static = config.static || (staticOnly ? ['.'] : [])

	// env
	Object.entries(config.env).forEach(([key, value]) => { config.env[key] = value === null && process.env[key] ? process.env[key] : value })

	// fc
	config.functionName = config.name.split(/[^\w]+/g).join('-')
	config.domain = `${config.functionName}.leaf.dbjtech.com`
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

try {
	// copy src files
	console.debug('copying file to', config.dstPath)
	copyAllTo(config.srcPath, config.dstPath, ['**/*', '!**/node_modules', '!temp'], { ignore: config.ignoreList })

	// generate config
	console.debug('generating config files')
	copyAllTo(path.join(__dirname, 'template'), config.dstPath, ['**/*'], { dot: true })
	fs.writeFileSync(path.join(config.dstPath, 'Funfile'), templateFunfile)
	fs.writeFileSync(path.join(config.dstPath, 'package.json'), JSON.stringify(config.packageJson, null, 2))
	fs.writeFileSync(path.join(config.dstPath, 'leaf.json'), JSON.stringify(R.pickAll(leafConfigFields, config), null, 2))
	// console.debug(JSON.stringify(templateYML, null, 2))
	fs.writeFileSync(path.join(config.dstPath, 'template.yml'), yaml.safeDump(templateYML))

	if (config.packageJson.main) {
		const indexJsPath = path.join(config.dstPath, config.packageJson.main)
		console.log('inspecting', indexJsPath)
		fs.writeFileSync(indexJsPath, tryToHackIndexJs(tryToRequire(indexJsPath)))
	}

	// local deploy
	console.debug('building')
	const funOpts = { cwd: config.dstPath, stdio: 'inherit' }
	cp.execSync('npx fun install', funOpts)
	if (program.debug) {
		cp.execSync(`npx fun local start ${config.domain}`, funOpts)
	} else {
		cp.execSync('npx fun deploy', funOpts)
		fs.removeSync(config.dstPath)
	}
} catch (e) {
	console.error(e.message)
	console.debug(e.stack)
}
