/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies */
const url = require('url')
const http = require('http')
const getRawBody = require('raw-body')
const etag = require('etag')

function getRawBodyAsync(stream) {
	return new Promise((resolve, reject) => {
		getRawBody(stream, (error, body) => {
			if (error) {
				reject(error)
				return
			}
			resolve(body)
		})
	})
}

async function ensureBody(request) {
	request.body = request.body || await getRawBodyAsync(request)
}

function httpRequest(requestOptions, body) {
	return new Promise((resolve, reject) => {
		const req = http.request(requestOptions, resolve)
		req.on('error', error => error && reject(error))
		req.write(body)
		req.end()
	})
}

async function handle(ctx, port) {
	try {
		const requestOptions = {
			method: ctx.request.method,
			path: url.format({ pathname: ctx.request.path, query: ctx.request.queries }),
			headers: ctx.request.headers,
			port,
			// socketPath: this.socketPath,
		}
		const response = await httpRequest(requestOptions, ctx.request.body)
		const body = await getRawBodyAsync(response)

		const { statusCode, headers } = response
		let theStatusCode = statusCode
		let theBody = body
		Object.entries(headers).forEach(([k, v]) => ctx.response.setHeader(k, v))
		if (ctx.request.method === 'GET' && statusCode === 200) {
			// reset headers and body
			if (!ctx.response.headers['cache-control']) {
				ctx.response.setHeader('cache-control', 'no-cache')
			}
			if (!ctx.response.headers.etag) {
				const hash = etag(body)
				ctx.response.setHeader('etag', hash)
			} else if (ctx.request.headers['if-none-match'] === ctx.response.headers.etag) {
				theStatusCode = 304
				theBody = ''
			}
		}
		ctx.response.setStatusCode(theStatusCode)
		ctx.response.send(theBody)
	} catch (e) {
		console.error(e)
		ctx.response.setStatusCode(502)
		ctx.response.send(e.message)
	}
}

class Bridge {
	static get DefaultPort() { return 60080 }

	constructor(httpListener, listeningPort) {
		this.rawServer = http.createServer(httpListener)
		// this.socketPath = `/tmp/server-${Math.random().toString(36).substring(2, 15)}.sock`
		this.listeningPort = listeningPort
		console.log('bridge listen', this.listeningPort)
		this.rawServer.listen(this.listeningPort).once('error', (e) => {
			if (e.message.indexOf('EACCES') !== -1 || e.message.indexOf('EADDRINUSE') !== -1) {
				this.listeningPort = Bridge.DefaultPort
				console.log(e.message)
				console.log(`Port ${listeningPort} is not available, use the default port ${this.listeningPort} instead.`)
				this.rawServer.listen(this.listeningPort)
			} else {
				throw e
			}
		})
	}

	get RootUrl() {
		return `http://localhost:${this.listeningPort}`
	}

	handle(ctx) {
		return handle(ctx, this.listeningPort)
	}
}

module.exports = { Bridge, ensureBody }
