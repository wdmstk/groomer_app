import { test, expect } from '@playwright/test'

test.describe('予約カレンダー', () => {
  test('週表示で予約申請とスタッフ別の予定を確認できる', async ({ page }) => {
    await page.goto('/appointments?tab=calendar&delay_alert_fixture=1')

    await expect(page.getByRole('heading', { name: '予約管理' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '予約カレンダー' })).toBeVisible()
    await expect(page.getByText('遅延影響アラート: 終了予定 03/16 11:00 以降')).toBeVisible()
    await expect(page.getByText('+15分: 2件影響 (11:15 モカ (山田 花子))')).toBeVisible()

    await page.getByRole('button', { name: '週', exact: true }).click()

    await expect(page.getByText('予約申請')).toBeVisible()
    await expect(page.getByText('確定: 佐藤 未来')).toBeVisible()
    await expect(page.getByText('確定: 高橋 彩')).toBeVisible()
    await expect(page.getByText('モカ')).toBeVisible()
  })

  test('日表示へ切り替えて日別タイムテーブルを確認できる', async ({ page }) => {
    await page.goto('/appointments?tab=calendar')

    const dayModeButton = page.getByRole('button', { name: '日', exact: true })
    await dayModeButton.click()

    await expect(dayModeButton).toHaveClass(/bg-blue-600/)
  })
})
