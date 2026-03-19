import { test, expect } from '@playwright/test'

test.describe('顧客一覧', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/customers/ltv', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            customer_id: 'customer-001',
            ltv_rank: 'ゴールド',
            annual_sales: 152000,
            visit_count: 12,
            average_spend: 12667,
            option_usage_rate: 75,
          },
          {
            customer_id: 'customer-002',
            ltv_rank: null,
            annual_sales: 0,
            visit_count: 0,
            average_spend: 0,
            option_usage_rate: 0,
          },
        ]),
      })
    })
  })

  test('実運用に近い顧客データを一覧表示できる', async ({ page }) => {
    await page.goto('/customers?tab=list')
    await page.waitForResponse((response) => response.url().includes('/api/customers/ltv') && response.ok())

    await expect(page.getByRole('heading', { name: '顧客管理' })).toBeVisible()
    await expect(page.getByTestId('customers-list')).toBeVisible()
    await expect(page.getByText('全 2 件')).toBeVisible()

    const list = page.getByTestId('customers-list')
    const primaryRow = list.getByTestId('customer-row-customer-001')
    await expect(primaryRow).toContainText('山田 花子')
    await expect(primaryRow).toContainText('無断CXL 2件')
    await expect(primaryRow).toContainText('090-1111-2222')
    await expect(primaryRow).toContainText('連携済み')
    await expect(primaryRow).toContainText('多頭飼い, 噛み癖')
    await expect(primaryRow).toContainText('152,000 円', { timeout: 15000 })

    const fallbackRow = list.getByTestId('customer-row-customer-002')
    await expect(fallbackRow).toContainText('未登録')
    await expect(fallbackRow).toContainText('未連携')
    await expect(fallbackRow).toContainText('なし')
    await expect(fallbackRow).toContainText('スタンダード')
  })

  test('新規顧客モーダルを開ける', async ({ page }) => {
    await page.goto('/customers?tab=list&modal=create')

    await expect(page.getByRole('heading', { name: '新規顧客登録' })).toBeVisible()
    await expect(page.getByLabel('氏名')).toBeVisible()
    await expect(page.getByLabel('電話番号')).toBeVisible()
    await expect(page.getByLabel('来店経路')).toBeVisible()
  })
})
