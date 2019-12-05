/* eslint-disable import/no-unresolved */
const http = require('http')
const serveKoa = require('koa-static')
const serveExpress = require('serve-static')
const { Server } = require('@webserverless/fc-express')
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


let app = null
const rawCreateServer = http.createServer
http.createServer = (...args) => {
	// eslint-disable-next-line prefer-destructuring
	app = args[0]
	if (app instanceof http.Server) {
		return app
	}
	if (app.listen instanceof Function) {
		console.log('using express app instance')
		config.static.forEach(e => app.use(serveExpress(e)))
	} else if (app instanceof Function && app.that) {
		console.log('using koa app instance')
		config.static.reverse().forEach(e => app.that.middleware.unshift(serveKoa(e)))
	}
	return rawCreateServer(...args)
}

// eslint-disable-next-line import/no-unresolved
require('.')

http.createServer = rawCreateServer

let server
function createProxyServer() {
	server = new Server(app)
	// fix bug of fc-express
	server.httpTriggerProxy.forwardResponse = ((response, resolver) => {
		const that = server.httpTriggerProxy
		const buf = []
		response
			.on('data', chunk => buf.push(chunk))
			.on('end', () => {
				const bodyBuffer = Buffer.concat(buf)
				const { statusCode } = response
				const headers = that.getResponseHeaders(response)
				const contentType = that.getContentType({ contentTypeHeader: headers['content-type'] })
				const isBase64Encoded = that.isContentTypeBinaryMimeType({ contentType, binaryMimeTypes: that.server.binaryTypes })
				const successResponse = { statusCode, body: bodyBuffer, headers, isBase64Encoded }
				resolver(successResponse)
			})
	})
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

module.exports.handler = (req, res, context) => {
	server.httpProxy(req, res, context)
}
