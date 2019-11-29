const { Server } = require('@webserverless/fc-express')
const serveExpress = require('serve-static')
const serveKoa = require('koa-static')
const compressKoa = require('koa-compress')
const config = require('./leaf.json')
const md = require('.')

let app = null
Object.entries(md).forEach(([key, value]) => {
	console.log(key, value)
	if (app) {
		return
	}
	if (key === 'expressApp' || value instanceof Function) {
		console.log('using', key, 'as express app instance')
		config.static.forEach(e => value.use(serveExpress(e)))
		app = value
	} else if (key === 'koaApp' || value.callback instanceof Function) {
		console.log('using', key, 'as koa app instance')
		config.static.reverse().forEach(e => value.middleware.unshift(serveKoa(e)))
		value.middleware.unshift(compressKoa())
		app = value.callback()
	}
})

if (!app) {
	throw new Error('http.Server/express/koa instance not found')
}

const server = new Server(app)
// fix bug of fc-express
server.httpTriggerProxy.forwardResponse = (function (response, resolver) {
	var _this = server.httpTriggerProxy
	var buf = []
	response
		.on('data', function (chunk) { return buf.push(chunk) })
		.on('end', function () {
		var bodyBuffer = Buffer.concat(buf)
		var statusCode = response.statusCode
		var headers = _this.getResponseHeaders(response)
		var contentType = _this.getContentType({ contentTypeHeader: headers['content-type'] })
		var isBase64Encoded = _this.isContentTypeBinaryMimeType({ contentType: contentType, binaryMimeTypes: _this.server.binaryTypes })
		var successResponse = { statusCode: statusCode, body: bodyBuffer, headers: headers, isBase64Encoded: isBase64Encoded }
		resolver(successResponse)
	})
})


module.exports.handler = (req, res, context) => {
	server.httpProxy(req, res, context)
}
