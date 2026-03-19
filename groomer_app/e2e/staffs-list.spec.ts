import { test, expect } from '@playwright/test'

test.describe('スタッフ一覧', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/store-invites', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          invites: [
            {
              id: 'invite-001',
              email: 'new-staff@example.com',
              role: 'staff',
              token: 'invite-token-001',
              expires_at: '2026-03-16T02:00:00.000Z',
            },
          ],
        }),
      })
    })
  })

  test('ライトプラン上限と権限ラベル、招待一覧を表示できる', async ({ page }) => {
    await page.goto('/staffs?tab=list')

    await expect(page.getByRole('heading', { name: 'スタッフ管理' })).toBeVisible()
    await expect(page.getByText('ライトプランではスタッフは3人まで登録可能です。')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'スタッフ招待' })).toBeVisible()
    await expect(page.getByText('new-staff@example.com')).toBeVisible()
    await expect(page.getByText('2026/03/16 11:00')).toBeVisible()

    await expect(page.getByTestId('staffs-list')).toBeVisible()
    await expect(page.getByText('全 3 件')).toBeVisible()
    await expect(page.getByText('上限（3人）')).toBeVisible()

    const ownerRow = page.getByTestId('staffs-list').getByTestId('staff-row-staff-001')
    await expect(ownerRow).toContainText('佐藤 未来')
    await expect(ownerRow).toContainText('miku@example.com')
    await expect(ownerRow).toContainText('owner')

    const unlinkedRow = page.getByTestId('staffs-list').getByTestId('staff-row-staff-002')
    await expect(unlinkedRow).toContainText('高橋 彩')
    await expect(unlinkedRow).toContainText('未登録')
    await expect(unlinkedRow).toContainText('未連携')

    const hiddenRow = page.getByTestId('staffs-list').getByTestId('staff-row-staff-003')
    await expect(hiddenRow).toContainText('伊藤 健')
    await expect(hiddenRow).toContainText('非表示')
  })

  test('新規スタッフモーダルを開ける', async ({ page }) => {
    await page.goto('/staffs?tab=list&modal=create')

    await expect(page.getByRole('heading', { name: '新規スタッフ登録' })).toBeVisible()
    await expect(page.getByLabel('氏名')).toBeVisible()
    await expect(page.getByLabel('メールアドレス')).toBeVisible()
    await expect(page.getByLabel('Supabase Auth User ID')).toBeVisible()
  })
})
