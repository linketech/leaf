const fs = require('fs-extra')
const path = require('path')
const R = require('ramda')
const { getProfileFromFile } = require('@alicloud/fun/lib/profile')
require('./update-notifier')

const checkFile = (filePath, isWhat) => fs.existsSync(filePath) && fs.statSync(filePath)[isWhat]()
const tryToRequire = (filePath, defaultValue = null) => (checkFile(filePath, 'isFile') ? fs.readFileSync(filePath, { encoding: 'utf8' }) : defaultValue)
const tryToRequireJson = jsonFilePath => JSON.parse(tryToRequire(jsonFilePath, '{}'))
const jsonRequirer = srcPath => file => tryToRequireJson(path.join(srcPath, file))
const pickAllWithValule = (fields, obj) => R.pickBy(v => v !== undefined, R.pickAll(fields, obj))

const leafConfigFields = ['name', 'description', 'server', 'domain', 'static', 'env', 'build', 'serverless', 'timer', 'vpc']

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

async function getConfig(dir, checkSrcPath = true) {
	const aliProfile = await getProfileFromFile()
	if (!aliProfile.accountId) {
		throw new Error('Please run "leaf config" first.')
	}
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
		timer: {},
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
	if (!packageJson4Server.main) {
		config.static = ['.']
		packageJson4Server = {
			main: '../dummy-server.js',
			dependencies: { koa: '^2.11.0' },
		}
	}
	const additionDependencies = {
		'raw-body': '^2.4.1',
		request: '^2.88.0',
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

	// env
	Object.entries(config.env).forEach(([key, value]) => {
		config.env[key] = value === null ? process.env[key] || '' : value
		if (!config.env[key]) {
			delete config.env[key]
		}
	})

	// fc
	config.serviceName = config.name.split(/[^\w]+/g).join('-')
	config.domain = config.domain || `${config.serviceName}.leaf.linketech.cn`
	config.httpTriggerName = `${config.serviceName}Http`
	config.timerTriggerName = `${config.serviceName}Timer`
	config.logProjectName = aliProfile.accountId === '1611598131644746' ? 'log-project-for-leaf' : `leaf-log-for-${aliProfile.accountId}`
	config.logStoreName = 'log-store-for-leaf'

	const { memory = 256, timeout = 60, logTTL = 180 } = config.serverless || {}
	config.serverless = { memory, timeout, logTTL }
	return config
}

module.exports = { getConfig, leafConfigFields }
