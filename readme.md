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

If you want leaf to build the frontend codes for you,
use the ["build"](#build-script) option to declare these commands.
You can also build the code manually,
tell leaf the locations of the static files using ["static"](#static) option.

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

Config can be declared in package.json or leaf.json.

The priority of the config options will be:

fields in package.json < options naming "leafXXX" in package.json < options in leaf.json

To declare in package.json, use the 'leaf' prefix:
```json
{
	"name": "example",
	"leafServer": "server/",
	"leafStatic": ["dist"],
	"leafEnv": {}
}
```

To declare in leaf.json:
```json
{
	"name": "example",
	"server": "server/",
	"static": ["dist"],
	"env": {}
}
```

### Avalible Options

| Field			| Desc										| Default						| Type		|
| :-			| :-										| :-							| :-		|
| name			| the name of current project				| name of package.json			| String	|
| description	| project description						| description of package.json	| String	|
| server		| the backend code folder(has package.json)	| project dir					| String	|
| static		| the static folders to be served			| no files are served			| Array		|
| env			| declare the environment variables			|								| Map		|
| build			| run build commands in docker build stage	| scripts.build of package.json	| String	|
| domain		| the domain to deploy						| {name}.leaf.linketech.cn		| String	|
| serverless	| config of the function compute			| ref to the doc				| Map		|
|				|											|								|			|

## Server Code Path

By default, leaf will take the project dir as the path of backend server.
If your backend server is in the subdirectory and has its own package.json,
tell leaf the code path using field "server"

## Serving static file

Using the "static" configuration option, you can specify some directories to make leaf serve these static resource files. Leaf will look for these requested files in the order of the directory array.

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

## Domain

Specify your domain of the serverless. Make sure your access key has the appropriate permissions
for managing the dns and function compute apis of your alicloud accound.

TODO: docs for domain using cdn

## Serverless

### memory

Use the serverless.memory property to tell how many memories(MB) is reserved for the serverless.

Default value is 256 MB.

### timeout

Use the serverless.timeout property to specify the runtime timeout(s) of the serverless.

Default value is 60 seconds.

### logTTL

Use the serverless.logTTL property to tell how many days the logstore to keep the logs.

Default value is 180 days.

When the code is deployed, use "leaf logs" to fetech the logs.
Use "leaf logs --help" for more infomations.

Alternatively, the logs can be found in logstore of alicloud console.

## Static Only

Remove the package.json if you need to put some static files online without any backend code.
In this case, a reserve env var PROXY_404_TO_ROOT can set to true, indicating any 404 resources will proxy to /,
which is useful for SPA website.

## Reserve Environment Variable
```json
{
	"env": {
		// redirect 404 request to /, default is false.
		"PROXY_404_TO_ROOT": true,
		// add "cache-control: max-age=xxx" header to the served static files, default is 0
		"STATIC_FILES_MAX_AGE": 3600
	}
}
```
