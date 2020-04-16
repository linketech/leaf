const { promisify } = require('util')
const schedule = require('node-schedule')
const express = require('express')

const app = express()
const sleep = promisify(setTimeout)
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

app.listen(8080, () => console.log('Server start'))

process.emit('registerEvent', 'initializer', async () => { events[0] = Date.now() })

// style 1
schedule.scheduleJob('updateEventTimestamp1', '* * * * *', async () => {
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
const updateEventTimestamp4 = async () => { events[4] = Date.now() }
process.emit('registerEvent', updateEventTimestamp4)
