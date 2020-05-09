/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies, global-require */
const { promisify } = require('util')
const http = require('http')
const httpRequest = require('request')
const { Bridge, ensureBody, ListeningPort } = require('./bridge')
const config = require('./leaf.json')

const sleep = promisify(setTimeout)
const maxAge = (process.env.STATIC_FILES_MAX_AGE || 0) * 1000


let expressApp = null
try {
	const app = require('express/lib/application.js')
	const serveExpress = require('serve-static')

	const rawExpressAppInit = app.init
	app.init = function init() {
		expressApp = this
		rawExpressAppInit.apply(this)
		config.static.forEach(e => this.use(serveExpress(e, { maxAge })))
	}
} catch (e) {
	// it's fine
}

let koaApp = null
try {
	const Koa = require('koa')
	const serveKoa = require('koa-static')

	const rawKoaCallback = Koa.prototype.callback
	Koa.prototype.callback = function callback() {
		koaApp = this
		config.static.forEach(e => this.use(serveKoa(e, { maxage: maxAge })))
		return rawKoaCallback.apply(this)
	}
} catch (e) {
	// it's fine
}

function initTailMiddleware() {
	const proxy404ToRoot = JSON.parse(process.env.PROXY_404_TO_ROOT || false)
	const rootUrl = `http://localhost:${ListeningPort}/`
	if (!proxy404ToRoot) {
		return
	}

	if (expressApp) {
		console.log('init express tail middleware')
		expressApp.use((req, res, next) => {
			console.log(req.ip, req.method, req.url, 'no route is matched')
			if (req.method.toUpperCase() !== 'GET') {
				next()
				return
			}
			if (req.url === '/') {
				res.status(404)
				next()
				return
			}
			console.debug('Redirect to root')
			httpRequest(rootUrl).pipe(res)
		})
	}

	if (koaApp) {
		koaApp.use(async (ctx, next) => {
			console.log(ctx.ip, ctx.method, ctx.url, 'no route is matched')
			if (ctx.method.toUpperCase() !== 'GET') {
				await next()
				return
			}
			if (ctx.url === '/') {
				ctx.status = 404
				await next()
				return
			}
			if (ctx.status === 404) {
				console.debug('Redirect to root')
				ctx.body = httpRequest(rootUrl)
			}
			next()
		})
	}
}

let bridge = null
const rawCreateServer = http.createServer
http.createServer = (...args) => {
	initTailMiddleware()
	http.createServer = rawCreateServer
	bridge = new Bridge(args[0])
	return { listen: (...p) => console.debug('disable listen call', p) }
}

async function getBridge(expired = Date.now() + 30000) {
	while (!bridge && Date.now() < expired) {
		console.debug('express/koa is not listening yet')
		// eslint-disable-next-line no-await-in-loop
		await sleep(2000)
	}
	return bridge
}

async function httpHandler(request, response, context) {
	await ensureBody(request) // todo: can't getBody after sleep

	bridge = bridge || await getBridge()
	if (!bridge) {
		console.debug('return server is not ready')
		response.send('server is not ready')
	} else {
		// console.debug('server is ready')
		await bridge.handle({ request, response, context })
	}
}

module.exports = { httpHandler }
