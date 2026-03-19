import { test, expect } from '@playwright/test'

test.describe('会計一覧', () => {
  test('実運用に近い会計データを一覧表示できる', async ({ page }) => {
    await page.goto('/payments?tab=list')

    await expect(page.getByRole('heading', { name: '会計管理' })).toBeVisible()
    await expect(page.getByTestId('payments-list')).toBeVisible()
    await expect(page.getByText('全 2 件')).toBeVisible()

    const list = page.getByTestId('payments-list')
    const paidRow = list.getByTestId('payment-row-payment-001')
    await expect(paidRow).toContainText('山田 花子')
    await expect(paidRow).toContainText('2026/03/16 10:00 / 山田 花子 / こむぎ')
    await expect(paidRow).toContainText('8,500 円')
    await expect(paidRow).toContainText('会計済')
    await expect(paidRow).toContainText('カード')
    await expect(paidRow).toContainText('2026/03/16 12:30')
    await expect(paidRow).toContainText('印刷')

    const unpaidRow = list.getByTestId('payment-row-payment-002')
    await expect(unpaidRow).toContainText('未登録')
    await expect(unpaidRow).toContainText('2026/03/16 13:00 / 未登録 / 未登録')
    await expect(unpaidRow).toContainText('2,750 円')
    await expect(unpaidRow).toContainText('未会計')
    await expect(unpaidRow).toContainText('現金')
    await expect(unpaidRow).toContainText('未払い')
    await expect(unpaidRow).toContainText('なし')
  })

  test('新規会計モーダルを開ける', async ({ page }) => {
    await page.goto('/payments?tab=list&modal=create&appointment_id=appt-003')

    await expect(page.getByRole('heading', { name: '新規会計登録' })).toBeVisible()
    await expect(page.locator('select[name="appointment_id"]')).toBeVisible()
    await expect(page.getByLabel('支払方法')).toBeVisible()
    await expect(page.getByLabel('割引額 (任意)')).toBeVisible()
    await expect(page.getByText('合計見込み: 6,700 円')).toBeVisible()
  })

  test('領収書ページで施術内訳と支払情報を確認できる', async ({ page }) => {
    await page.goto('/receipts/payment-001')

    await expect(page.getByTestId('receipt-page')).toBeVisible()
    await expect(page.getByRole('heading', { name: '領収書' })).toBeVisible()
    await expect(page.getByText('No. payment-001')).toBeVisible()
    await expect(page.getByText('宛名: 山田 花子 様')).toBeVisible()
    await expect(page.getByText('支払方法: カード')).toBeVisible()
    await expect(page.getByText('支払ステータス: 支払済')).toBeVisible()
    await expect(page.getByText('支払日時: 2026/03/16 12:30')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'トリミングコース' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '毛玉取り' })).toBeVisible()
    await expect(page.getByText('小計: 8,000 円')).toBeVisible()
    await expect(page.getByText('税額: 800 円')).toBeVisible()
    await expect(page.getByText('割引: 300 円')).toBeVisible()
    await expect(page.getByText('合計: 8,500 円')).toBeVisible()
    await expect(page.getByText('備考: 次回予約で毛玉取り提案')).toBeVisible()
  })
})
