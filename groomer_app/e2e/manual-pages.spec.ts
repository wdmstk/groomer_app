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

test.describe('マニュアル系ページ', () => {
  // TRACE-288
  test('マニュアル目次で主要導線を表示できる', async ({ page }) => {
    await gotoStable(page, '/manual')

    await expect(page.getByRole('heading', { level: 1, name: 'ユーザーマニュアル目次' })).toBeVisible()
    await expect(page.getByText('更新日: 2026-03-21')).toBeVisible()
    await expect(page.getByRole('link', { name: '用語集ページを開く' })).toBeVisible()
  })

  // TRACE-289
  test('マニュアル目次からセクションページへ遷移できる', async ({ page }) => {
    await gotoStable(page, '/manual')

    await page.getByRole('link', { name: 'ログイン' }).first().click()
    await expect(page).toHaveURL(/\/manual\/login\?flow=/)
    await expect(page.getByRole('heading', { level: 1, name: 'ログイン' })).toBeVisible()
  })

  // TRACE-290
  test('用語集ページの表示と目次戻り導線を確認できる', async ({ page }) => {
    await gotoStable(page, '/manual/glossary')

    await expect(page.getByRole('heading', { level: 1, name: '用語集（横文字・ステータスの説明）' })).toBeVisible()
    await expect(page.getByText('owner / admin / staff')).toBeVisible()
    await page.getByRole('link', { name: '目次に戻る' }).click()
    await expect(page).toHaveURL(/\/manual$/)
  })

  // TRACE-291
  test('セクションページで目次/用語集の戻り導線を表示できる', async ({ page }) => {
    await gotoStable(page, '/manual/login')

    await expect(page.getByRole('heading', { level: 1, name: 'ログイン' })).toBeVisible()
    await expect(page.getByText('/login')).toBeVisible()
    await expect(page.getByRole('link', { name: '目次に戻る' })).toBeVisible()
    await expect(page.getByRole('link', { name: '用語集ページ' })).toBeVisible()
  })

  // TRACE-292
  test('dev manual は未許可ユーザーにアクセス制限メッセージを表示する', async ({ page }) => {
    await gotoStable(page, '/dev/manual')

    await expect(page.getByRole('heading', { level: 1, name: '管理者マニュアル' })).toBeVisible()
    await expect(page.getByText('このページはサポート管理者のみアクセスできます。')).toBeVisible()
  })

  // TRACE-293
  test('hq manual は機能アクセス制限時にダッシュボードへリダイレクトする', async ({ page }) => {
    await gotoStable(page, '/hq/manual')

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('heading', { level: 1, name: 'ダッシュボード' })).toBeVisible()
  })

  // TRACE-294
  test('flow指定時に前へ/次へ導線へ flow パラメータが引き継がれる', async ({ page }) => {
    await gotoStable(page, '/manual/login?flow=flow-initial')

    await expect(page.getByRole('link', { name: '前へ' })).toHaveAttribute('href', '/manual/signup?flow=flow-initial')
    await expect(page.getByRole('link', { name: '次へ' })).toHaveAttribute('href', '/manual/setup-store?flow=flow-initial')
  })
})
