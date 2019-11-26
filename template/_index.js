const http = require('http')
const { Server } = require('@webserverless/fc-express')
const md = require('.')

let app = null
Object.entries(md).forEach(([key, value]) => {
	console.log(key, value)
	if (app) {
		return
	}
	if (value instanceof http.Server) {
		app = value
	} else if (value instanceof Function) {
		app = value
	} else if (value.callback instanceof Function) {
		app = value.callback()
	}
	console.log('using', key, 'as server app instance')
})

if (!app) {
	throw new Error('http.Server/express/koa instance not found')
}
const server = new Server(app)
module.exports.handler = (req, res, context) => {
	server.httpProxy(req, res, context)
}
