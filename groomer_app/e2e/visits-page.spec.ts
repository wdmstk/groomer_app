import { test, expect, type Page } from '@playwright/test'

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

test.describe('来店履歴ページ', () => {
  // TRACE-013
  test('主要タブの見出しが表示される', async ({ page }) => {
    await gotoStable(page, '/visits?tab=list')
    await expect(page.getByRole('heading', { level: 1, name: '来店履歴' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: '来店一覧' })).toBeVisible()
    await expect(page.getByRole('link', { name: '新規登録' })).toBeVisible()

    await gotoStable(page, '/visits?tab=revisit')
    await expect(page.getByRole('heading', { level: 2, name: '再来店漏れ分析（直近30日完了分）' })).toBeVisible()
    await expect(page.getByRole('link', { name: '再来店フォローへ' })).toBeVisible()

    await gotoStable(page, '/visits?tab=followup')
    await expect(page.getByRole('heading', { level: 2, name: 'フォロー効果分析（直近30日）' })).toBeVisible()

    await gotoStable(page, '/visits?tab=cycle')
    await expect(page.getByRole('heading', { level: 2, name: '来店周期分析' })).toBeVisible()

    await gotoStable(page, '/visits?tab=quality')
    await expect(page.getByRole('heading', { level: 2, name: '時間帯品質分析（直近30日）' })).toBeVisible()
  })

  test('一覧タブで新規登録モーダルを開ける', async ({ page }) => {
    await gotoStable(page, '/visits?tab=list&modal=create')

    await expect(page.getByRole('heading', { level: 3, name: '新規来店登録' })).toBeVisible()
    await expect(page.locator('select[name="customer_id"]')).toBeVisible()
    await expect(page.locator('select[name="staff_id"]')).toBeVisible()
    await expect(page.locator('input[name="visit_date"]')).toBeVisible()
  })
})
