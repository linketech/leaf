#!/usr/bin/env node
const path = require('path')
const { Command } = require('commander')
const updateNotifier = require('update-notifier')
const pkg = require('./package.json')

updateNotifier({ pkg, updateCheckInterval: 3600 }).notify()

const program = new Command()
program
	.version(pkg.version)

program
	.command('deploy [path]', 'Performs a deployment', { isDefault: true, executableFile: path.join(__dirname, 'deploy.js') })
	.command('config', 'Config leaf', { executableFile: path.join(__dirname, 'config.js') })
	.command('logs [name]', 'Get the serverless logs', { executableFile: path.join(__dirname, 'logs.js') })
	.command('profile [name]', 'Set leaf config according to the profile', { executableFile: path.join(__dirname, 'profile.js') })

program.parse(process.argv)
