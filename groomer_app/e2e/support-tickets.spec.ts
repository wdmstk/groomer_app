import { expect, test } from '@playwright/test'

test.describe('サポート問い合わせ', () => {
  // TRACE-287
  test('support-chat は E2E owner view を表示する', async ({ page }) => {
    await page.goto('/support-chat')
    await expect(page).toHaveURL(/\/support-chat$/)
    await expect(page.getByRole('heading', { name: '問い合わせ' })).toBeVisible()
  })

  // TRACE-020
  test('チケット一覧、起票、コメント追記を表示できる', async ({ page }) => {
    let mode: 'initial' | 'created' | 'commented' = 'initial'

    await page.route('**/api/support-tickets', async (route) => {
      const request = route.request()

      if (request.method() === 'GET') {
        const payload =
          mode === 'initial'
            ? {
                tickets: [
                  {
                    id: 'ticket-001',
                    ticket_no: 128,
                    created_at: '2026-03-16T01:00:00.000Z',
                    last_activity_at: '2026-03-16T01:15:00.000Z',
                    subject: '会計画面で保存エラー',
                    description: '会計待ちから完了にすると保存できないことがあります。',
                    category: 'bug',
                    priority: 'urgent',
                    status: 'in_progress',
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
                        payload: { actor_scope: 'developer', comment: '再現条件を確認中です' },
                        created_at: '2026-03-16T01:15:00.000Z',
                      },
                    ],
                  },
                ],
              }
            : mode === 'created'
              ? {
                  tickets: [
                    {
                      id: 'ticket-002',
                      ticket_no: 129,
                      created_at: '2026-03-16T02:00:00.000Z',
                      last_activity_at: '2026-03-16T02:00:00.000Z',
                      subject: '公開予約の電話番号補正',
                      description: '090-1234-5678 形式でも保存時に正規化したいです。',
                      category: 'feature_request',
                      priority: 'high',
                      status: 'open',
                      events: [
                        {
                          id: 'event-010',
                          event_type: 'created',
                          payload: { actor_role: 'admin' },
                          created_at: '2026-03-16T02:00:00.000Z',
                        },
                      ],
                    },
                    {
                      id: 'ticket-001',
                      ticket_no: 128,
                      created_at: '2026-03-16T01:00:00.000Z',
                      last_activity_at: '2026-03-16T01:15:00.000Z',
                      subject: '会計画面で保存エラー',
                      description: '会計待ちから完了にすると保存できないことがあります。',
                      category: 'bug',
                      priority: 'urgent',
                      status: 'in_progress',
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
                          payload: { actor_scope: 'developer', comment: '再現条件を確認中です' },
                          created_at: '2026-03-16T01:15:00.000Z',
                        },
                      ],
                    },
                  ],
                }
              : {
                  tickets: [
                    {
                      id: 'ticket-002',
                      ticket_no: 129,
                      created_at: '2026-03-16T02:00:00.000Z',
                      last_activity_at: '2026-03-16T02:20:00.000Z',
                      subject: '公開予約の電話番号補正',
                      description: '090-1234-5678 形式でも保存時に正規化したいです。',
                      category: 'feature_request',
                      priority: 'high',
                      status: 'open',
                      events: [
                        {
                          id: 'event-010',
                          event_type: 'created',
                          payload: { actor_role: 'admin' },
                          created_at: '2026-03-16T02:00:00.000Z',
                        },
                        {
                          id: 'event-011',
                          event_type: 'note_added',
                          payload: { actor_role: 'staff', comment: '顧客一覧の入力でも同じ揺れがあります' },
                          created_at: '2026-03-16T02:20:00.000Z',
                        },
                      ],
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
        mode = 'created'
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'チケットを起票しました。' }),
        })
        return
      }

      if (request.method() === 'PATCH') {
        mode = 'commented'
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'コメントを投稿しました。' }),
        })
        return
      }

      await route.continue()
    })

    await page.goto('/support-tickets')

    await expect(page.getByRole('heading', { name: '問い合わせチケット' })).toBeVisible()
    await expect(page.getByText('#128 会計画面で保存エラー')).toBeVisible()
    await expect(page.getByText('不具合 / 緊急')).toBeVisible()
    await expect(page.getByText('対応中')).toBeVisible()
    await expect(page.getByText('開発側 / 再現条件を確認中です')).toBeVisible()

    await page.getByLabel('件名').fill('公開予約の電話番号補正')
    await page.getByLabel('詳細').fill('090-1234-5678 形式でも保存時に正規化したいです。')
    await page.getByLabel('カテゴリ').selectOption('feature_request')
    await page.getByLabel('優先度').selectOption('high')
    await page.getByRole('button', { name: 'チケットを起票' }).click()

    await expect(page.getByText('チケットを起票しました。')).toBeVisible()
    await expect(page.getByText('#129 公開予約の電話番号補正')).toBeVisible()
    await expect(page.getByText('機能要望 / 高')).toBeVisible()
    await expect(page.getByText('未対応')).toBeVisible()

    const createdTicketCard = page
      .locator('div.rounded.border.border-gray-200.p-3')
      .filter({ has: page.getByText('#129 公開予約の電話番号補正') })
      .first()
    await createdTicketCard
      .getByPlaceholder('サポートへの追記コメント')
      .fill('顧客一覧の入力でも同じ揺れがあります')
    await createdTicketCard.getByRole('button', { name: '送信' }).click()

    await expect(page.getByText('コメントを投稿しました。')).toBeVisible()
    await expect(page.getByText('スタッフ / 顧客一覧の入力でも同じ揺れがあります')).toBeVisible()
  })
})
