import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PORT ?? '3000')
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx next dev --webpack',
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      ...process.env,
      PORT: String(port),
      PLAYWRIGHT_E2E: '1',
      NEXT_PUBLIC_PLAYWRIGHT_E2E: '1',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
