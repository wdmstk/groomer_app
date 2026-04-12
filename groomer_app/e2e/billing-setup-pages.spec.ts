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

test.describe('課金ガード/移行ページ', () => {
  // TRACE-301
  test('billing-required で決済導線と案内を表示できる', async ({ page }) => {
    await gotoStable(page, '/billing-required')

    await expect(page.getByRole('heading', { level: 1, name: 'お支払い設定が必要です' })).toBeVisible()
    await expect(page.getByText('利用継続のため、下記から決済方法を選択してください。')).toBeVisible()
    await expect(page.getByRole('button', { name: 'クレジットカード（Stripe）' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'キャリア決済（KOMOJU）' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'ログアウト' })).toBeVisible()
  })

  // TRACE-302
  test('billing-success 通常モードで標準メッセージを表示する', async ({ page }) => {
    await gotoStable(page, '/billing/success')

    await expect(page.getByRole('heading', { level: 1, name: '決済処理を受け付けました' })).toBeVisible()
    await expect(page.getByText('ステータス反映まで数秒〜数分かかる場合があります。')).toBeVisible()
    await expect(page.getByRole('link', { name: 'ダッシュボードへ' })).toBeVisible()
    await expect(page.getByRole('link', { name: '決済画面へ戻る' })).toBeVisible()
  })

  // TRACE-303
  test('billing-success setup-assistance モードで専用メッセージを表示する', async ({ page }) => {
    await gotoStable(page, '/billing/success?mode=setup-assistance')
    await expect(page.getByText('初期設定代行の申込を受け付けました。運営側で確認後、設定作業を開始します。')).toBeVisible()
  })

  // TRACE-304
  test('billing-success storage-addon モードで専用メッセージを表示する', async ({ page }) => {
    await gotoStable(page, '/billing/success?mode=storage-addon')
    await expect(page.getByText('容量追加の決済を受け付けました。反映まで数秒〜数分かかる場合があります。')).toBeVisible()
  })

  // TRACE-305
  test('dashboard setup-store はクエリを保持して settings?tab=setup-store へリダイレクトする', async ({ page }) => {
    await gotoStable(page, '/dashboard/setup-store?next=%2Fdashboard&tab=legacy')

    const current = new URL(page.url())
    expect(current.pathname).toBe('/settings')
    expect(current.searchParams.get('tab')).toBe('setup-store')
    expect(current.searchParams.get('next')).toBe('/dashboard')
  })

  // TRACE-306
  test('settings setup-store はクエリを保持して tab を setup-store に正規化する', async ({ page }) => {
    await gotoStable(page, '/settings/setup-store?from=sidebar&tab=list')

    const current = new URL(page.url())
    expect(current.pathname).toBe('/settings')
    expect(current.searchParams.get('tab')).toBe('setup-store')
    expect(current.searchParams.get('from')).toBe('sidebar')
  })
})
