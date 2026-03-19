import { test, expect } from '@playwright/test'

test.describe('予約一覧', () => {
  test('実運用に近い予約データで一覧導線を表示できる', async ({ page }) => {
    await page.goto('/appointments?tab=list')

    await expect(page.getByRole('heading', { name: '予約管理' })).toBeVisible()
    await expect(page.getByTestId('appointments-list')).toBeVisible()
    await expect(page.getByText('全 4 件')).toBeVisible()

    const list = page.getByTestId('appointments-list')
    const pendingRow = list.getByTestId('appointment-row-appt-pending-001')
    await expect(pendingRow).toContainText('山田 花子')
    await expect(pendingRow).toContainText('モカ')
    await expect(pendingRow).toContainText('噛み癖あり。口周りは短時間で。')
    await expect(list.getByTestId('appointment-confirm-appt-pending-001')).toBeVisible()

    const bookedRow = list.getByTestId('appointment-row-appt-booked-002')
    await expect(bookedRow).toContainText('未登録')
    await expect(list.getByTestId('appointment-status-action-appt-booked-002')).toContainText('受付開始')

    const completedRow = list.getByTestId('appointment-row-appt-completed-003')
    await expect(completedRow).toContainText('完了')
    await expect(list.getByTestId('appointment-followup-appt-completed-003')).toBeVisible()

    const fallbackRow = list.getByTestId('appointment-row-appt-fallback-004')
    await expect(fallbackRow).toContainText('未登録')
    await expect(fallbackRow).toContainText('会計待ち')
    await expect(fallbackRow).toContainText('会計待ち:')
  })

  test('新規登録と次回予約のモーダル初期表示が機能する', async ({ page }) => {
    await page.goto('/appointments?tab=list&modal=create')

    await expect(page.getByRole('heading', { name: '新規予約登録' })).toBeVisible()
    await expect(page.locator('select[name="customer_id"]')).toBeVisible()
    await expect(page.locator('select[name="pet_id"]')).toBeVisible()
    await expect(page.getByText('予約メニュー (複数選択)')).toBeVisible()

    await page.goto('/appointments?tab=list')
    await page.getByTestId('appointments-list').getByTestId('appointment-followup-appt-completed-003').click()

    await expect(page.getByText('次回予約の推奨来店日を自動セットしました')).toBeVisible()
    await expect(page.locator('select[name="customer_id"]')).toHaveValue('customer-003')
    await expect(page.locator('select[name="pet_id"]')).toHaveValue('pet-003')
  })
})
