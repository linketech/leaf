const { Server } = require('@webserverless/fc-express')
const serveExpress = require('serve-static')
const serveKoa = require('koa-static')
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
		app = value
		config.static.forEach(e => value.use(serveExpress(e)))
	} else if (key === 'koaApp' || value.callback instanceof Function) {
		console.log('using', key, 'as koa app instance')
		app = value.callback()
		config.static.forEach(e => value.use(serveKoa(e)))
	}
})

if (!app) {
	throw new Error('http.Server/express/koa instance not found')
}

const server = new Server(app)
module.exports.handler = (req, res, context) => {
	server.httpProxy(req, res, context)
}
