import { expect, test } from '@playwright/test'

test.describe('ペットホテル管理', () => {
  // TRACE-019
  test('一覧、カレンダー、設定、商品台帳の初期表示を確認できる', async ({ page }) => {
    await page.goto('/hotel')

    await expect(page.getByRole('heading', { name: 'ペットホテル管理' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'ホテル台帳一覧' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'HT-20260316-001', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'モカ', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'チェックイン済み', exact: true })).toBeVisible()
    await expect(page.getByText('8,800 円')).toBeVisible()
    await expect(page.getByText('送迎 x 1 = 2,000 円')).toBeVisible()
    await expect(page.getByText('臆病なので個室優先')).toBeVisible()

    await page.getByRole('button', { name: 'カレンダー' }).click()
    await expect(page.getByRole('heading', { name: '稼働カレンダー' })).toBeVisible()
    await expect(page.getByRole('button', { name: '新規予約' })).toBeVisible()
    await expect(page.getByRole('button', { name: '選択中を編集' })).toBeVisible()
    await expect(page.getByRole('button', { name: '今日' })).toBeVisible()
    await expect(page.getByRole('combobox')).toHaveValue('week')

    await page.getByRole('button', { name: '運用設定' }).click()
    await expect(page.getByRole('heading', { name: 'ホテル運用設定' })).toBeVisible()
    await expect(page.getByLabel('同時預かり上限')).toHaveValue('4')
    await expect(page.getByLabel('表示開始時刻')).toHaveValue('8')
    await expect(page.getByLabel('表示終了時刻')).toHaveValue('21')

    await page.getByRole('button', { name: '商品台帳' }).click()
    await expect(page.getByRole('heading', { name: 'ホテル商品台帳' })).toBeVisible()
    await expect(page.getByText('通常メニュー', { exact: true })).toBeVisible()
    await expect(page.getByText('対象件数: 2 件')).toBeVisible()
    await expect(page.getByText('ハイシーズンメニュー')).toBeVisible()
    await expect(page.getByText('対象件数: 1 件')).toBeVisible()
    await expect(page.getByText('宿泊 基本料金')).toBeVisible()
    await expect(page.getByText('送迎')).toBeVisible()
    await expect(page.getByText('ハイシーズン加算')).toBeVisible()
    await expect(page.getByRole('cell', { name: '対象外', exact: true }).first()).toBeVisible()
    await expect(page.getByText('無効')).toBeVisible()

    await page.getByRole('button', { name: '商品を追加' }).click()
    await expect(page.getByLabel('商品名')).toBeVisible()
    await expect(page.getByLabel('種別')).toHaveValue('option')
    await expect(page.getByLabel('課金単位')).toHaveValue('fixed')
  })

  test('新規予約モーダルの初期表示を確認できる', async ({ page }) => {
    await page.goto('/hotel')

    await page.getByRole('button', { name: '新規予約を登録' }).click()

    await expect(page.getByRole('heading', { name: 'ホテル予約 新規作成' })).toBeVisible()
    await expect(page.getByLabel('顧客')).toBeVisible()
    await expect(page.getByLabel('ペット')).toBeVisible()
    await expect(page.getByLabel('ステータス')).toHaveValue('reserved')
    await expect(page.getByText('送迎は商品選択から自動判定します。予約時点の商品・単価を明細保存します。')).toBeVisible()
  })

  test('ホテル予約の作成・更新・削除と設定保存メッセージを確認できる', async ({ page }) => {
    let stay003Status: 'reserved' | 'checked_out' = 'reserved'
    let stay003Notes = '日帰り預かり'

    await page.route('**/api/hotel/stays', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'stay-003' }),
        })
        return
      }
      await route.continue()
    })

    await page.route('**/api/hotel/stays/stay-003', async (route) => {
      const method = route.request().method()
      if (method === 'PATCH') {
        stay003Status = 'checked_out'
        stay003Notes = '更新後メモ'
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'ok' }),
        })
        return
      }
      if (method === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'ok' }),
        })
        return
      }
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            stay: {
              id: 'stay-003',
              stay_code: 'HT-20260318-003',
              status: stay003Status,
              customer_id: 'customer-002',
              pet_id: 'pet-002',
              planned_check_in_at: '2026-03-18T01:00:00.000Z',
              planned_check_out_at: '2026-03-18T05:00:00.000Z',
              actual_check_in_at: null,
              actual_check_out_at: null,
              nights: 1,
              pickup_required: false,
              dropoff_required: false,
              vaccine_expires_on: null,
              total_amount_jpy: 4500,
              notes: stay003Notes,
              selected_items: [],
            },
          }),
        })
        return
      }
      await route.continue()
    })

    await page.route('**/api/hotel/stays/stay-001', async (route) => {
      const method = route.request().method()
      if (method === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'ok' }),
        })
        return
      }
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            stay: {
              id: 'stay-001',
              stay_code: 'HT-20260316-001',
              status: 'checked_out',
              customer_id: 'customer-001',
              pet_id: 'pet-001',
              planned_check_in_at: '2026-03-16T01:00:00.000Z',
              planned_check_out_at: '2026-03-17T01:00:00.000Z',
              actual_check_in_at: '2026-03-16T01:10:00.000Z',
              actual_check_out_at: '2026-03-17T01:05:00.000Z',
              nights: 1,
              pickup_required: true,
              dropoff_required: false,
              vaccine_expires_on: '2026-04-10',
              total_amount_jpy: 8800,
              notes: '更新後メモ',
              selected_items: [],
            },
          }),
        })
        return
      }
      if (method === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'ok' }),
        })
        return
      }
      await route.continue()
    })

    await page.route('**/api/hotel/settings', async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON() as {
          max_concurrent_pets: number
          calendar_open_hour: number
          calendar_close_hour: number
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            settings: {
              id: 'hotel-settings-001',
              store_id: 'store-e2e-demo',
              max_concurrent_pets: body.max_concurrent_pets,
              calendar_open_hour: body.calendar_open_hour,
              calendar_close_hour: body.calendar_close_hour,
            },
          }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('/hotel')

    await page.getByRole('button', { name: '新規予約を登録' }).click()
    await page.getByLabel('顧客').selectOption('customer-002')
    await page.getByLabel('ペット').selectOption('pet-002')
    await page.getByLabel('台帳コード').fill('HT-20260318-003')
    await page.getByRole('button', { name: '作成', exact: true }).click()

    await expect(page.getByText('ホテル台帳を作成しました。')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'HT-20260318-003', exact: true })).toBeVisible()
    await expect(page.getByText('日帰り預かり')).toBeVisible()

    await page.getByRole('button', { name: 'この予約を編集' }).click()
    await page.getByLabel('ステータス').selectOption('checked_out')
    await page.getByLabel('備考').fill('更新後メモ')
    await page.getByRole('button', { name: '更新' }).click()

    await expect(page.getByText('ホテル台帳を更新しました。')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'チェックアウト済み', exact: true })).toBeVisible()
    await expect(page.getByText('更新後メモ')).toBeVisible()

    await page.getByRole('button', { name: '運用設定' }).click()
    await page.getByLabel('同時預かり上限').fill('5')
    await page.getByRole('button', { name: '設定を保存' }).click()

    await expect(page.getByText('ホテル設定を保存しました。')).toBeVisible()
    await expect(page.getByLabel('同時預かり上限')).toHaveValue('5')

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '一覧' }).click()
    await page.getByRole('button', { name: 'この予約を編集' }).click()
    await page.getByRole('button', { name: '削除' }).click()

    await expect(page.getByText('ホテル台帳を削除しました。')).toBeVisible()
  })

  test('ホテル商品台帳の保存・削除・シーズン切替メッセージを確認できる', async ({ page }) => {
    let menuMode: 'initial' | 'created' | 'updated' | 'deleted' | 'high_season' | 'normal' = 'initial'

    const menuItemsForMode = () => {
      if (menuMode === 'created') {
        return [
          {
            id: 'menu-010',
            name: '個室アップグレード',
            item_type: 'option',
            billing_unit: 'fixed',
            duration_minutes: null,
            default_quantity: 1,
            price: 2500,
            tax_rate: 0.1,
            tax_included: true,
            counts_toward_capacity: false,
            is_active: true,
            display_order: 40,
            notes: '静かな部屋を優先',
          },
          {
            id: 'menu-001',
            name: '宿泊 基本料金',
            item_type: 'overnight',
            billing_unit: 'per_night',
            duration_minutes: null,
            default_quantity: 1,
            price: 6800,
            tax_rate: 0.1,
            tax_included: true,
            counts_toward_capacity: true,
            is_active: true,
            display_order: 10,
            notes: '小型犬向け',
          },
          {
            id: 'menu-003',
            name: '送迎',
            item_type: 'transport',
            billing_unit: 'fixed',
            duration_minutes: null,
            default_quantity: 1,
            price: 2000,
            tax_rate: 0.1,
            tax_included: true,
            counts_toward_capacity: false,
            is_active: true,
            display_order: 30,
            notes: '片道2km圏内',
          },
          {
            id: 'menu-002',
            name: 'ハイシーズン加算',
            item_type: 'option',
            billing_unit: 'fixed',
            duration_minutes: null,
            default_quantity: 1,
            price: 1500,
            tax_rate: 0.1,
            tax_included: true,
            counts_toward_capacity: false,
            is_active: false,
            display_order: 320,
            notes: 'GW・年末年始',
          },
        ]
      }
      if (menuMode === 'updated') {
        return [
          {
            id: 'menu-001',
            name: '宿泊 基本料金 改',
            item_type: 'overnight',
            billing_unit: 'per_night',
            duration_minutes: null,
            default_quantity: 1,
            price: 7200,
            tax_rate: 0.1,
            tax_included: true,
            counts_toward_capacity: true,
            is_active: true,
            display_order: 10,
            notes: '価格改定後',
          },
          {
            id: 'menu-003',
            name: '送迎',
            item_type: 'transport',
            billing_unit: 'fixed',
            duration_minutes: null,
            default_quantity: 1,
            price: 2000,
            tax_rate: 0.1,
            tax_included: true,
            counts_toward_capacity: false,
            is_active: true,
            display_order: 30,
            notes: '片道2km圏内',
          },
          {
            id: 'menu-002',
            name: 'ハイシーズン加算',
            item_type: 'option',
            billing_unit: 'fixed',
            duration_minutes: null,
            default_quantity: 1,
            price: 1500,
            tax_rate: 0.1,
            tax_included: true,
            counts_toward_capacity: false,
            is_active: false,
            display_order: 320,
            notes: 'GW・年末年始',
          },
        ]
      }
      if (menuMode === 'deleted') {
        return [
          {
            id: 'menu-001',
            name: '宿泊 基本料金',
            item_type: 'overnight',
            billing_unit: 'per_night',
            duration_minutes: null,
            default_quantity: 1,
            price: 6800,
            tax_rate: 0.1,
            tax_included: true,
            counts_toward_capacity: true,
            is_active: true,
            display_order: 10,
            notes: '小型犬向け',
          },
          {
            id: 'menu-002',
            name: 'ハイシーズン加算',
            item_type: 'option',
            billing_unit: 'fixed',
            duration_minutes: null,
            default_quantity: 1,
            price: 1500,
            tax_rate: 0.1,
            tax_included: true,
            counts_toward_capacity: false,
            is_active: false,
            display_order: 320,
            notes: 'GW・年末年始',
          },
        ]
      }
      if (menuMode === 'high_season') {
        return [
          {
            id: 'menu-001',
            name: '宿泊 基本料金',
            item_type: 'overnight',
            billing_unit: 'per_night',
            duration_minutes: null,
            default_quantity: 1,
            price: 6800,
            tax_rate: 0.1,
            tax_included: true,
            counts_toward_capacity: true,
            is_active: false,
            display_order: 10,
            notes: '小型犬向け',
          },
          {
            id: 'menu-002',
            name: 'ハイシーズン加算',
            item_type: 'option',
            billing_unit: 'fixed',
            duration_minutes: null,
            default_quantity: 1,
            price: 1500,
            tax_rate: 0.1,
            tax_included: true,
            counts_toward_capacity: false,
            is_active: true,
            display_order: 320,
            notes: 'GW・年末年始',
          },
          {
            id: 'menu-003',
            name: '送迎',
            item_type: 'transport',
            billing_unit: 'fixed',
            duration_minutes: null,
            default_quantity: 1,
            price: 2000,
            tax_rate: 0.1,
            tax_included: true,
            counts_toward_capacity: false,
            is_active: false,
            display_order: 30,
            notes: '片道2km圏内',
          },
        ]
      }
      return [
        {
          id: 'menu-001',
          name: '宿泊 基本料金',
          item_type: 'overnight',
          billing_unit: 'per_night',
          duration_minutes: null,
          default_quantity: 1,
          price: 6800,
          tax_rate: 0.1,
          tax_included: true,
          counts_toward_capacity: true,
          is_active: true,
          display_order: 10,
          notes: '小型犬向け',
        },
        {
          id: 'menu-002',
          name: 'ハイシーズン加算',
          item_type: 'option',
          billing_unit: 'fixed',
          duration_minutes: null,
          default_quantity: 1,
          price: 1500,
          tax_rate: 0.1,
          tax_included: true,
          counts_toward_capacity: false,
          is_active: false,
          display_order: 320,
          notes: 'GW・年末年始',
        },
        {
          id: 'menu-003',
          name: '送迎',
          item_type: 'transport',
          billing_unit: 'fixed',
          duration_minutes: null,
          default_quantity: 1,
          price: 2000,
          tax_rate: 0.1,
          tax_included: true,
          counts_toward_capacity: false,
          is_active: true,
          display_order: 30,
          notes: '片道2km圏内',
        },
      ]
    }

    await page.route('**/api/hotel/stays?include_items=true', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stays: [
            {
              id: 'stay-001',
              stay_code: 'HT-20260316-001',
              status: 'checked_in',
              customer_id: 'customer-001',
              pet_id: 'pet-001',
              planned_check_in_at: '2026-03-16T01:00:00.000Z',
              planned_check_out_at: '2026-03-17T01:00:00.000Z',
              actual_check_in_at: '2026-03-16T01:10:00.000Z',
              actual_check_out_at: null,
              nights: 1,
              pickup_required: true,
              dropoff_required: false,
              vaccine_expires_on: '2026-04-10',
              total_amount_jpy: 8800,
              notes: '臆病なので個室優先',
              selected_items: [],
            },
          ],
        }),
      })
    })

    await page.route('**/api/hotel/menu-items', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ menu_items: menuItemsForMode() }),
        })
        return
      }
      if (method === 'POST') {
        menuMode = 'created'
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'ok' }),
        })
        return
      }
      await route.continue()
    })

    await page.route('**/api/hotel/menu-items/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        menuMode = 'updated'
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'ok' }),
        })
        return
      }
      if (route.request().method() === 'DELETE') {
        menuMode = 'deleted'
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'ok' }),
        })
        return
      }
      await route.continue()
    })

    await page.route('**/api/hotel/menu-items/season-toggle', async (route) => {
      const body = route.request().postDataJSON() as { season_mode: 'normal' | 'high_season' }
      menuMode = body.season_mode
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message:
            body.season_mode === 'high_season'
              ? 'ハイシーズンメニューへ切り替えました。'
              : '通常メニューへ切り替えました。',
        }),
      })
    })

    await page.route('**/api/hotel/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          settings: {
            id: 'hotel-settings-001',
            store_id: 'store-e2e-demo',
            max_concurrent_pets: 4,
            calendar_open_hour: 8,
            calendar_close_hour: 21,
          },
        }),
      })
    })

    await page.goto('/hotel')
    await page.getByRole('button', { name: '商品台帳' }).click()

    await page.getByRole('button', { name: '商品を追加' }).click()
    await page.getByLabel('商品名').fill('個室アップグレード')
    await page.getByRole('spinbutton', { name: '価格', exact: true }).fill('2500')
    await page.getByLabel('備考').fill('静かな部屋を優先')
    await page.getByRole('button', { name: '商品を作成' }).click()

    await expect(page.getByText('ホテル商品を保存しました。')).toBeVisible()
    await expect(page.getByText('個室アップグレード')).toBeVisible()

    await page.getByRole('button', { name: '編集' }).first().click()
    await page.getByLabel('商品名').fill('宿泊 基本料金 改')
    await page.getByRole('spinbutton', { name: '価格', exact: true }).fill('7200')
    await page.getByLabel('備考').fill('価格改定後')
    await page.getByRole('button', { name: '商品を更新' }).click()

    await expect(page.getByText('ホテル商品を保存しました。')).toBeVisible()
    await expect(page.getByText('宿泊 基本料金 改')).toBeVisible()
    await expect(page.getByText('7,200 円')).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '削除' }).first().click()

    await expect(page.getByText('ホテル商品を削除しました。')).toBeVisible()

    await page.getByRole('button', { name: 'ハイシーズンON' }).click()
    await expect(page.getByText('ハイシーズンメニューへ切り替えました。')).toBeVisible()
    await expect(page.getByText('通常メニュー', { exact: true })).toBeVisible()
    await expect(page.getByText('ハイシーズンメニュー', { exact: true })).toBeVisible()
  })
})
