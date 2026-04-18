import { expect, test } from '@playwright/test'

test.describe('スタッフ管理の勤怠周辺', () => {
  test('スタッフ一覧タブの並びと招待カード位置が正しい', async ({ page }) => {
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

    await page.goto('/staffs?tab=list')

    const tabBar = page.locator('div.inline-flex.min-w-full.gap-2.rounded-2xl').first()
    await expect(tabBar).toBeVisible()
    const tabLinks = tabBar.getByRole('link')
    await expect(tabLinks).toHaveCount(6)
    const tabTexts = (await tabLinks.allTextContents()).map((text) => text.trim())
    expect(tabTexts).toEqual([
      'スタッフ一覧',
      'シフト設定',
      'シフト管理',
      'シフト一覧',
      'シフト変更履歴',
      '勤怠管理',
    ])

    const tabBarBox = await tabBar.boundingBox()
    const inviteHeading = page.getByRole('heading', { name: 'スタッフ招待' })
    await expect(inviteHeading).toBeVisible()
    const inviteBox = await inviteHeading.boundingBox()

    expect(tabBarBox).toBeTruthy()
    expect(inviteBox).toBeTruthy()
    expect((inviteBox?.y ?? 0) > (tabBarBox?.y ?? 0)).toBeTruthy()
  })

  test('勤怠管理(月次)で日次テーブルを表示できる', async ({ page }) => {
    await page.goto('/staffs?tab=attendance-records&attendance_month=2026-04&attendance_staff_id=staff-001')

    await expect(page.getByRole('heading', { name: 'スタッフ管理' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '勤怠管理' })).toBeVisible()

    await expect(page.getByRole('columnheader', { name: '日付' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '曜日' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '出勤' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '退勤' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '休憩開始' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '休憩終了' })).toBeVisible()

    await expect(page.getByRole('link', { name: '前月' })).toBeVisible()
    await expect(page.getByRole('link', { name: '次月' })).toBeVisible()
    await expect(page.getByRole('button', { name: '表示更新' })).toBeVisible()

    await expect(page.locator('tbody tr').first()).toBeVisible()
    await expect(page.getByRole('cell', { name: '2026-04-13' }).first()).toBeVisible()
  })
})
