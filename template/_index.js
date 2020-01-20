/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies */
const http = require('http')
const serveKoa = require('koa-static')
const serveExpress = require('serve-static')
const { Bridge } = require('./_bridge')
const config = require('./leaf.json')

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
	if (httpListener.listen instanceof Function) {
		console.log('using express app instance')
		app = httpListener
		config.static.forEach(e => app.use(serveExpress(e)))
	} else if (httpListener instanceof Function && httpListener.that) {
		console.log('using koa app instance')
		app = httpListener.that
		config.static.reverse().forEach(e => app.middleware.unshift(serveKoa(e)))
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
	http.createServer = rawCreateServer
	bridge = new Bridge(httpListener)
}

if (!app) {
	setTimeout(() => {
		if (!app) {
			throw new Error('express/koa not found')
		}
		createProxyServer()
	}, 2000)
} else {
	createProxyServer()
}

module.exports.handler = (request, response, context) => {
	bridge.handle({ request, response, context })
}
