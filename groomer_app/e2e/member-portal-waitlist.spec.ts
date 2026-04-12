import { expect, test } from '@playwright/test'

test.describe('会員ポータル空き枠待ち', () => {
  // TRACE-335
  test('会員ポータルから空き枠待ちを登録して解除できる', async ({ page }) => {
    let saved = false

    await page.route('**/api/public/member-portal/e2e-token/waitlist', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            waitlist: saved
              ? {
                  id: 'waitlist-e2e-001',
                  pet_id: 'pet-001',
                  preferred_menu: 'シャンプー\nカット',
                  preferred_staff_id: 'staff-001',
                  channel: 'line',
                  desired_from: '2026-04-08T01:00:00.000Z',
                  desired_to: '2026-04-08T03:00:00.000Z',
                  notes: '平日午前希望',
                  created_at: '2026-04-07T00:00:00.000Z',
                  updated_at: '2026-04-07T00:10:00.000Z',
                }
              : null,
            pets: [{ id: 'pet-001', name: 'こむぎ' }],
            staffs: [{ id: 'staff-001', full_name: '佐藤 トリマー' }],
            serviceMenus: [
              { id: 'menu-001', name: 'シャンプー', duration: 60 },
              { id: 'menu-002', name: 'カット', duration: 90 },
            ],
            defaultChannel: 'line',
          }),
        })
        return
      }

      if (method === 'POST') {
        saved = true
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            message: '空き枠待ちを登録しました。',
            waitlist: {
              id: 'waitlist-e2e-001',
              pet_id: 'pet-001',
              preferred_menu: 'シャンプー\nカット',
              preferred_staff_id: 'staff-001',
              channel: 'line',
              desired_from: '2026-04-08T01:00:00.000Z',
              desired_to: '2026-04-08T03:00:00.000Z',
              notes: '平日午前希望',
              created_at: '2026-04-07T00:00:00.000Z',
              updated_at: '2026-04-07T00:10:00.000Z',
            },
          }),
        })
        return
      }

      if (method === 'DELETE') {
        saved = false
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            message: '空き枠待ちを解除しました。',
          }),
        })
        return
      }

      await route.fallback()
    })

    await page.goto('/member-portal-waitlist-e2e')

    await expect(page.getByRole('heading', { name: '空き枠待ち登録' })).toBeVisible()
    await expect(page.getByText('キャンセル枠が出たときの優先案内を希望する場合、ここから登録できます。')).toBeVisible()

    await page.getByLabel('ペット').selectOption('pet-001')
    await page.getByLabel('希望担当').selectOption('staff-001')
    await page.getByLabel('希望開始').fill('2026-04-08T10:00')
    await page.getByLabel('希望終了').fill('2026-04-08T12:00')
    await page.getByLabel('メモ').fill('平日午前希望')
    await page.getByLabel('シャンプー (60分)').check()
    await page.getByLabel('カット (90分)').check()

    await page.getByRole('button', { name: '空き枠待ちを登録' }).click()

    await expect(page.getByText('空き枠待ちを登録しました。')).toBeVisible()
    await expect(page.getByText('登録済み: 最終更新')).toBeVisible()
    await expect(page.getByRole('button', { name: '登録を解除' })).toBeVisible()

    await page.getByRole('button', { name: '登録を解除' }).click()
    await expect(page.getByText('空き枠待ちを解除しました。')).toBeVisible()
    await expect(page.getByRole('button', { name: '空き枠待ちを登録' })).toBeVisible()
  })
})
