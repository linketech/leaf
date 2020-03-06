/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies */
const { promisify } = require('util')
const http = require('http')
const serveKoa = require('koa-static')
const serveExpress = require('serve-static')
const { Bridge, ensureBody } = require('./_bridge')
const config = require('./leaf.json')

const sleep = promisify(setTimeout)

try {
	// eslint-disable-next-line global-require
	const Koa = require('koa')

	const rawKoaCallback = Koa.prototype.callback
	Koa.prototype.callback = function callback() {
		const cb = rawKoaCallback.apply(this)
		cb.that = this // hack koa to return the app instance
		return cb
	}
} catch (e) {
	// it's fine
}


let httpListener = null
let app = null
const rawCreateServer = http.createServer
http.createServer = (...args) => {
	// eslint-disable-next-line prefer-destructuring
	httpListener = args[0]
	// console.log(config)
	const maxAge = (process.env.STATIC_FILES_MAX_AGE || 0) * 1000
	if (httpListener.listen instanceof Function) {
		console.log('using express app instance')
		app = httpListener
		config.static.forEach(e => app.use(serveExpress(e, { maxAge })))
	} else if (httpListener instanceof Function && httpListener.that) {
		console.log('using koa app instance')
		app = httpListener.that
		config.static.reverse().forEach(e => app.middleware.unshift(serveKoa(e, { maxage: maxAge })))
	} else {
		throw new Error('unknow object of http.createServer')
	}
	return rawCreateServer(...args)
}

process.chdir('src')
// eslint-disable-next-line import/no-unresolved
require('.')


let bridge
function createProxyServer() {
	if (bridge) {
		return
	}
	if (!app) {
		console.log('express/koa is not listening yet')
		setTimeout(createProxyServer, 2000)
		return
	}
	http.createServer = rawCreateServer
	bridge = new Bridge(httpListener)
}

createProxyServer()

async function handler(request, response, context) {
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

module.exports.handler = (request, response, context) => {
	handler(request, response, context).catch(e => response.send(e))
}
