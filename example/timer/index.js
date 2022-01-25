/* eslint-disable no-console */
process.emit('registerEvent', 'consoleLog', async () => {
	console.log(new Date(), process.version)
})
