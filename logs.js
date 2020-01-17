const { promisify } = require('util')
const { Command } = require('commander')
const R = require('ramda')
const ALY = require('aliyun-sdk')
const { getProfileFromFile } = require('@alicloud/fun/lib/profile')
const { getConfig } = require('./lib/config-loader')

const TTL = 30

const program = new Command()

program
	.option('-t, --tail <lineCount>', 'line count of logs', 100)
	.option('-q, --query <expression>', 'a query expression for searching the logstore', '')
	.option('-v, --verbose', 'display the full logs of serverless')
	.parse(process.argv)

const leafConfig = getConfig(program.args[0])

async function ensureAlicloud() {
	const config = await getProfileFromFile()
	const sls = new ALY.SLS({
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.accessKeySecret,
		endpoint: `http://${config.defaultRegion}.sls.aliyuncs.com`,
		apiVersion: '2015-06-01',
	})
	return sls
}

async function getLogs(from, to, offset) {
	const sls = await ensureAlicloud()
	sls.getLogsAsync = promisify(sls.getLogs.bind(sls))
	const data = await sls.getLogsAsync({
		// 必选字段
		projectName: leafConfig.logProjectName,
		logStoreName: leafConfig.logStoreName,
		from, // 开始时间(精度为秒,从 1970-1-1 00:00:00 UTC 计算起的秒数)
		to, // 结束时间(精度为秒,从 1970-1-1 00:00:00 UTC 计算起的秒数)

		// 以下为可选字段
		// topic: '', // 指定日志主题(用户所有主题可以通过listTopics获得)
		reverse: true, // 是否反向读取,只能为 true 或者 false,不区分大小写(默认 false,为正向读取,即从 from 开始到 to 之间读取 Line 条)
		query: program.query, // 查询的关键词,不输入关键词,则查询全部日志数据
		line: 3, // 读取的行数,默认值为 100,取值范围为 0-100
		offset, // 读取起始位置,默认值为 0,取值范围>0
	})

	return R.pipe(
		R.values,
		R.pluck('message'),
	)(data.body)
}

async function tailLogs() {
	const end = Math.floor(Date.now() / 1000)
	const start = end - (TTL * 24 * 3600)
	let count = Number(program.tail)
	let offset = 0
	const toPlainText = R.pipe(
		R.filter(e => program.verbose || !Number.isNaN(new Date(e.split(' ')[0]).valueOf())),
		// eslint-disable-next-line no-plusplus
		R.filter(() => (count--) > 0),
		R.join('\n'),
	)
	while (count > 0) {
		// eslint-disable-next-line no-await-in-loop
		const rs = await getLogs(start, end, offset)
		// console.debug(rs)
		const logs = toPlainText(rs)
		if (logs) {
			console.log(logs)
		}
		offset += rs.length
		if (!rs.length) {
			break
		}
	}
}

tailLogs().catch(e => console.error(e.errorMessage || e))
