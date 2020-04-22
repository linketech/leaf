# leaf

A cli tool maked by (l)ink(e) for deploying serverless to (a)liyun (f)untion computing.

## Install

```bash
npm i @linke/leaf -g
```

## Config

Tell leaf your alicloud account info.

```bash
leaf config
```

## Usage

### for the backend code:

You should let leaf knows your express/koa instance, by calling the listen method.
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

No config is needed for the common static html code.

However, if you want leaf to build the frontend codes for you,
use the ["build"](#build-script) option to declare these commands.

You can also build the code manually,
just tell leaf the locations of the static files using ["static"](#static) option.

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
| timer			| event trigger of timers					| no timers						| Map		|
| vpc			| make program under the specified vpc		| no vpc						| Map		|
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

The follow reserve environment variables are used by leaf

```js
{
	"env": {
		// Remove the package.json if you need to put some static files online without any backend code.
		// In this case, a reserve env var PROXY_404_TO_ROOT can be set to true,
		// indicating any 404 resources will proxy to /,
		// which is useful for SPA website.
		"PROXY_404_TO_ROOT": true,

		// add "cache-control: max-age=xxx" header to the served static files, default is 0
		"STATIC_FILES_MAX_AGE": 3600
	}
}
```

## Build

There are three methods for leaf to build your code: shell, docker, cloud.

for example
```bash
leaf --build-with docker
```

### shell
It's the default building method, leaf will use your current shell to run the npm install command, which is straightforward and fast.

However, if your project dependencies have c/c++ addons,
they will be failed to load in the alicloud fc enviroment.

Then you will need docker or cloud build methods.

### docker
Run npm install in docker.

By defalut, leaf will take the scripts.build command if it is declared in the package.json.
Or you can declare the command in leaf.json using field "build".
Leaf will run the build script in docker also.

### cloud
Upload the package.json to cloud and run npm install in the cloud, and then download it.

This method is useful if your os do not has docker installed.
Or your network enviroment is bad to access the npm server.

## Domain

Specify your domain of the serverless. Make sure your access key has the appropriate permissions
for managing the dns and function compute apis of your alicloud accound.

### CDN

The following instructions are for user who want to deploy their fc code behind alicloud's CDN.
1. nslookup to get the ip of alicloud fc server, exp: nslookup xxx.leaf.linketech.cn
1. create a desired domain in cdn console, exp: *.leaf.linketech.cn
1. point to the ip of alicloud fc server. (do not point to a specific fc directly)
1. set dns of your desired domain, cname to the domain of the cdn server

## Serverless

```js
{
	"serverless": {
		// how many memories(MB) is reserved for the serverless
		"memory": 256,

		// runtime timeout(s) of the serverless
		"timeout": 60,

		// How many days the logstore keeps the logs
		// Use "leaf logs" to fetech the logs.
		"logTTL": 180,
	}
}
```

## Timer

Instances of serverless are not resident. Therefore, for the periodic repeated tasks, you should use timers.
A timer is an event trigger indicated by cron expression. 
It MUST be a named function, and the name will become the fc event name.
There are 4 code styles for declaring timers.

```js

const schedule = require('node-schedule')

// style 1, using node-schedule, create a named job: handleEvent1.
// And 'handleEvent1' will be the event name.
schedule.scheduleJob('handleEvent1', '0 * * * * *', async () => {})

// style 2, using node-schedule, create a unamed job with a named async function: handleEvent2.
// And 'handleEvent2' will be the event name.
const handleEvent2 = async () => {}
schedule.scheduleJob('30 * * * * *', handleEvent2)

// style 3, without node-schedule, emit a registerEvent on the process global object,
// with a event name and an async function
process.emit('registerEvent', 'handleEvent3', async () => {})

// style 4, without node-schedule, emit a registerEvent on the process global object,
// with an named async function: handleEvent4.
// And 'handleEvent4' will be the event name.
const handleEvent4 = async () => {}
process.emit('registerEvent', handleEvent4)

```

Then declare the timer option in the config of leaf.
```json
{
	"timer": {
		"handleEvent1": "10 * * * * *",
		"handleEvent2": "20 * * * * *",
		"handleEvent3": "30 * * * * *",
		"handleEvent4": "40 * * * * *",
	},
}
```

When multiple event is registered with a same name, leaf will run all the handlers parallelly and wait for them to finish until event timeout.


### initializer
You can also use the registerEvent to declare an initializer which will be called when serverless instance starts.

```js
process.emit('registerEvent', 'initializer', async () => {
	// some initialization job
})
```

Similar to timer event, when multiple initializer is registered, leaf will run all the handlers parallelly and wait for them to finish until event timeout.


## VPC

If your code need to connect to other products in vpc of alicloud, for example: RDS, MQ or other ECS,
a vpc config is should be set.

```js
{
	"vpc": {
		"VpcId": "vpc-xxx",
		"VSwitchIds": ["vsw-xxx"],
		"SecurityGroupId": "sg-xxx"
	}
}
```
