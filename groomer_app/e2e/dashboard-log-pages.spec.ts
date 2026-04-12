import { expect, test } from '@playwright/test'

test.describe('ダッシュボードログ画面', () => {
  // TRACE-313
  test('通知ログで内訳、失敗理由、絞り込み結果を表示できる', async ({ page }) => {
    await page.goto('/dashboard/notification-logs')
    const table = page.getByTestId('notification-logs-table')

    await expect(page.getByRole('heading', { name: '通知ログ' })).toBeVisible()
    await expect(page.getByText('総件数')).toBeVisible()
    await expect(page.getByText('3 件', { exact: true })).toBeVisible()
    await expect(page.getByText('followup: 1 件')).toBeVisible()
    await expect(page.getByText('line: 2 件')).toBeVisible()
    await expect(page.getByText('failed: 1 件')).toBeVisible()
    await expect(page.getByText('slot_reoffer:line_blocked: 1 件')).toBeVisible()
    await expect(table.getByText('次回予約のご案内', { exact: true })).toBeVisible()
    await expect(table.getByText('山田 花子', { exact: true })).toBeVisible()

    await page.selectOption('select[name="status"]', 'failed')
    await page.getByRole('button', { name: '絞り込む' }).click()

    await expect(table.getByText('キャンセル枠のご案内', { exact: true })).toBeVisible()
    await expect(page.getByText('line_blocked')).toBeVisible()

    await page.fill('input[name="q"]', 'followup:customer-001')
    await page.selectOption('select[name="status"]', 'all')
    await page.getByRole('button', { name: '絞り込む' }).click()

    await expect(table.getByText('次回予約のご案内', { exact: true })).toBeVisible()
    await expect(table.getByText('45日経過したためご連絡しました。', { exact: true })).toBeVisible()
  })

  // TRACE-312
  test('監査ログで要約、フィルタ、JSON詳細を表示できる', async ({ page }) => {
    await page.goto('/dashboard/audit-logs')
    const table = page.getByTestId('audit-logs-table')

    await expect(page.getByRole('heading', { name: '監査ログ' })).toBeVisible()
    await expect(page.getByText('総件数')).toBeVisible()
    await expect(page.getByText('3 件', { exact: true })).toBeVisible()
    await expect(page.getByText('appointment: 1 件')).toBeVisible()
    await expect(page.getByText('updated: 1 件')).toBeVisible()
    await expect(page.getByText('member_portal_link: 1 件')).toBeVisible()
    await expect(
      table.getByText('顧客=山田 花子, expires_at=2026-03-31T15:00:00.000Z, revoke=1')
    ).toBeVisible()

    await page.getByTestId('audit-log-json-audit-001').locator('summary').click()
    const jsonSection = page.getByTestId('audit-log-json-audit-001')
    await expect(jsonSection.getByText('"status": "予約済"')).toBeVisible()
    await expect(jsonSection.getByText('"status": "受付"')).toBeVisible()
    await expect(jsonSection.getByText('"source": "dashboard"')).toBeVisible()

    await page.selectOption('select[name="entity_type"]', 'inventory_movement')
    await page.getByRole('button', { name: '絞り込む' }).click()

    const filteredRow = page.getByTestId('audit-log-row-audit-003')
    await expect(filteredRow).toContainText('stocktake-001')
    await expect(filteredRow).toContainText('created')
    await expect(filteredRow).toContainText('payload: source=stocktake, actual_quantity=1, current_stock=2')
  })
})
