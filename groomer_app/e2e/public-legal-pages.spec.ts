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

test.describe('公開LP/法務ページ', () => {
  // TRACE-280
  test('LPで主要メッセージと無料導線を表示できる', async ({ page }) => {
    await gotoStable(page, '/lp')

    await expect(page.getByRole('heading', { level: 1, name: '写真だけで終わらない。' })).toBeVisible()
    await expect(page.getByText('動画カルテ×AIで、提案までつながる')).toBeVisible()
    await expect(page.getByRole('link', { name: 'まずは30日無料で試す' })).toBeVisible()
  })

  // TRACE-281
  test('LPの法務リンクから利用規約へ遷移できる', async ({ page }) => {
    await gotoStable(page, '/lp')

    await page.getByRole('link', { name: '利用規約' }).first().click()
    await expect(page).toHaveURL(/\/legal\/terms$/)
    await expect(page.getByRole('heading', { level: 1, name: '利用規約' })).toBeVisible()
  })

  // TRACE-282
  test('利用規約ページから料金ページへ戻れる', async ({ page }) => {
    await gotoStable(page, '/legal/terms')

    await expect(page.getByRole('heading', { level: 1, name: '利用規約' })).toBeVisible()
    await page.getByRole('link', { name: '料金ページに戻る' }).click()
    await expect(page).toHaveURL(/\/lp$/)
  })

  // TRACE-283
  test('各法務ページの見出しを表示できる', async ({ page }) => {
    await gotoStable(page, '/legal/privacy')
    await expect(page.getByRole('heading', { level: 1, name: 'プライバシーポリシー' })).toBeVisible()

    await gotoStable(page, '/legal/security')
    await expect(page.getByRole('heading', { level: 1, name: 'セキュリティ説明書（企業向け）' })).toBeVisible()

    await gotoStable(page, '/legal/tokusho')
    await expect(page.getByRole('heading', { level: 1, name: '特定商取引法に基づく表記' })).toBeVisible()
  })
})
