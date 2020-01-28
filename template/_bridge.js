/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies */
const url = require('url')
const http = require('http')
const getRawBody = require('raw-body')
const etag = require('etag')

class Bridge {
	constructor(httpListener) {
		this.rawServer = http.createServer(httpListener)
		this.socketPath = `/tmp/server-${Math.random().toString(36).substring(2, 15)}.sock`

		this.rawServer.listen(this.socketPath)
	}

	handle(ctx) {
		const requestOptions = {
			method: ctx.request.method,
			path: url.format({ pathname: ctx.request.path, query: ctx.request.queries }),
			headers: ctx.request.headers,
			socketPath: this.socketPath,
		}
		const reject = (error) => {
			if (!error) { return }
			console.error(error)
			ctx.response.setStatusCode(502)
			ctx.response.send(error.message)
		}
		const req = http.request(requestOptions, (response) => {
			getRawBody(response, (error, body) => {
				if (error) {
					reject(error)
					return
				}
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
			})
		})
		req.on('error', error => error && reject(error))

		// pipe body
		if (ctx.request.body) {
			req.write(ctx.request.body)
			req.end()
		} else {
			getRawBody(ctx.request, (error, body) => {
				if (error) {
					reject(error)
					return
				}
				req.write(body)
				req.end()
			})
		}
	}
}

module.exports = { Bridge }
