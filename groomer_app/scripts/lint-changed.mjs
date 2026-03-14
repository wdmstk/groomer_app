import { execFileSync, spawnSync } from 'node:child_process'

const ESLINT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])

function runGit(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim()
  } catch (error) {
    if (typeof error?.stdout === 'string') {
      return error.stdout.trim()
    }
    return ''
  }
}

function isLintablePath(filePath) {
  if (!filePath.startsWith('src/') && !filePath.startsWith('groomer_app/src/')) return false
  const extension = filePath.slice(filePath.lastIndexOf('.'))
  return ESLINT_EXTENSIONS.has(extension)
}

function toCwdRelativePath(filePath) {
  if (filePath.startsWith('groomer_app/')) {
    return filePath.slice('groomer_app/'.length)
  }
  return filePath
}

function parseChangedPaths() {
  const output = runGit(['status', '--porcelain', '--untracked-files=all'])
  if (!output) return []

  return output
    .split('\n')
    .map((line) => line.slice(3).trim())
    .map((filePath) => {
      const renameParts = filePath.split(' -> ')
      return renameParts[renameParts.length - 1]
    })
}

const targets = [...new Set(parseChangedPaths())].filter(isLintablePath).map(toCwdRelativePath).sort()

if (targets.length === 0) {
  console.log('No changed lintable files in src.')
  process.exit(0)
}

const result = spawnSync(
  'node_modules/.bin/eslint',
  ['--cache', '--cache-location', '.eslintcache', '--quiet', ...targets],
  { stdio: 'inherit', shell: process.platform === 'win32' }
)

if (typeof result.status === 'number') {
  process.exit(result.status)
}

process.exit(1)
