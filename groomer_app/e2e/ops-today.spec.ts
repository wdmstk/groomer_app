import { expect, test } from '@playwright/test'

test.describe('モバイル当日運用', () => {
  // TRACE-336
  test('KPI、予約カード、固定アクションを表示できる', async ({ page }) => {
    await page.goto('/ops/today')

    await expect(page.getByRole('heading', { name: '当日運用（モバイル）' })).toBeVisible()
    await expect(page.getByText('遷移平均時間')).toBeVisible()
    await expect(page.getByText('90 分')).toBeVisible()
    await expect(page.getByText('遅延件数')).toBeVisible()
    await expect(page.getByText('2 件')).toBeVisible()
    await expect(page.getByText('差し戻し回数（本日）')).toBeVisible()
    await expect(page.getByText('1 件')).toBeVisible()

    const list = page.getByTestId('ops-today-list')

    const bookedCard = list.getByTestId('ops-card-ops-appt-001')
    await expect(bookedCard).toContainText('10:50 - 12:20')
    await expect(bookedCard).toContainText('モカ')
    await expect(bookedCard).toContainText('予約済')
    await expect(bookedCard).toContainText('顧客: 山田 花子')
    await expect(bookedCard).toContainText('担当: 佐藤 トリマー')
    await expect(bookedCard).toContainText('未会計')
    await expect(bookedCard).toContainText('カルテ未作成')
    await expect(bookedCard).toContainText('受付開始')
    await expect(bookedCard).toContainText('LINE送信（顧客編集）')

    const waitingCard = list.getByTestId('ops-card-ops-appt-002')
    await expect(waitingCard).toContainText('会計待ち')
    await expect(waitingCard).toContainText('高橋 ケア')
    await expect(waitingCard).toContainText('会計')
    await expect(waitingCard).toContainText('LINE ID登録')

    const completedCard = list.getByTestId('ops-card-ops-appt-003')
    await expect(completedCard).toContainText('完了')
    await expect(completedCard).toContainText('差し戻し')
    await expect(completedCard).not.toContainText('未会計')
    await expect(completedCard).not.toContainText('カルテ未作成')

    await expect(page.getByRole('link', { name: '当日ダッシュボード' })).toBeVisible()
    await expect(page.getByRole('link', { name: '会計を開く' })).toBeVisible()
  })
})
