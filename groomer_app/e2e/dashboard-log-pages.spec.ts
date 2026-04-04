import { expect, test } from '@playwright/test'

test.describe('ダッシュボードログ画面', () => {
  test('通知ログで内訳、失敗理由、絞り込み結果を表示できる', async ({ page }) => {
    await page.goto('/dashboard/notification-logs')

    await expect(page.getByRole('heading', { name: '通知ログ' })).toBeVisible()
    await expect(page.getByText('総件数')).toBeVisible()
    await expect(page.getByText('3 件', { exact: true })).toBeVisible()
    await expect(page.getByText('followup: 1 件')).toBeVisible()
    await expect(page.getByText('line: 2 件')).toBeVisible()
    await expect(page.getByText('failed: 1 件')).toBeVisible()
    await expect(page.getByText('slot_reoffer:line_blocked: 1 件')).toBeVisible()
    await expect(page.getByText('次回予約のご案内')).toBeVisible()
    await expect(page.getByText('山田 花子')).toBeVisible()

    await page.selectOption('select[name="status"]', 'failed')
    await page.getByRole('button', { name: '絞り込む' }).click()

    await expect(page.getByText('キャンセル枠のご案内')).toBeVisible()
    await expect(page.getByText('line_blocked')).toBeVisible()

    await page.fill('input[name="q"]', 'followup:customer-001')
    await page.selectOption('select[name="status"]', 'all')
    await page.getByRole('button', { name: '絞り込む' }).click()

    await expect(page.getByText('次回予約のご案内')).toBeVisible()
    await expect(page.getByText('45日経過したためご連絡しました。')).toBeVisible()
  })

  test('監査ログで要約、フィルタ、JSON詳細を表示できる', async ({ page }) => {
    await page.goto('/dashboard/audit-logs')

    await expect(page.getByRole('heading', { name: '監査ログ' })).toBeVisible()
    await expect(page.getByText('総件数')).toBeVisible()
    await expect(page.getByText('3 件', { exact: true })).toBeVisible()
    await expect(page.getByText('appointment: 1 件')).toBeVisible()
    await expect(page.getByText('updated: 1 件')).toBeVisible()
    await expect(page.getByText('member_portal_link: 1 件')).toBeVisible()
    await expect(page.getByText('顧客=山田 花子, expires_at=2026-03-31T15:00:00.000Z, revoke=1')).toBeVisible()

    await page.getByText('JSONを開く').first().click()
    await expect(page.getByText('"status": "予約済"')).toBeVisible()
    await expect(page.getByText('"status": "受付"')).toBeVisible()
    await expect(page.getByText('"source": "dashboard"')).toBeVisible()

    await page.selectOption('select[name="entity_type"]', 'inventory_movement')
    await page.getByRole('button', { name: '絞り込む' }).click()

    await expect(page.getByText('stocktake-001')).toBeVisible()
    await expect(page.getByRole('row', { name: /stocktake-001/ }).getByText('created', { exact: true })).toBeVisible()
    await expect(page.getByText('payload: source=stocktake, actual_quantity=1, current_stock=2')).toBeVisible()
  })
})
