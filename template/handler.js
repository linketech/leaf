/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies, global-require */
const { promisify } = require('util')
const http = require('http')
const { Bridge, ensureBody } = require('./bridge')
const { handleEvent } = require('./timer')
const config = require('./leaf.json')

const sleep = promisify(setTimeout)
const maxAge = (process.env.STATIC_FILES_MAX_AGE || 0) * 1000

try {
	const app = require('express/lib/application.js')
	const serveExpress = require('serve-static')

	const rawExpressAppInit = app.init
	app.init = function init() {
		rawExpressAppInit.apply(this)
		config.static.forEach(e => this.use(serveExpress(e, { maxAge })))
	}
} catch (e) {
	// it's fine
}

try {
	const Koa = require('koa')
	const serveKoa = require('koa-static')

	const rawKoaCallback = Koa.prototype.callback
	Koa.prototype.callback = function callback() {
		config.static.forEach(e => this.use(serveKoa(e, { maxage: maxAge })))
		return rawKoaCallback.apply(this)
	}
} catch (e) {
	// it's fine
}


let httpListener = null
const rawCreateServer = http.createServer
http.createServer = (...args) => {
	// eslint-disable-next-line prefer-destructuring
	httpListener = args[0]
	return rawCreateServer(...args)
}

process.chdir('src')
require('.')


let bridge
function createProxyServer() {
	if (bridge) {
		return
	}
	if (!httpListener) {
		console.log('express/koa is not listening yet')
		setTimeout(createProxyServer, 2000)
		return
	}
	http.createServer = rawCreateServer
	bridge = new Bridge(httpListener)
}

createProxyServer()

async function httpHandler(request, response, context) {
	await ensureBody(request) // todo: can't getBody after sleep

	const expired = Date.now() + 30000
	while (!bridge && Date.now() < expired) {
		console.log('server is not ready')
		// eslint-disable-next-line no-await-in-loop
		await sleep(2000)
	}

	if (!bridge) {
		console.log('return server is not ready')
		response.send('server is not ready')
	} else {
		// console.log('server is ready')
		await bridge.handle({ request, response, context })
	}
}

module.exports.initializer = (context, callback) => {
	console.log('initializer', JSON.stringify(context.function))
	handleEvent('initializer', callback)
}

module.exports.httpHandler = (request, response, context) => {
	httpHandler(request, response, context).catch(e => response.send(e))
}

module.exports.timerHandler = (event, context, callback) => {
	const eventString = event.toString()
	const e = JSON.parse(eventString)
	console.log('timerHandler', eventString)
	handleEvent(e.triggerName, callback)
}
