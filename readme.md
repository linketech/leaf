# leaf

A cli tool maked by (l)ink(e) for deploying serverless to (a)liyun (f)untion computing.

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

Make sure you have a package.json with correct dependencies declaration and package name.

Then run

```bash
leaf
```

Or

```bash
leaf deploy
```

## Debug

Use -d or --debug to deploy locally when you has docker installed.

```bash
leaf deploy --debug
```

## Environment Variables

Use leafEvn in package.json

```json
{
	"name": "example",
	"version": "1.0.0",
	"description": "",
	"main": "index.js",
	"leafEnv": {
		"MYSQL_USER": "root",
		"MYSQL_PASS": null
	}
}
```

Or

Use env in leaf.json

```json
{
	"name": "example",
	"env": {
		"MYSQL_USER": "root",
		"MYSQL_PASS": null
	}
}
```

When env value is set to null, leaf will read the env vars value from current shell.
So you can keep your sensitive information away from the codes.
