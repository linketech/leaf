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
		if (name && typeof cron === 'string' && typeof handler === 'function') {
			process.emit('registerEvent', name, handler)
		}
	}
} catch (e) {
	// console.debug(e.message)
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
	if (typeof handler !== 'function') {
		throw new Error(`registerEvent handler of ${name} is not a function`)
	}

	console.debug('registerEvent', name)
	if (listeners[name]) {
		listeners[name].push(handler)
		return
	}

	listeners[name] = [handler]
	process.on(eventName(name), (callback) => {
		try {
			Promise.all(listeners[name].map(f => f())).then(() => callback()).catch(callback)
		} catch (e) {
			callback(e)
		}
	})
}

function handleEvent(name, callback) {
	process.nextTick(() => {
		const handled = process.emit(eventName(name), callback)
		if (!handled) {
			callback()
		}
	})
}

process.on('registerEvent', registerEvent)

module.exports = { handleEvent, registerEvent }
