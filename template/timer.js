const listeners = {}
const eventName = name => `alicloud:timer:${name}`

// hack
try {
	// eslint-disable-next-line global-require, import/no-unresolved
	const schedule = require('node-schedule')
	schedule.scheduleJob = (p1, p2, p3) => {
		let cron
		let handler
		let name
		if (!p3) {
			cron = p1
			handler = p2
			name = handler ? handler.name : ''
		} else {
			name = p1
			cron = p2
			handler = p3
		}
		if (name && typeof cron === 'string' && typeof handler === 'function' && handler.constructor.name === 'AsyncFunction') {
			process.emit('registerEvent', name, handler)
		}
	}
} catch (e) {
	// console.log(e.message)
}

function registerEvent(p1, p2) {
	let name
	let handler
	if (p2) {
		name = p1
		handler = p2
	} else {
		handler = p1
		name = handler.name
	}
	if (listeners[name]) {
		throw new Error(`registerEvent ${name} multiple times`)
	}
	if (typeof handler !== 'function' || handler.constructor.name !== 'AsyncFunction') {
		throw new Error(`registerEvent handler of ${name} is not an AsyncFunction`)
	}
	listeners[name] = true
	console.log('registerEvent', name)
	process.on(eventName(name), callback => handler().then(callback).catch(callback))
}

function handleEvent(name, callback) {
	process.emit(eventName(name), callback)
}

process.on('registerEvent', registerEvent)

module.exports = { handleEvent, registerEvent }
