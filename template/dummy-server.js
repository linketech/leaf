/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved */
const Koa = require('koa')

const app = new Koa()
const port = 8080

app.listen(port, () => console.log('Server start'))
