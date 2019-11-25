#!/usr/bin/env node
const cp = require('child_process')

cp.execSync('npx fun config', { stdin: 'inherit', stdio: 'inherit' })
