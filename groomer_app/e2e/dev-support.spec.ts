import { expect, test } from '@playwright/test'

test.describe('開発者向けサポート', () => {
  test('dev/support-chat で店舗スレッドと返信導線を確認できる', async ({ page }) => {
    let chatMode: 'initial' | 'sent' = 'initial'

    await page.route('**/api/dev/support-chat/threads', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          threads: [
            {
              store_id: 'store-001',
              store_name: '青山本店',
              is_active: true,
              last_message:
                chatMode === 'initial'
                  ? '会計画面エラーの再現条件を確認しています。'
                  : 'customer-001 の予約で再現しました。',
              last_message_at: '2026-03-16T01:10:00.000Z',
            },
            {
              store_id: 'store-002',
              store_name: '吉祥寺店',
              is_active: false,
              last_message: null,
              last_message_at: null,
            },
          ],
        }),
      })
    })

    await page.route('**/api/dev/support-chat/messages?store_id=*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages:
            chatMode === 'initial'
              ? [
                  {
                    id: 'dev-chat-001',
                    sender_user_id: 'owner-001',
                    sender_role: 'owner',
                    sender_name: '青山本店',
                    message: '会計画面エラーの再現条件を確認しています。',
                    created_at: '2026-03-16T01:00:00.000Z',
                  },
                ]
              : [
                  {
                    id: 'dev-chat-001',
                    sender_user_id: 'owner-001',
                    sender_role: 'owner',
                    sender_name: '青山本店',
                    message: '会計画面エラーの再現条件を確認しています。',
                    created_at: '2026-03-16T01:00:00.000Z',
                  },
                  {
                    id: 'dev-chat-002',
                    sender_user_id: 'dev-001',
                    sender_role: 'developer',
                    sender_name: 'サポート',
                    message: 'customer-001 の予約で再現しました。',
                    created_at: '2026-03-16T01:10:00.000Z',
                  },
                ],
        }),
      })
    })

    await page.route('**/api/dev/support-chat/messages', async (route) => {
      if (route.request().method() === 'POST') {
        chatMode = 'sent'
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('/dev/support-chat')

    await expect(page.getByRole('heading', { name: '店舗問い合わせチャット' })).toBeVisible()
    await expect(page.getByRole('button', { name: /青山本店/ }).first()).toBeVisible()
    await expect(page.getByText('ステータス: 有効')).toBeVisible()
    await expect(
      page
        .locator('div.h-\\[420px\\].overflow-y-auto')
        .getByText('会計画面エラーの再現条件を確認しています。')
    ).toBeVisible()

    await page.getByPlaceholder('返信メッセージを入力').fill('customer-001 の予約で再現しました。')
    await page.getByRole('button', { name: '送信' }).click()

    await expect(
      page.locator('div.h-\\[420px\\].overflow-y-auto').getByText('customer-001 の予約で再現しました。')
    ).toBeVisible()
    await expect(page.getByPlaceholder('返信メッセージを入力')).toHaveValue('')
  })

  test('dev/support-tickets で店舗切替、ステータス更新、返信導線を確認できる', async ({ page }) => {
    let ticketMode: 'initial' | 'updated' = 'initial'

    await page.route('**/api/dev/support-tickets/threads', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          threads: [
            {
              store_id: 'store-001',
              store_name: '青山本店',
              is_active: true,
              open_ticket_count: 2,
              last_ticket_subject: '会計画面で保存エラー',
              last_activity_at: '2026-03-16T01:20:00.000Z',
            },
            {
              store_id: 'store-002',
              store_name: '吉祥寺店',
              is_active: false,
              open_ticket_count: 1,
              last_ticket_subject: '公開予約の電話番号補正',
              last_activity_at: '2026-03-16T01:00:00.000Z',
            },
          ],
        }),
      })
    })

    await page.route('**/api/dev/support-tickets?store_id=*', async (route) => {
      const url = new URL(route.request().url())
      const storeId = url.searchParams.get('store_id')
      const tickets =
        storeId === 'store-001'
          ? ticketMode === 'initial'
            ? [
                {
                  id: 'ticket-001',
                  ticket_no: 128,
                  subject: '会計画面で保存エラー',
                  category: 'bug',
                  priority: 'urgent',
                  status: 'open',
                  created_at: '2026-03-16T01:00:00.000Z',
                  last_activity_at: '2026-03-16T01:20:00.000Z',
                  events: [
                    {
                      id: 'event-001',
                      event_type: 'created',
                      payload: { actor_role: 'owner' },
                      created_at: '2026-03-16T01:00:00.000Z',
                    },
                  ],
                },
              ]
            : [
                {
                  id: 'ticket-001',
                  ticket_no: 128,
                  subject: '会計画面で保存エラー',
                  category: 'bug',
                  priority: 'urgent',
                  status: 'resolved',
                  created_at: '2026-03-16T01:00:00.000Z',
                  last_activity_at: '2026-03-16T01:30:00.000Z',
                  events: [
                    {
                      id: 'event-001',
                      event_type: 'created',
                      payload: { actor_role: 'owner' },
                      created_at: '2026-03-16T01:00:00.000Z',
                    },
                    {
                      id: 'event-002',
                      event_type: 'note_added',
                      payload: { actor_scope: 'developer', comment: '修正版をデプロイしました' },
                      created_at: '2026-03-16T01:30:00.000Z',
                    },
                  ],
                },
              ]
          : []

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tickets }),
      })
    })

    await page.route('**/api/dev/support-tickets', async (route) => {
      if (route.request().method() === 'PATCH') {
        ticketMode = 'updated'
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'ok' }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('/dev/support-tickets')

    await expect(page.getByRole('heading', { name: 'サポートチケット（開発者）' })).toBeVisible()
    await expect(page.getByLabel('店舗')).toHaveValue('store-001')
    await expect(page.getByText('#128 会計画面で保存エラー')).toBeVisible()
    await expect(page.getByText('不具合 / 緊急 / 未対応')).toBeVisible()

    const ticketCard = page
      .locator('div.rounded.border.border-gray-200.p-3')
      .filter({ has: page.getByText('#128 会計画面で保存エラー') })
      .first()
    await ticketCard.locator('select').first().selectOption('resolved')
    await expect(page.getByText('チケットを更新しました。')).toBeVisible()
    await expect(page.getByText('不具合 / 緊急 / 解決済み')).toBeVisible()

    await ticketCard.getByPlaceholder('店舗へ返信コメント').fill('修正版をデプロイしました')
    await ticketCard.getByRole('button', { name: '送信' }).click()

    await expect(page.getByText('開発側 / 修正版をデプロイしました')).toBeVisible()
  })
})
