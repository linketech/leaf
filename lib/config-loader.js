const fs = require('fs-extra')
const path = require('path')
const R = require('ramda')

const checkFile = (filePath, isWhat) => fs.existsSync(filePath) && fs.statSync(filePath)[isWhat]()
const tryToRequire = (filePath, defaultValue = null) => (checkFile(filePath, 'isFile') ? fs.readFileSync(filePath, { encoding: 'utf8' }) : defaultValue)
const tryToRequireJson = jsonFilePath => JSON.parse(tryToRequire(jsonFilePath, '{}'))
const jsonRequirer = srcPath => file => tryToRequireJson(path.join(srcPath, file))
const pickAllWithValule = (fields, obj) => R.pickBy(v => v !== undefined, R.pickAll(fields, obj))
const format = string => string.replace(/\./g, '-')

const leafConfigFields = ['name', 'description', 'server', 'domain', 'static', 'env', 'build', 'serverless', 'vpc']

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

const getConfig = (dir, checkSrcPath = true) => {
	const srcPath = dir || '.'
	const requireJson = jsonRequirer(srcPath)

	// do some check
	if (checkSrcPath && !checkFile(srcPath, 'isDirectory')) {
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
		dstPath: path.join(srcPath, '.leaf'),
		dstCodePath: path.join(srcPath, '.leaf', 'src'),
		ignoreList,
	}
	// read server package.json
	let packageJson4Server = requireJson(path.join(config.server, 'package.json'))
	if (R.isEmpty(packageJson4Server)) {
		// throw new Error(`package.json not found in ${config.server}. Please check the leaf config of "server".`)
		config.static = ['.']
		packageJson4Server = {
			main: '../_static-http-server.js',
			dependencies: { koa: '^2.11.0', request: '^2.88.0' },
		}
	}
	const additionDependencies = {
		'raw-body': '^2.4.1',
		'koa-static': '^5.0.0',
		etag: '^1.8.1',
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
	Object.entries(config.env).forEach(([key, value]) => {
		config.env[key] = value === null ? process.env[key] || '' : value
		if (!config.env[key]) {
			delete config.env[key]
		}
	})

	// fc
	config.functionName = config.name.split(/[^\w]+/g).join('-')
	config.domain = config.domain || `${config.functionName}.leaf.linketech.cn`
	config.serviceName = config.functionName
	config.logProjectName = format(`log-project.${config.domain}`)
	config.logStoreName = format(`log-store.${config.domain}`)

	const { memory = 256, timeout = 60, logTTL = 180 } = config.serverless || {}
	config.serverless = { memory, timeout, logTTL }
	return config
}

module.exports = { getConfig, leafConfigFields }
