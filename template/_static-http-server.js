
// eslint-disable-next-line import/no-unresolved
const Koa = require('koa')

const app = new Koa()
app.listen(8080, () => console.log('Server start'))
