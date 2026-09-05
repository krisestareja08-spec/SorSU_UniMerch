import next from 'eslint-config-next'

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
  ...next,
]

export default eslintConfig
