import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const hasVitestTarget = args.some((arg) => arg.includes('.vitest.test.'))

const command = hasVitestTarget
  ? {
      cmd: 'npx',
      argv: ['vitest', 'run', ...args],
    }
  : {
      cmd: 'node',
      argv: ['--import', './tests/register-alias.mjs', '--test', ...args],
    }

const result = spawnSync(command.cmd, command.argv, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (typeof result.status === 'number') {
  process.exit(result.status)
}

process.exit(1)
