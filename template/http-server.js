/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies, global-require */
const { promisify } = require('util')
const http = require('http')
const httpRequest = require('request')
const { Bridge, handleHttp } = require('./bridge')
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
		config.static.forEach((e) => this.use(serveExpress(e, { maxAge })))
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
		config.static.reverse().forEach((e) => this.middleware.unshift(serveKoa(e, { maxage: maxAge })))
		return rawKoaCallback.apply(this)
	}
} catch (e) {
	// it's fine
}

function initTailMiddleware() {
	const proxy404ToRoot = JSON.parse(process.env.PROXY_404_TO_ROOT || false)
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
			if (req.url === '/' || /\.\w+$/.test(req.url)) {
				res.status(404)
				next()
				return
			}
			console.debug('Redirect to root')
			httpRequest(Bridge.Instance.RootUrl).pipe(res)
		})
	}

	if (koaApp) {
		koaApp.use(async (ctx, next) => {
			console.log(ctx.ip, ctx.method, ctx.url, 'no route is matched')
			if (ctx.method.toUpperCase() !== 'GET') {
				await next()
				return
			}
			if (ctx.url === '/' || /\.\w+$/.test(ctx.url)) {
				ctx.status = 404
				await next()
				return
			}
			if (ctx.status === 404) {
				console.debug('Redirect to root')
				ctx.body = httpRequest(Bridge.Instance.RootUrl)
			}
			next()
		})
	}
}

const rawCreateServer = http.createServer
http.createServer = (...args) => {
	initTailMiddleware()
	http.createServer = rawCreateServer
	return {
		listen: (...p) => {
			Bridge.Init(args[0], p[0])
			console.debug('disable listen call', p)
		},
	}
}

process.emit('registerEvent', 'initializer', async () => {
	const expired = Date.now() + 30000
	while (!Bridge.IsInit && Date.now() < expired) {
		console.debug('express/koa is not listening yet')
		// eslint-disable-next-line no-await-in-loop
		await sleep(2000)
	}
	if (!Bridge.IsInit) {
		throw new Error('express/koa instance not found')
	}
})

async function httpHandler(request, response, context) {
	if (!Bridge.IsInit) {
		console.debug('return server is not ready')
		response.send('server is not ready')
	} else {
		// console.debug('server is ready')
		await handleHttp({ request, response, context })
	}
}

module.exports = { httpHandler }
