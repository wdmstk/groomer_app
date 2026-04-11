import { expect, test } from '@playwright/test'

test.describe('サポートチャット', () => {
  // TRACE-286
  test('owner view で会話表示と送信導線を確認できる', async ({ page }) => {
    let mode: 'initial' | 'sent' = 'initial'

    await page.route('**/api/support-chat/messages', async (route) => {
      const request = route.request()

      if (request.method() === 'GET') {
        const payload =
          mode === 'initial'
            ? {
                currentUserId: 'owner-001',
                messages: [
                  {
                    id: 'chat-001',
                    sender_user_id: 'dev-001',
                    sender_role: 'developer',
                    sender_name: '開発サポート',
                    message: '会計画面エラーの再現条件を確認しています。',
                    created_at: '2026-03-16T01:00:00.000Z',
                  },
                  {
                    id: 'chat-002',
                    sender_user_id: 'owner-001',
                    sender_role: 'owner',
                    sender_name: '山田 花子',
                    message: '予約完了後の会計確定で止まるケースがあります。',
                    created_at: '2026-03-16T01:05:00.000Z',
                  },
                ],
              }
            : {
                currentUserId: 'owner-001',
                messages: [
                  {
                    id: 'chat-001',
                    sender_user_id: 'dev-001',
                    sender_role: 'developer',
                    sender_name: '開発サポート',
                    message: '会計画面エラーの再現条件を確認しています。',
                    created_at: '2026-03-16T01:00:00.000Z',
                  },
                  {
                    id: 'chat-002',
                    sender_user_id: 'owner-001',
                    sender_role: 'owner',
                    sender_name: '山田 花子',
                    message: '予約完了後の会計確定で止まるケースがあります。',
                    created_at: '2026-03-16T01:05:00.000Z',
                  },
                  {
                    id: 'chat-003',
                    sender_user_id: 'owner-001',
                    sender_role: 'owner',
                    sender_name: '山田 花子',
                    message: '再現した顧客IDは customer-001 です。',
                    created_at: '2026-03-16T01:10:00.000Z',
                  },
                ],
              }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(payload),
        })
        return
      }

      if (request.method() === 'POST') {
        mode = 'sent'
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        })
        return
      }

      await route.continue()
    })

    await page.goto('/support-chat')

    await expect(page.getByRole('heading', { name: '問い合わせ' })).toBeVisible()
    await expect(page.getByText('左が相手、右が自分の発言です。')).toBeVisible()
    await expect(page.getByText('開発サポート')).toBeVisible()
    await expect(page.getByText('会計画面エラーの再現条件を確認しています。')).toBeVisible()
    await expect(page.getByText('山田 花子')).toBeVisible()
    await expect(page.getByText('予約完了後の会計確定で止まるケースがあります。')).toBeVisible()

    await page.getByPlaceholder('問い合わせ内容を入力してください').fill('再現した顧客IDは customer-001 です。')
    await page.getByRole('button', { name: '送信' }).click()

    await expect(page.getByText('再現した顧客IDは customer-001 です。')).toBeVisible()
    await expect(page.getByPlaceholder('問い合わせ内容を入力してください')).toHaveValue('')
  })
})
