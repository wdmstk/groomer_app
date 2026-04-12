import { expect, test, type Page } from '@playwright/test'

async function gotoStable(page: Page, url: string) {
  let lastError: unknown = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      return
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes('net::ERR_ABORTED') || attempt === 2) throw error
      await page.waitForTimeout(300)
    }
  }
  throw lastError
}

test.describe('認証導線ページ', () => {
  // TRACE-284
  // TRACE-307
  test('ログインページで基本導線を表示できる', async ({ page }) => {
    await gotoStable(page, '/login')

    await expect(page.getByRole('heading', { level: 1, name: 'ログイン' })).toBeVisible()
    await expect(page.getByPlaceholder('メールアドレス')).toBeVisible()
    await expect(page.getByPlaceholder('パスワード')).toBeVisible()
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible()
    await expect(page.getByRole('link', { name: '料金・プランを見る' })).toBeVisible()
  })

  // TRACE-285
  // TRACE-308
  test('新規登録ページで同意導線を表示できる', async ({ page }) => {
    await gotoStable(page, '/signup')
    const signupForm = page.locator('form')

    await expect(page.getByRole('heading', { level: 1, name: '新規登録' })).toBeVisible()
    await expect(signupForm.getByRole('checkbox')).toBeVisible()
    await expect(signupForm.getByRole('link', { name: '利用規約' })).toBeVisible()
    await expect(signupForm.getByRole('link', { name: 'プライバシーポリシー' })).toBeVisible()
    await expect(signupForm.getByRole('link', { name: '特定商取引法に基づく表記' })).toBeVisible()
    await expect(page.getByRole('button', { name: '登録する' })).toBeDisabled()
  })
})
