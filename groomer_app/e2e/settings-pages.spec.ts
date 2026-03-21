import { test, expect } from '@playwright/test'

test.describe('設定画面', () => {
  test('通知設定の既定値補正と権限表示を確認できる', async ({ page }) => {
    await page.goto('/settings?tab=notifications')

    await expect(page.getByRole('heading', { name: '通知設定' })).toBeVisible()
    await expect(page.getByText('現在のロール: admin / 変更権限: あり（owner/admin）')).toBeVisible()
    await expect(page.getByText('状態: 有効（上限3,000通）')).toBeVisible()

    await expect(page.getByLabel('メールリマインドを有効化')).not.toBeChecked()
    await expect(page.getByLabel('前日リマインド送信時刻（JST 時）')).toHaveValue('23')
    await expect(page.getByLabel('当日リマインド送信時刻（JST 時）')).toHaveValue('0')
    await expect(page.getByLabel('再来促進日数（カンマ区切り）')).toHaveValue('30,90')
    await expect(page.getByLabel('月次上限（通常）')).toHaveValue('1000')
    await expect(page.getByLabel('月次上限（オプション契約時）')).toHaveValue('1000000')
  })

  test('公開予約設定の初期値と除外日を確認できる', async ({ page }) => {
    await page.goto('/settings?tab=public-reserve')

    await expect(page.getByRole('heading', { name: '公開予約設定' })).toBeVisible()
    await expect(page.getByText('現在のロール: admin / 変更権限: あり（owner/admin）')).toBeVisible()

    await expect(page.getByLabel('競合失敗率 警告閾値（%）')).toHaveValue('12')
    await expect(page.getByLabel('スタッフ偏り率 警告閾値（%）')).toHaveValue('80')
    await expect(page.getByLabel('公開日数')).toHaveValue('5')
    await expect(page.getByLabel('バッファ（分）')).toHaveValue('20')
    await expect(page.getByLabel('最小リード時間（分）')).toHaveValue('120')
    await expect(page.getByLabel('除外日（JST）')).toHaveValue('2026-03-20\n2026-03-21')
  })

  test('容量設定の使用量警告と保存フォーム初期値を確認できる', async ({ page }) => {
    await page.goto('/settings?tab=storage')

    await expect(page.getByRole('heading', { name: '容量設定' })).toBeVisible()
    await expect(page.getByText('使用量の取得に失敗したため、暫定値を表示しています: Bad Gateway')).toBeVisible()
    await expect(page.getByText('プラン: standard')).toBeVisible()
    await expect(page.getByText('使用量: 8.50 GB')).toBeVisible()
    await expect(page.getByText('上限: 12.00 GB')).toBeVisible()
    await expect(page.getByLabel('方針')).toHaveValue('cleanup_orphans')
    await expect(page.getByLabel('追加容量（GB）')).toHaveValue('2')
    await expect(page.getByLabel('カスタム上限（MB, 任意）')).toHaveValue('')
  })
})
