const fs = require('fs')
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

const indexHtml = _.template(fs.readFileSync('./static/index.html'))

// router.get('/', async (ctx) => {
// 	ctx.body = indexHtml({ output: '' })
// })

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
