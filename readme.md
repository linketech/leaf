# leaf

A cli tool maked by (l)ink(e) to deploy serverless to (a)liyun (f)untion computing.

## Install

```bash
npm i @linke/leaf -g
```

## Config

Tell leaf your aliyun account info.

```bash
leaf config
```

## Usage

Exports your express app object like this.
Feel free to write other express logic.

```js
const express = require('express')

const app = express()
app.all('', (req, res) => {
	res.send(`${new Date()} hello world!`)
})
app.listen(8080, () => console.log('Server start'))

module.exports = { app } // important
```

Or

Exports your koa app object like this.
Feel free to write other koa logic.

```js
const Koa = require('koa')
const app = new Koa()

app.use(async (ctx) => {
	ctx.body = `${new Date()} hello world!`
})
app.listen(8080, () => console.log('Server start'))

module.exports = { app } // important
```

Make sure you have a package.json with corrected dependencies declaration and package name.

Then run

```bash
leaf deploy
```

## Debug

Use -d or --debug to deploy locally. Make sure docker is installed.

```bash
leaf deploy --debug
```
