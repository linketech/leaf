#!/usr/bin/env node
const path = require('path')
const { Command } = require('commander')
const packageJson = require('./package.json')

const program = new Command()
program
	.version(packageJson.version)

program
	.command('deploy [path]', 'Performs a deployment', { isDefault: true, executableFile: path.join(__dirname, 'deploy.js') })
	.command('config', 'Config leaf', { executableFile: path.join(__dirname, 'config.js') })

program.parse(process.argv)
