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

### for the backend code:

You should let leaf knows your express/koa instance.

Exports your express app object like this.
Feel free to write other express logic.

```js
const express = require('express')

const app = express()
app.all('', (req, res) => {
	res.send(`${new Date()} hello world!`)
})
// listen method must be call. Any port is ok
app.listen(8080, () => console.log('Server start'))

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
// listen method must be call. Any port is ok
app.listen(8080, () => console.log('Server start'))

```

Make sure you have a package.json with correct dependencies declaration and package name.

### for the frontend code

if you need leaf to run the commands for you,
use the "build" option to declare commands for the code building.
You can also build the code manually and just tell leaf where are the static files,
using "static" option.

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

To stop all local container, run
```bash
docker stop $(docker ps -a -q)
```

## Config Options

Config can declare in package.json or leaf.json.

When declare in package.json, please add the 'leaf' prefix. Just like
```json
{
	"name": "example",
	"leafServer": "server/",
	"leafStatic": ["dist"],
	"leafEnv": {}
}
```

Or declare in leaf.json without prefix
```json
{
	"name": "example",
	"server": "server/",
	"static": ["dist"],
	"env": {}
}
```

| Field			| Desc										| Default						| Type		|
| :-			| :-										| :-							| :-		|
| name			| the name of current project				| name of package.json			| String	|
| description	| project description						| description of package.json	| String	|
| server		| the backend code folder(has package.json)	| project dir					| String	|
| static		| the static folders to be served			| no files are served			| Array		|
| env			| declare the environment variables			|								| Map		|
| build			| run build commands in the install stage	| scripts.build of package.json	| String	|
|				|											|								|			|

## Server Code Path

By default, leaf will take the project dir as the path of backend server.
If your backend server is in the subdirectory and has its own package.json,
tell leaf the code path using field "server"

## Serving static file

Declare folders for static files.

## Environment Variables

Declare env variables with field "env".

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

## Build script

By defalut, leaf will take the scripts.build command if it is declared in the package.json.
Or you can declare the command in leaf.json using field "build".
Leaf will run the build script in docker in the install stage.

If no build script is declared, leaf will run npm install for you and docker is not required for the deployment.
