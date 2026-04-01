import { expect, test } from '@playwright/test'

test.describe('日誌画面', () => {
  test('日誌トップでサイドバー導線と投稿UIを表示できる', async ({ page }) => {
    await page.goto('/journal', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: '日誌', exact: true })).toBeVisible()
    await expect(page.getByText('クイック日誌投稿')).toBeVisible()
    await expect(page.getByText('写真を追加')).toBeVisible()
    await expect(page.getByText('動画を追加')).toBeVisible()
    await expect(page.getByRole('link', { name: '日誌' })).toBeVisible()
  })

  test('写真・動画添付UIを表示できる', async ({ page }) => {
    await page.goto('/journal', { waitUntil: 'domcontentloaded' })
    const photoInput = page.locator('input[type="file"][accept="image/*"]')
    const videoInput = page.locator('input[type="file"][accept="video/*"]')
    await expect(photoInput).toHaveCount(1)
    await expect(videoInput).toHaveCount(1)
  })

  test('ペット別アルバムへ遷移して投稿一覧を確認できる', async ({ page }) => {
    await page.goto('/pets?tab=list', { waitUntil: 'domcontentloaded' })
    await page.getByRole('link', { name: '日誌アルバム' }).first().click()

    await expect(page.getByRole('heading', { name: 'こむぎの日誌アルバム' })).toBeVisible()
    await expect(page.getByText('シャンプー中も落ち着いて過ごせました。')).toBeVisible()
    await expect(page.getByText('写真 1 件 / 動画 1 件')).toBeVisible()
  })
})
