/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved */
const Koa = require('koa')
const request = require('request')

const app = new Koa()
const port = 8080

if (JSON.parse(process.env.PROXY_404_TO_ROOT || false)) {
	app.use(async (ctx, next) => {
		console.log(ctx.ip, ctx.method, ctx.url)
		if (ctx.url === '/') {
			ctx.status = 404
			return
		}
		if (ctx.method === 'GET' && ctx.status === 404) {
			console.debug('Redirect to root')
			ctx.body = request(`http://localhost:${port}/`)
			return
		}
		await next()
	})
}

app.listen(port, () => console.log('Server start'))
