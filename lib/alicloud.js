const path = require('path')
const { promisify } = require('util')
const R = require('ramda')
const Core = require('@alicloud/pop-core')
const FCClient = require('@alicloud/fc2')
const { getProfileFromFile } = require('@alicloud/fun/lib/profile')

const sleep = promisify(setTimeout)

let core
let fc2
let config

async function ensureAlicloud() {
	if (!config) {
		config = await getProfileFromFile()
	}
	if (!core) {
		core = new Core({
			accessKeyId: config.accessKeyId,
			accessKeySecret: config.accessKeySecret,
			endpoint: 'https://alidns.aliyuncs.com',
			apiVersion: '2015-01-09',
		})
	}
	if (!fc2) {
		fc2 = new FCClient(config.accountId, {
			accessKeyID: config.accessKeyId,
			accessKeySecret: config.accessKeySecret,
			region: config.defaultRegion,
		})
	}
}

async function getDomainCommonParams(domain) {
	await ensureAlicloud()
	const split = domain.split('.')
	return {
		RegionId: config.defaultRegion,
		DomainName: [split.pop(), split.pop()].reverse().join('.'),
		RR: split.join('.'),
	}
}

async function listFCCustomDomains(domain) {
	await ensureAlicloud()
	const rs = await fc2.listCustomDomains({ prefix: domain.split('.').shift() })
	return R.pathOr([], ['data', 'customDomains'], rs).filter(({ domainName }) => domainName === domain)
}

async function listDomainRecord(domain) {
	const common = await getDomainCommonParams(domain)
	common.KeyWord = common.RR
	const params = {
		...common,
		PageSize: 500,
	}
	const rs = await core.request('DescribeDomainRecords', params, { method: 'POST' })
	return R.pathOr([], ['DomainRecords', 'Record'], rs)
}

async function deleteDomainRecord(recordId) {
	await ensureAlicloud()
	const rs = await core.request('DeleteDomainRecord', {
		RegionId: config.recordId,
		RecordId: recordId,
	}, { method: 'POST' })
	return rs
}

async function addDomainRecord(domain) {
	const params = {
		...await getDomainCommonParams(domain),
		Type: 'CNAME',
		Value: `${config.accountId}.${config.defaultRegion}.fc.aliyuncs.com`,
	}
	const rs = await core.request('AddDomainRecord', params, { method: 'POST' })
	return rs
}

async function ensureFCCustomDomains(domain) {
	let rs
	console.debug('Ensure custom domain', domain)
	rs = await listFCCustomDomains(domain)
	if (rs.length) {
		console.debug('Domain', domain, 'is ready')
		return
	}

	console.debug('Inspect dns for', domain)
	let match
	const destDomain = `${config.accountId}.${config.defaultRegion}.fc.aliyuncs.com`
	rs = await listDomainRecord(domain)
	for (let i = 0; i < rs.length; i += 1) {
		const { RR: src, Value: dst, RecordId: recordId } = rs[i]
		if (dst !== destDomain) {
			console.debug('Removing', recordId, src, '->', dst)
			// eslint-disable-next-line no-await-in-loop
			console.debug(await deleteDomainRecord(recordId))
		} else {
			match = recordId
		}
	}

	if (!match) {
		console.debug('Create dns for', domain)
		rs = await addDomainRecord(domain)
		match = rs.RecordId
		console.debug('Wait 5s to take effect')
		await sleep(5000)
	}

	console.debug('Create custom domain', domain)
	rs = await fc2.createCustomDomain(domain)
	console.debug(domain, 'is ready')

	if (match) {
		console.debug('Remove', destDomain, 'for', domain)
		await deleteDomainRecord(match)
	}
}

module.exports = {
	ensureFCCustomDomains,
	funExec: `"${path.join(__dirname, '..', 'node_modules', '.bin', 'fun')}"`,
}
