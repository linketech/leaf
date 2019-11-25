const url = require('url')
const dns = require('dns')
const util = require('util')
const _ = require('lodash')
const request = require('request-promise')
require('request')

const Koa = require('koa')
const Router = require('koa-router')
const koaBody = require('koa-body')

const resolve = util.promisify(dns.resolve)

const app = new Koa()
const router = new Router()

const indexHtml = _.template(`
<!DOCTYPE html>
<html>
<head>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.1.2/dist/css/bootstrap.min.css">
</head>
<body style="color: gray; font-size: 1.2em;">
	<div class="container" style="margin:50px auto;">
		<div class="row" style="font-family: Segoe UI Emoji; font-size: 3.5em; color: transparent; text-shadow: 0 0 0 lightblue;">
			<span style="margin: 30px auto;">🚧 True DNS</span>
		</div>
		<form action="/" method="POST" class="form">
			<div class="form-group">
				<div class="input-group">
					<input type="text" name="uri" placeholder="A Blocked URL" class="form-control">
					<div class="input-group-append">
						<input type="submit" value="Submit" class="btn btn-primary">
					</div>
				</div>
			</div>
			<div class="form-group">
				<label for="ta">To unblock the url, append the following IP(s) to your host file.</label>
				<textarea class="form-control" id="ta" rows="10"><%=output%></textarea>
			</div>
		</form>
	</div>
</body>
</html>
`)

router.get('/', async (ctx) => {
	ctx.body = indexHtml({ output: '' })
})

router.post('/', async (ctx) => {
	const urlRegex = /https?:\/\/([\w-_]+\.?)+/g
	const { uri } = ctx.request.body
	console.log(`parsing ${uri}`)

	if (!urlRegex.test(uri)) {
		ctx.body = indexHtml({ output: 'Invalid uri' })
		return
	}
	const text = await request(uri)
	const uris = text.match(urlRegex) || []
	uris.push(uri)

	const domains = _.chain(uris).map(e => url.parse(e, false, true).hostname).uniq().value()
	const ips = await Promise.all(_.map(domains, e => resolve(e).then(arr => arr[0])))
	const ipMap = _.zipObject(domains, ips)
	const output = _.map(ipMap, (v, k) => `${v} ${k}`).join('\n')

	ctx.body = indexHtml({ output })
})

app.use(koaBody())
app.use(router.routes())
app.use(router.allowedMethods())

app.listen(8080, () => console.log('Server start'))

module.exports = { app }
