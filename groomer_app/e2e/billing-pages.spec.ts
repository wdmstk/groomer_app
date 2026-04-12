import { test, expect } from '@playwright/test'

test.describe('課金画面', () => {
  test('課金サマリーと料金内訳、要対応アラートを表示できる', async ({ page }) => {
    await page.goto('/billing')

    await expect(page.getByRole('heading', { name: '決済管理' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: '要対応' })).toBeVisible()
    await expect(page.getByText('支払い遅延（past_due）状態です。')).toBeVisible()
    await expect(page.locator('p', { hasText: 'プラン' }).locator('span').filter({ hasText: 'スタンダード' })).toBeVisible()
    await expect(page.locator('p', { hasText: '請求周期' }).locator('span').filter({ hasText: '月払い' })).toBeVisible()
    await expect(page.locator('p', { hasText: '基本+オプション請求額' }).locator('span').filter({ hasText: '9800 円' })).toBeVisible()
    await expect(page.locator('p', { hasText: '優先決済手段' }).locator('span').filter({ hasText: 'stripe' })).toBeVisible()
    await expect(page.locator('p', { hasText: '基本+オプション契約終了日' }).getByText('2026/04/01 00:00')).toBeVisible()
    await expect(page.locator('p', { hasText: 'past_due開始日時' }).getByText('2026/03/15 10:00')).toBeVisible()
    await expect(page.getByText('通知強化オプション')).toBeVisible()
    await expect(page.getByText('追加容量料金（月額）')).toBeVisible()
    await expect(page.getByText('20 GB')).toBeVisible()
    await expect(page.getByTestId('billing-legal-agreement')).toHaveCount(1)
  })

  // TRACE-309
  test('課金履歴で通知従量課金と webhook 失敗を表示できる', async ({ page }) => {
    await page.goto('/billing?tab=history')

    await expect(page.getByRole('heading', { name: '決済履歴' })).toBeVisible()
    await expect(page.getByText('通知従量課金（月次内訳）')).toBeVisible()
    await expect(page.getByRole('cell', { name: '2026/03', exact: true })).toBeVisible()
    await expect(page.getByText('3,200')).toBeVisible()
    await expect(page.getByText('1,000 円')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Webhook受信履歴' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'invoice.payment_failed', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'card_declined', exact: true }).first()).toBeVisible()
    await expect(page.getByRole('cell', { name: '容量追加 決済完了' }).first()).toBeVisible()
  })
})
