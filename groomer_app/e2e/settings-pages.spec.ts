import { test, expect } from '@playwright/test'

test.describe('設定画面', () => {
  test('アクセス制御（owner/admin許可・staff拒否）を確認できる', async ({ page }) => {
    await page.goto('/settings?tab=store-ops&e2e_role=owner')
    await expect(page.getByRole('heading', { name: '店舗運用設定' })).toBeVisible()

    await page.goto('/settings?tab=store-ops&e2e_role=admin')
    await expect(page.getByRole('heading', { name: '店舗運用設定' })).toBeVisible()

    await page.goto('/settings?tab=store-ops&e2e_role=staff')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('通知設定の既定値補正と権限表示を確認できる', async ({ page }) => {
    await page.goto('/settings?tab=notifications')

    await expect(page.getByRole('heading', { name: '通知設定' })).toBeVisible()
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
    await expect(page.getByLabel('公開日数')).toHaveValue('5')
    await expect(page.getByLabel('調整時間（分）')).toHaveValue('20')
    await expect(page.getByLabel('予約受付の締切（何分前まで）')).toHaveValue('120')
    await expect(page.getByLabel('競合失敗率 警告閾値（%）')).toHaveValue('12')
    await expect(page.getByLabel('スタッフ偏り率 警告閾値（%）')).toHaveValue('80')
  })

  test('店舗運用設定の初期値を確認できる', async ({ page }) => {
    await page.goto('/settings?tab=store-ops')

    await expect(page.getByRole('heading', { name: '店舗運用設定' })).toBeVisible()
    await expect(page.getByLabel('営業開始時刻（JST 時）')).toHaveValue('9')
    await expect(page.getByLabel('営業終了時刻（JST 時）')).toHaveValue('19')
    await expect(page.getByLabel('定休日・臨時休業日（JST）')).toHaveValue('2026-03-20\n2026-03-21')
    await expect(page.getByLabel('会員証TTL（日）')).toHaveValue('90')
    await expect(page.getByLabel('カルテ一覧の表示件数（最新N件）')).toHaveValue('12')
    await expect(
      page.getByLabel('予約カレンダーで表示範囲外の予約がある場合に自動で表示範囲を広げる')
    ).not.toBeChecked()
  })

  test('電子同意書テンプレ管理を店舗設定タブ内で表示できる', async ({ page }) => {
    await page.goto('/settings?tab=consent-templates')

    await expect(page.getByRole('heading', { name: '電子同意書テンプレ管理' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'テンプレートを作成' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '同意文を有効化' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'テンプレ作成' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: '同意文を有効化' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: '同意書を作成・署名依頼' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: '同意書履歴' })).toHaveCount(0)
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
