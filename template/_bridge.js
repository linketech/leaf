/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies */
const url = require('url')
const http = require('http')
const getRawBody = require('raw-body')

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

				Object.entries(headers).forEach(([k, v]) => ctx.response.setHeader(k, v))
				ctx.response.setStatusCode(statusCode)
				ctx.response.send(body)
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
