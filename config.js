#!/usr/bin/env node
const cp = require('child_process')

cp.execSync('npx @alicloud/fun config', { stdin: 'inherit', stdio: 'inherit' })
