#!/usr/bin/env node
const cp = require('child_process')
const { funExec } = require('./lib/alicloud')

cp.execSync(`${funExec} config`, { stdin: 'inherit', stdio: 'inherit' })
