const express = require('express')

const app = express()
app.all('', (req, res) => {
	res.send(`${new Date()} hello world!`)
})

app.listen(8080, () => console.log('Server start'))

module.exports = { expressApp: app }
