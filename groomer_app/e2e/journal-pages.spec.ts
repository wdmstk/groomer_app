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

test.describe('日誌画面', () => {
  test('日誌トップでサイドバー導線と投稿UIを表示できる', async ({ page }) => {
    await gotoStable(page, '/journal')

    await expect(page.getByRole('heading', { name: '日誌', exact: true })).toBeVisible()
    await expect(page.getByText('クイック日誌投稿')).toBeVisible()
    await expect(page.getByText('写真を追加')).toBeVisible()
    await expect(page.getByText('動画を追加')).toBeVisible()
    await expect(page.getByRole('link', { name: '日誌' })).toBeVisible()
  })

  test('写真・動画添付UIを表示できる', async ({ page }) => {
    await gotoStable(page, '/journal')
    const photoInput = page.locator('input[type="file"][accept="image/*"]')
    const videoInput = page.locator('input[type="file"][accept="video/*"]')
    await expect(photoInput).toHaveCount(1)
    await expect(videoInput).toHaveCount(1)
  })

  test('ペット別アルバムへ遷移して投稿一覧を確認できる', async ({ page }) => {
    await gotoStable(page, '/customers/manage?view=detail&customer_id=customer-001&tab=pet:pet-001')
    const albumLink = page.getByRole('link', { name: '日誌アルバム' }).first()
    await expect(albumLink).toBeVisible()
    await albumLink.click()
    await expect(page).toHaveURL(/\/journal\/(?:album|pets)\/pet-001(?:\?|$)/)

    await expect(page.getByRole('heading', { name: /日誌アルバム/ })).toBeVisible()
    await expect(page.getByText('シャンプー中も落ち着いて過ごせました。')).toBeVisible()
    await expect(page.getByText('写真 1 件 / 動画 1 件')).toBeVisible()
  })
})
