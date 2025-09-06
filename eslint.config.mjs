import js from '@eslint/js'

export default [
	js.configs.recommended,
	{
		ignores: [
			'pkg/**',
			'dist/**',
			'build/**',
			'*.tgz',
			'build-config.cjs',
			'node_modules/**',
			'.vscode/**',
			'.idea/**',
			'tmp/**',
			'temp/**',
		],
	},
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				console: 'readonly',
				process: 'readonly',
				Buffer: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
			},
		},
		rules: {
			'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
			'no-console': 'off',
			'no-constant-condition': 'off',
		},
	},
]
