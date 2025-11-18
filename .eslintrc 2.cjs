module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'eslint-comments'],
  env: {
    es2022: true,
    node: true,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'no-console': ['error', { allow: ['error'] }],
    'eslint-comments/no-unused-disable': 'error',
    'eslint-comments/no-unlimited-disable': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['dist/**'],
}


