import { test, expect } from '@playwright/test'

test.describe('公開予約フロー', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/public/reserve/demo-store', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            store: { id: 'demo-store', name: '青空トリミング' },
            menus: [
              { id: 'menu-001', name: 'シャンプー', price: 5500, duration: 60 },
              { id: 'menu-002', name: '歯磨き', price: 1200, duration: 10 },
              { id: 'menu-003', name: 'カット', price: 7800, duration: 90 },
            ],
            instant_menu_ids: ['menu-001', 'menu-002'],
          }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: '予約申請を受け付けました。',
          cancelUrl: 'https://example.com/reserve/cancel?token=cancel-token-001',
          appointmentId: 'appt-public-001',
          groupId: 'group-public-001',
          status: '予約申請',
        }),
      })
    })

    await page.route('**/api/public/reserve/demo-store/slots?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          slots: [
            {
              start_time: '2026-03-20T01:00:00.000Z',
              end_time: '2026-03-20T02:10:00.000Z',
              staff_id: 'staff-001',
            },
            {
              start_time: '2026-03-20T03:00:00.000Z',
              end_time: '2026-03-20T04:10:00.000Z',
              staff_id: 'staff-002',
            },
          ],
        }),
      })
    })

    await page.route('**/api/public/reserve/demo-store/qr-lookup', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          verified: true,
          customer: { full_name: '山田 花子', phone_number: '090-1111-2222' },
          pet: { name: 'こむぎ', breed: 'トイプードル' },
        }),
      })
    })

    await page.route('**/api/public/reserve/cancel', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: '予約をキャンセルしました。',
        }),
      })
    })
  })

  test('公開予約フォームで QR 照合と家族予約サマリーを確認できる', async ({ page }) => {
    await page.goto('/reserve/demo-store')

    await expect(page.getByRole('heading', { name: '予約申請フォーム' })).toBeVisible()
    await expect(page.getByText('店舗: 青空トリミング')).toBeVisible()

    await page.getByRole('textbox', { name: 'お名前 *' }).fill('山田 花子')
    await page.getByRole('textbox', { name: '電話番号' }).fill('090 1111 2222')
    await page.getByRole('textbox', { name: 'メール' }).fill('hanako@example.com')
    await page.getByLabel('ペット名 *').fill('こむぎ')
    await page.getByLabel('犬種').fill('トイプードル')
    await page.getByLabel('性別').selectOption('メス')

    await page
      .getByPlaceholder('{"v":2,"customer_id":"...","pet_id":"...","sig":"..."}')
      .fill('{"v":2,"customer_name":"山田 花子","pet_name":"こむぎ","phone_number":"090-1111-2222","pet_breed":"トイプードル"}')
    await page.getByRole('button', { name: 'QR文字列を適用', exact: true }).click()
    await expect(page.getByText('QRを検証し、既存顧客候補を照合してフォームへ反映しました。')).toBeVisible()

    await page.locator('label', { hasText: 'シャンプー' }).locator('input[type="checkbox"]').check()
    await page.locator('label', { hasText: '歯磨き' }).locator('input[type="checkbox"]').check()

    await expect(page.getByText('選択合計時間: 70 分')).toBeVisible()
    await expect(page.getByText('空き枠候補（即時確定対象メニュー）')).toBeVisible()
    await page.getByRole('button', { name: '03/20 10:00 - 11:10' }).click()
    await expect(page.getByLabel('希望日時 *')).toHaveValue('2026-03-20T10:00')

    await page.getByLabel('連絡事項').fill('多頭飼い。兄弟犬も続けて予約したい。')
    await page.getByRole('button', { name: '予約申請を送信' }).click()

    await expect(page.getByText('予約申請を受け付けました。')).toBeVisible()
    await expect(page.getByText('家族予約の確認')).toBeVisible()
    await expect(page.getByText('希望日時: 2026-03-20T10:00')).toBeVisible()
    await expect(page.getByText('状態: 予約申請')).toBeVisible()
    await expect(page.getByText('https://example.com/reserve/cancel?token=cancel-token-001')).toBeVisible()
  })

  test('即時確定対象外メニューでは希望日時入力メッセージを表示する', async ({ page }) => {
    await page.goto('/reserve/demo-store')

    await page.locator('label', { hasText: 'カット' }).locator('input[type="checkbox"]').check()

    await expect(page.getByText('選択メニューは即時確定枠の対象外です。希望日時を入力して申請してください。')).toBeVisible()
  })

  test('キャンセルページで無効 token と正常キャンセルを確認できる', async ({ page }) => {
    await page.goto('/reserve/cancel')
    await page.getByRole('button', { name: '予約をキャンセルする' }).click()
    await expect(page.getByText('無効なURLです。')).toBeVisible()

    await page.goto('/reserve/cancel?token=cancel-token-001')
    await page.getByRole('button', { name: '予約をキャンセルする' }).click()
    await expect(page.getByText('予約をキャンセルしました。')).toBeVisible()
  })
})
