import { expect, test, type Page } from '@playwright/test'

async function gotoStable(page: Page, url: string) {
  let lastError: unknown = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      return
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes('net::ERR_ABORTED') || attempt === 2) throw error
      await page.waitForTimeout(300)
    }
  }
  throw lastError
}

test.describe('ダッシュボード画面', () => {
  test('overview と followups タブで主要KPIと優先顧客を表示できる', async ({ page }) => {
    await gotoStable(page, '/dashboard')

    await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible()
    await expect(page.getByText('本日の予約件数')).toBeVisible()
    await expect(page.getByText('15,800 円')).toBeVisible()
    await expect(page.getByText('11,200 円')).toBeVisible()
    await expect(page.getByText('優先対応 5 件')).toBeVisible()
    await expect(page.getByText('高リスク 1 件 / 未着手 1 件')).toBeVisible()
    await expect(page.getByText('近接予約 2 件 / 遅延注意時間帯 1 件')).toBeVisible()

    await gotoStable(page, '/dashboard?tab=followups')

    await expect(page.getByText('再来店フォロー未着手')).toBeVisible()
    await expect(page.getByText('無断キャンセル予兆（店舗）')).toBeVisible()
    await expect(page.getByText('20%')).toBeVisible()
    await expect(page.getByText('高 1 件 / 中 1 件')).toBeVisible()
    await expect(page.getByText('山田 花子高リスク')).toBeVisible()
    await expect(page.getByText('無断キャンセル 1 / キャンセル 2 / 最終来店 69 日前')).toBeVisible()
    await expect(page.getByText('電話: 09012345678 / LINE: line_yamada', { exact: true })).toBeVisible()
    await expect(page.getByText('佐藤 トリマー')).toBeVisible()
    await expect(page.getByText('予約化率: 50%')).toBeVisible()
  })

  test('operations と reoffers タブで当日運用と再販状況を表示できる', async ({ page }) => {
    await page.route('**/api/reoffers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          slots: [
            {
              appointment_id: 'dash-appt-004',
              start_time: '2026-03-18T02:00:00.000Z',
              end_time: '2026-03-18T03:30:00.000Z',
              menu: 'ハーブパックコース',
              canceled_pet_name: 'ココ',
              canceled_pet_breed: 'ミックス',
              canceled_staff_name: '高橋 ケア',
              candidates: [
                {
                  source: 'waitlist',
                  customer_id: 'customer-001',
                  customer_name: '山田 花子',
                  phone_number: '09012345678',
                  line_id: 'line_yamada',
                  pet_id: 'pet-001',
                  pet_name: 'モカ',
                  breed: 'トイプードル',
                  score: 92,
                  last_visit_at: '2026-01-05T02:00:00.000Z',
                  channel: 'line',
                  waitlist_id: 'waitlist-001',
                },
              ],
              sent_logs: [
                {
                  id: 'reoffer-log-001',
                  target_customer_id: 'customer-001',
                  target_pet_id: 'pet-001',
                  target_staff_id: 'staff-001',
                  target_customer_name: '山田 花子',
                  target_pet_name: 'モカ',
                  target_staff_name: '佐藤 トリマー',
                  status: 'accepted',
                  sent_at: '2026-03-16T02:10:00.000Z',
                  accepted_at: '2026-03-16T02:20:00.000Z',
                  notes: 'LINEで送信',
                },
              ],
              notification_logs: [
                {
                  id: 'notification-001',
                  customer_name: '山田 花子',
                  channel: 'line',
                  status: 'sent',
                  subject: 'キャンセル枠のご案内',
                  sent_at: '2026-03-16T02:10:00.000Z',
                },
              ],
              timeline: [
                {
                  id: 'timeline-001',
                  event_type: 'appointment_created',
                  created_at: '2026-03-16T02:30:00.000Z',
                  target_customer_name: '山田 花子',
                },
              ],
            },
          ],
          waitlists: [
            {
              id: 'waitlist-001',
              customer_id: 'customer-001',
              customer_name: '山田 花子',
              pet_id: 'pet-001',
              pet_name: 'モカ',
              desired_from: '2026-03-18T01:00:00.000Z',
              desired_to: '2026-03-18T04:00:00.000Z',
              preferred_menu: 'トリミングコース',
              preferred_staff_id: 'staff-001',
              preferred_staff_name: '佐藤 トリマー',
              channel: 'line',
              notes: '多頭の先頭希望',
              created_at: '2026-03-16T01:00:00.000Z',
            },
          ],
          customers: [
            {
              id: 'customer-001',
              full_name: '山田 花子',
              phone_number: '09012345678',
              line_id: 'line_yamada',
              pets: [{ id: 'pet-001', name: 'モカ', breed: 'トイプードル' }],
            },
          ],
          staffs: [{ id: 'staff-001', full_name: '佐藤 トリマー' }],
        }),
      })
    })

    await gotoStable(page, '/dashboard?tab=operations')

    await expect(page.getByText('遅延しやすい時間帯（直近30日）')).toBeVisible()
    await expect(page.getByText('10:00 台')).toBeVisible()
    await expect(page.getByText('遅延率 67%（2/3 件）')).toBeVisible()
    await expect(page.getByRole('heading', { name: '30分以内の予約' })).toBeVisible()
    await expect(page.getByText('10:50 - 12:20 / モカ')).toBeVisible()
    await expect(page.getByText('未会計アラート（本日）')).toBeVisible()
    await expect(page.getByText('11:00 / レオ')).toBeVisible()
    await expect(page.getByRole('link', { name: 'モバイル当日運用へ' })).toBeVisible()

    await gotoStable(page, '/dashboard?tab=reoffers')

    await expect(page.getByText('即時確定対象メニュー', { exact: true })).toBeVisible()
    await expect(page.getByText('現在の対象件数: 1 件')).toBeVisible()
    await expect(page.getByText('トリミングコース')).toBeVisible()
    await expect(page.getByText('空き枠提示型の運用ステータス')).toBeVisible()
    await expect(page.getByText('運用中')).toBeVisible()
    await expect(page.getByText('公開予約KPIアラート（本日）')).toBeVisible()
    await expect(page.getByText('スタッフ偏り率が 67%（閾値 70%）です。')).not.toBeVisible()
    await expect(page.getByText('競合失敗率が 25%（閾値 10%）です。')).toBeVisible()
    await expect(page.getByText('再販受付件数')).toBeVisible()
    await expect(page.getByText('予約化率: 50%')).toBeVisible()
    await expect(page.getByText('キャンセル枠の即時再販')).toBeVisible()
    await expect(page.getByText('waitlist 登録')).toBeVisible()
    await expect(page.getByText('再販受付件数')).toBeVisible()
    await expect(page.getByText('予約化率: 50%')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'キャンセル枠の即時再販' })).toBeVisible()
  })

  test('KPI レポートで集計カードを表示できる', async ({ page }) => {
    await gotoStable(page, '/dashboard/appointments-kpi')

    await expect(page.getByRole('heading', { name: 'KPIレポート' })).toBeVisible()
    await expect(page.getByText('直近30日集計（新規優先）')).toBeVisible()
    await expect(page.getByText('12 件')).toBeVisible()
    await expect(page.getByText('3分20秒')).toBeVisible()
    await expect(page.getByText('11.9')).toBeVisible()
    await expect(page.getByText('68%')).toBeVisible()
    await expect(page.getByText('所要時間自動化KPI（直近500予約）')).toBeVisible()
    await expect(page.getByText('8.5 分')).toBeVisible()
    await expect(page.getByText('±10分以内: 80%')).toBeVisible()
    await expect(page.getByText('20%')).toBeVisible()
    await expect(page.getByText('7 件/日')).toBeVisible()
    await expect(page.getByText('再来店運用KPI（直近500予約）')).toBeVisible()
    await expect(page.getByText('60%')).toBeVisible()
    await expect(page.getByText('2 件', { exact: true })).toBeVisible()
    await expect(page.getByText('50%')).toBeVisible()
  })
})
