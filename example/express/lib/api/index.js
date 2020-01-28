const express = require('express')

const app = express()

app.all('/time', (req, res) => {
	res.send(`Time is now: ${new Date()}`)
})

app.all('', (req, res) => {
	res.send(`${new Date()} hello world!`)
})

app.listen(8080, () => console.log('Server start'))
