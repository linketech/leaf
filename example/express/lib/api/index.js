/* eslint-disable no-console */
const os = require('os')
const util = require('util')
const schedule = require('node-schedule')
const express = require('express')
const multiparty = require('multiparty')

const app = express()
const sleep = util.promisify(setTimeout)
const events = []

app.all('/time', (req, res) => {
	// http trigger和timer event的实例是不一样的，所以虽然event已经发出并成功执行，这里的变量还是null.
	const rs = `Time is now: ${new Date().toISOString()}, events: ${events.map((v, i) => `[${i}]=${new Date(v).toISOString()}`).join(', ')}`
	console.log('req /time', rs)
	res.send(rs)
})

app.all('', (req, res) => {
	res.send(`${new Date().toISOString()} hello world!`)
})

const uploadTemplate = (info) => `
	<html>
	<body>
		<form action="/upload" enctype="multipart/form-data" method="post">
			<input type="text" name="title">
			<input type="file" name="upload" multiple="multiple">
			<input type="submit" value="Upload">
		</form>
		<div>received fields:</div>
		<div>${util.inspect(info.fields)}</div>
		<div>received files:</div>
		<div>${util.inspect(info.files)}</div>
		${info.files.upload.map(({ path, originalFilename }) => `<div><a href="${originalFilename}">${path}</a></div>`)}
	</body>
	</html>
`
app.use('/tmp', express.static(os.tmpdir()))
app.post('/upload', (req, res) => {
	console.log(new Date(), req.method, req.url, req.body, req.rawBody)
	const form = new multiparty.Form()

	form.parse(req, (err, fields, files) => {
		if (err) {
			res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
			res.end(err.message)
			return
		}
		res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
		res.end(uploadTemplate({ fields, files }))
	})
})

setTimeout(() => {
	app.listen(8080, () => console.log('Server start'))
}, 2000)

process.emit('registerEvent', 'initializer', () => { events[0] = Date.now() })

// style 1
schedule.scheduleJob('updateEventTimestamp1', '* * * * *', () => {
	console.log('updateEventTimestamp1', events[1])
	events[1] = Date.now()
})

// style 2
const updateEventTimestamp2 = async () => {
	console.log('updateEventTimestamp2 start', events[2])
	await sleep(5000)
	events[2] = Date.now()
	console.log('updateEventTimestamp2 end', events[2])
}
schedule.scheduleJob('30 * * * * *', updateEventTimestamp2)

// style 3
process.emit('registerEvent', 'updateEventTimestamp3', async () => { events[3] = Date.now() })

// style 4
const updateEventTimestamp4 = () => new Promise((resolve) => {
	setTimeout(() => {
		events[4] = Date.now()
		resolve()
	}, 5000)
})
process.emit('registerEvent', updateEventTimestamp4)
