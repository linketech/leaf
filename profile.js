const os = require('os')
const fs = require('fs-extra')
const path = require('path')
const { Command } = require('commander')

const program = new Command()

program
	.usage('[ProfileName]')
	.option('-l, --list', 'list all the profiles')
	.option('-s, --save <ProfileName>', 'save the current leaf config to this profile')
	.option('-d, --delete <ProfileName>', 'delete the specified profile')
	.parse(process.argv)


async function main() {
	const aliProfile = path.join(process.env.HOME || os.homedir(), '.fcli', 'config.yaml')
	if (!await fs.pathExists(aliProfile)) {
		console.log('Please run "leaf config" first')
		return
	}

	const tmpPath = path.join(os.homedir(), 'leaf-profiles')
	await fs.ensureDir(tmpPath)

	if (program.list) {
		console.log('List profiles')
		const files = await fs.readdir(tmpPath)
		console.log(files.length ? files.join('\n') : '<empty>')
		return
	}

	if (program.save) {
		const profileName = program.save
		console.log('Save current leaf config to profile', profileName)
		await fs.copy(aliProfile, path.join(tmpPath, profileName))
		return
	}

	if (program.delete) {
		const profileName = program.delete
		console.log('Delete profile', profileName)
		const file = path.join(tmpPath, profileName)
		if (!await fs.pathExists(file)) {
			console.log('Profile', profileName, 'is not exists')
			return
		}
		await fs.remove(file)
		return
	}

	if (program.args[0]) {
		const profileName = program.args[0]
		const file = path.join(tmpPath, profileName)
		if (!await fs.pathExists(file)) {
			console.log('Profile', profileName, 'is not exists')
			return
		}
		console.log('Switch config to profile', profileName)
		await fs.copy(path.join(tmpPath, profileName), aliProfile)
		return
	}

	console.log('-h or --help for command help')
}

main().catch(e => console.error(e.errorMessage || e))
