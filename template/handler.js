const { httpHandler } = require('./http-server')
const { handleEvent } = require('./timer')

process.chdir('src')
// eslint-disable-next-line import/no-unresolved
require('.')

module.exports.initializer = (context, callback) => {
	console.log('initializer', JSON.stringify(context.function))
	handleEvent('initializer', callback)
}

module.exports.httpHandler = (request, response, context) => {
	httpHandler(request, response, context).catch(e => response.send(e))
}

module.exports.timerHandler = (event, context, callback) => {
	const eventString = event.toString()
	const e = JSON.parse(eventString)
	console.log('timerHandler', eventString)
	handleEvent(e.triggerName, callback)
}
