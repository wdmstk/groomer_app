import { test, expect } from '@playwright/test'

test.describe('施術メニュー一覧', () => {
  // TRACE-338
  test('実運用に近いメニューデータと推奨所要時間を表示できる', async ({ page }) => {
    await page.goto('/service-menus')

    await expect(page.getByRole('heading', { name: '施術メニュー管理' })).toBeVisible()
    await expect(page.getByTestId('service-menus-list')).toBeVisible()
    await expect(page.getByText('推奨更新候補 1 件')).toBeVisible()

    const primaryRow = page.getByTestId('service-menus-list').getByTestId('service-menu-row-menu-001')
    await expect(primaryRow).toContainText('シャンプーコース')
    await expect(primaryRow).toContainText('トリミング')
    await expect(primaryRow).toContainText('8,500 円')
    await expect(primaryRow).toContainText('90 分')
    await expect(primaryRow).toContainText('税込')
    await expect(primaryRow).toContainText('有効')
    await expect(primaryRow).toContainText('対象')
    await expect(primaryRow).toContainText('毛玉が多い場合は追加料金')
    await expect(primaryRow).toContainText('推奨 116 分')

    const fallbackRow = page.getByTestId('service-menus-list').getByTestId('service-menu-row-menu-002')
    await expect(fallbackRow).toContainText('未設定')
    await expect(fallbackRow).toContainText('税込')
    await expect(fallbackRow).toContainText('有効')
    await expect(fallbackRow).toContainText('対象外')
    await expect(fallbackRow).toContainText('なし')
  })

  test('新規メニューモーダルを開ける', async ({ page }) => {
    await page.goto('/service-menus?modal=create')

    await expect(page.getByRole('heading', { name: '新規メニュー登録' })).toBeVisible()
    await expect(page.getByLabel('メニュー名')).toBeVisible()
    await expect(page.getByLabel('価格')).toBeVisible()
    await expect(page.getByLabel('公開予約の即時確定対象')).toBeVisible()
  })
})
