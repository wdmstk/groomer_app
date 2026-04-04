import { expect, test } from '@playwright/test'

test.describe('カルテの写真・動画混在一覧', () => {
  test('カルテ一覧で最新メディア（写真・動画）セクションを表示できる', async ({ page }) => {
    await page.goto('/medical-records?tab=list', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'ペットカルテ管理' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'カルテ一覧' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '最新メディア（写真・動画）' })).toBeVisible()
    await expect(page.getByText('同一一覧で時系列表示')).toBeVisible()
  })

  test('カルテ作成モーダルで施術前・施術後・施術動画の3導線を表示できる', async ({ page }) => {
    await page.goto('/medical-records?tab=list&modal=create', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: '新規カルテ登録' })).toBeVisible()
    await expect(page.getByRole('button', { name: '施術前を撮る' })).toBeVisible()
    await expect(page.getByRole('button', { name: '施術後を撮る' })).toBeVisible()
    await expect(page.getByRole('button', { name: '施術動画を撮る' })).toBeVisible()
  })
})
