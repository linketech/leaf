module.exports = {
	env: {
		es6: true,
		node: true,
		mocha: true,
	},
	extends: 'airbnb-base',
	root: true,
	rules: {
		'no-tabs': 0,
		indent: [
			'error',
			'tab',
		],
		'linebreak-style': [
			'error',
			'unix',
		],
		quotes: [
			'error',
			'single',
		],
		semi: [
			'error',
			'never',
		],
		'object-curly-newline': 0,
	},
}
