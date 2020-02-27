const express = require('express')

const app = express()

app.all('/time', (req, res) => {
	const rs = `Time is now: ${new Date()}`
	console.log('req /time', rs)
	res.send(rs)
})

app.all('', (req, res) => {
	res.send(`${new Date()} hello world!`)
})

app.listen(8080, () => console.log('Server start'))
