import { test, expect } from '@playwright/test'

test.describe('顧客管理β 来店周期アラート', () => {
  // TRACE-001
  test('未着手候補・対応中・対応済テーブルの表示分離を確認できる', async ({ page }) => {
    await page.route('**/api/followups?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tasks: [
            {
              id: 'task-in-progress-1',
              customer_id: 'customer-b',
              pet_id: null,
              source_appointment_id: null,
              last_visit_at: '2026-02-01T00:00:00.000Z',
              recommended_at: '2026-03-01T00:00:00.000Z',
              status: 'in_progress',
              due_on: '2026-03-10',
              snoozed_until: null,
              assigned_user_id: 'user-1',
              resolved_at: null,
              updated_at: '2026-04-01T00:00:00.000Z',
              resolution_note: null,
              recommendation_reason: 'default',
              last_contacted_at: null,
              last_contact_method: null,
              assignee_name: '担当A',
              events: [],
              customers: { full_name: '対応中 顧客', phone_number: '090-0000-0000', line_id: 'line-b' },
              pets: null,
            },
            {
              id: 'task-resolved-1',
              customer_id: 'customer-c',
              pet_id: null,
              source_appointment_id: null,
              last_visit_at: '2026-01-20T00:00:00.000Z',
              recommended_at: '2026-02-20T00:00:00.000Z',
              status: 'resolved_no_need',
              due_on: '2026-02-28',
              snoozed_until: null,
              assigned_user_id: 'user-1',
              resolved_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              resolution_note: '今回は見送り',
              recommendation_reason: 'default',
              last_contacted_at: null,
              last_contact_method: null,
              assignee_name: '担当A',
              events: [],
              customers: { full_name: '対応済 顧客', phone_number: null, line_id: null },
              pets: null,
            },
          ],
          candidates: [
            {
              customer_id: 'customer-a',
              customer_name: '未着手 顧客',
              phone_number: '080-1111-1111',
              line_id: 'line-a',
              pet_id: null,
              source_appointment_id: null,
              suggested_assigned_user_id: 'user-1',
              suggested_assigned_name: '担当A',
              last_visit_at: '2026-02-15T00:00:00.000Z',
              recommended_at: '2026-03-15T00:00:00.000Z',
              recommendation_reason: 'default',
              overdue_days: 14,
            },
          ],
          assignees: [{ user_id: 'user-1', full_name: '担当A' }],
          templates: {
            next_visit_suggestion_line: {
              body: 'test',
            },
          },
        }),
      })
    })

    await page.goto('/customers/manage?view=alerts')

    const unresolvedSection = page.locator('div.rounded.border.bg-white.p-3').filter({
      has: page.getByRole('heading', { name: '未着手候補' }),
    })
    const inProgressSection = page.locator('div.rounded.border.bg-white.p-3').filter({
      has: page.getByRole('heading', { name: '対応中' }),
    })
    const resolvedSection = page.locator('div.rounded.border.bg-white.p-3').filter({
      has: page.getByRole('heading', { name: '対応済' }),
    })

    await expect(unresolvedSection).toContainText('未着手 顧客')
    await expect(unresolvedSection).not.toContainText('対応済 顧客')
    await expect(inProgressSection).toContainText('対応中 顧客')
    await expect(resolvedSection).toContainText('対応済 顧客')
  })

  // TRACE-002
  test('対象期間フィルターで対応済一覧が切り替わる（全期間は古い完了も表示）', async ({ page }) => {
    const oldResolvedTask = {
      id: 'task-resolved-old',
      customer_id: 'customer-old',
      pet_id: null,
      source_appointment_id: null,
      last_visit_at: '2025-12-01T00:00:00.000Z',
      recommended_at: '2025-12-15T00:00:00.000Z',
      status: 'resolved_no_need',
      due_on: '2025-12-20',
      snoozed_until: null,
      assigned_user_id: 'user-1',
      resolved_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      resolution_note: '旧対応',
      recommendation_reason: 'default',
      last_contacted_at: null,
      last_contact_method: null,
      assignee_name: '担当A',
      events: [],
      customers: { full_name: '古い対応済 顧客', phone_number: null, line_id: null },
      pets: null,
    }

    await page.route('**/api/followups?**', async (route) => {
      const url = new URL(route.request().url())
      const windowDays = url.searchParams.get('window_days')
      const tasks = windowDays === 'all' || windowDays === null ? [oldResolvedTask] : []

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tasks,
          candidates: [],
          assignees: [{ user_id: 'user-1', full_name: '担当A' }],
          templates: {
            next_visit_suggestion_line: {
              body: 'test',
            },
          },
        }),
      })
    })

    await page.goto('/customers/manage?view=alerts')

    const resolvedSection = page.locator('div.rounded.border.bg-white.p-3').filter({
      has: page.getByRole('heading', { name: '対応済' }),
    })

    await expect(resolvedSection).toContainText('古い対応済 顧客')

    await page.getByLabel('対象期間').selectOption('30')
    await expect(resolvedSection).not.toContainText('古い対応済 顧客')

    await page.getByLabel('対象期間').selectOption('7')
    await expect(resolvedSection).not.toContainText('古い対応済 顧客')

    await page.getByLabel('対象期間').selectOption('all')
    await expect(resolvedSection).toContainText('古い対応済 顧客')
  })

  // TRACE-003
  test('再フォロー期限を超えた対応済は未着手候補へ戻し、対応済からは外す', async ({ page }) => {
    await page.route('**/api/followups?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tasks: [
            {
              id: 'task-resolved-expired',
              customer_id: 'customer-refollow',
              pet_id: null,
              source_appointment_id: null,
              last_visit_at: '2026-01-20T00:00:00.000Z',
              recommended_at: '2026-02-20T00:00:00.000Z',
              status: 'resolved_no_need',
              due_on: '2026-02-28',
              snoozed_until: null,
              assigned_user_id: 'user-1',
              resolved_at: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000).toISOString(),
              resolution_note: '今回は見送り',
              recommendation_reason: 'default',
              last_contacted_at: null,
              last_contact_method: null,
              assignee_name: '担当A',
              events: [],
              customers: { full_name: '再フォロー対象 顧客', phone_number: '090-3333-3333', line_id: 'line-r' },
              pets: null,
            },
          ],
          candidates: [
            {
              customer_id: 'customer-refollow',
              customer_name: '再フォロー対象 顧客',
              phone_number: '090-3333-3333',
              line_id: 'line-r',
              pet_id: null,
              source_appointment_id: null,
              suggested_assigned_user_id: 'user-1',
              suggested_assigned_name: '担当A',
              last_visit_at: '2026-01-20T00:00:00.000Z',
              recommended_at: '2026-02-20T00:00:00.000Z',
              recommendation_reason: 'default',
              overdue_days: 38,
            },
          ],
          assignees: [{ user_id: 'user-1', full_name: '担当A' }],
          templates: {
            next_visit_suggestion_line: {
              body: 'test',
            },
          },
        }),
      })
    })

    await page.goto('/customers/manage?view=alerts')

    const unresolvedSection = page.locator('div.rounded.border.bg-white.p-3').filter({
      has: page.getByRole('heading', { name: '未着手候補' }),
    })
    const resolvedSection = page.locator('div.rounded.border.bg-white.p-3').filter({
      has: page.getByRole('heading', { name: '対応済' }),
    })

    await expect(unresolvedSection).toContainText('再フォロー対象 顧客')
    await expect(resolvedSection).not.toContainText('再フォロー対象 顧客')
  })
})
