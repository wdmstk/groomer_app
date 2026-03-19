import { expect, test } from '@playwright/test'

test.describe('在庫管理画面', () => {
  test('在庫ダッシュボードで不足と期限アラートを表示できる', async ({ page }) => {
    await page.goto('/inventory')

    await expect(page.getByRole('heading', { name: '在庫ダッシュボード' })).toBeVisible()
    await expect(page.getByText('不足商品')).toBeVisible()
    await expect(page.getByRole('heading', { name: '不足アラート' })).toBeVisible()
    await expect(page.getByText('期限切れ間近（14日）')).toBeVisible()
    await expect(page.getByText('本日入庫')).toBeVisible()
    await expect(page.getByText('本日出庫')).toBeVisible()
    await expect(page.getByText('トリートメント剤')).toBeVisible()
    await expect(page.getByText('現在庫: 2 本 / 適正在庫: 12 本')).toBeVisible()
    await expect(page.getByText('デンタルガム')).toBeVisible()
    await expect(page.getByRole('link', { name: '発注提案一覧へ' })).toBeVisible()
  })

  test('発注提案一覧で仕入先ごとの提案と高リスク商品を表示できる', async ({ page }) => {
    await page.goto('/inventory/reorder-suggestions')

    await expect(page.getByRole('heading', { name: '発注提案一覧' })).toBeVisible()
    await expect(page.getByText('提案対象商品')).toBeVisible()
    await expect(page.getByText('3 件')).toBeVisible()
    await expect(page.getByText('仕入先グループ')).toBeVisible()
    await expect(page.getByText('トリマー商会')).toBeVisible()
    await expect(page.getByText('欠品予兆（優先監視）')).toBeVisible()
    await expect(page.getByText('トリマー商会')).toBeVisible()
    await expect(page.getByText('トリートメント剤')).toBeVisible()
    await expect(page.getByText('現在庫 2 / 発注点 6 / 適正在庫 12')).toBeVisible()
    await expect(page.getByText('欠品高リスク')).toHaveCount(2)
    await expect(page.locator('input[value="10"]').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '選択商品からドラフト作成' })).toBeVisible()
  })

  test('商品マスタ一覧と作成・編集モーダル初期表示を確認できる', async ({ page }) => {
    await page.goto('/inventory/products?tab=list')

    await expect(page.getByRole('heading', { name: '商品マスタ管理' })).toBeVisible()
    await expect(page.getByText(/全 \d+ 件/)).toBeVisible()
    await expect(page.getByText('トリマー商会 本店')).toBeVisible()
    await expect(page.getByRole('cell', { name: '未設定', exact: true }).first()).toBeVisible()
    await expect(page.getByText('無効')).toBeVisible()

    await page.goto('/inventory/products?tab=list&modal=create')

    await expect(page.getByRole('heading', { name: '新規商品登録' })).toBeVisible()
    await expect(page.getByLabel('商品名')).toBeVisible()
    await expect(page.getByLabel('単位')).toHaveValue('個')
    await expect(page.getByRole('button', { name: '登録する' })).toBeVisible()

    await page.goto('/inventory/products?tab=list&edit=item-001')

    await expect(page.getByRole('heading', { name: '商品情報の更新' })).toBeVisible()
    await expect(page.getByLabel('商品名')).toHaveValue('トリートメント剤')
    await expect(page.getByLabel('カテゴリ')).toHaveValue('ケア用品')
    await expect(page.getByLabel('JANコード')).toHaveValue('4900000000012')
    await expect(page.getByLabel('有効/無効')).toHaveValue('true')
    await expect(page.getByRole('button', { name: '更新する' })).toBeVisible()
  })

  test('在庫一覧、履歴、レポートの集計表示を確認できる', async ({ page }) => {
    test.setTimeout(60_000)

    await page.goto('/inventory/stocks')

    await expect(page.getByRole('heading', { name: '在庫一覧' })).toBeVisible()
    await expect(page.getByText('表示件数: 3 件')).toBeVisible()
    await expect(page.getByText('トリートメント剤')).toBeVisible()
    await expect(page.getByRole('cell', { name: '2 本', exact: true })).toBeVisible()
    await expect(page.getByText('不足').first()).toBeVisible()

    await page.goto('/inventory/stocks?low=1')

    await expect(page.getByText(/表示件数: \d+ 件/)).toBeVisible()
    await expect(page.getByText('肉球クリーム')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'トリートメント剤', exact: true })).toBeVisible()

    await page.goto('/inventory/history')

    await expect(page.getByRole('heading', { name: '在庫履歴' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'トリートメント剤', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: '出庫', exact: true })).toBeVisible()
    await expect(page.getByText('-3 本')).toBeVisible()
    await expect(page.getByText('トリミング施術で消費')).toBeVisible()
    await expect(page.getByText('不明な商品')).toBeVisible()
    await expect(page.getByText('棚卸調整')).toBeVisible()
    await expect(page.getByText('-1')).toBeVisible()

    await page.goto('/inventory/reports')

    await expect(page.getByRole('heading', { name: '在庫レポート' })).toBeVisible()
    await expect(page.getByText('30日入庫量')).toBeVisible()
    await expect(page.getByText('37')).toBeVisible()
    await expect(page.getByText('30日出庫量')).toBeVisible()
    await expect(page.getByText('9', { exact: true })).toBeVisible()
    await expect(page.getByText('在庫資産(概算)')).toBeVisible()
    await expect(page.getByText('7,590 円')).toBeVisible()
    await expect(page.getByText('在庫ゼロ商品数')).toBeVisible()
    await expect(page.getByText('1 件')).toBeVisible()
    await expect(page.getByText('ケア用品: 8')).toBeVisible()
    await expect(page.getByText('物販: 1')).toBeVisible()
  })

  test('入庫、出庫、発注管理の初期表示を確認できる', async ({ page }) => {
    await page.goto('/inventory/inbounds')

    await expect(page.getByRole('heading', { name: '入庫登録' })).toBeVisible()
    await expect(page.getByLabel('商品')).toBeVisible()
    await expect(page.getByLabel('数量')).toBeVisible()
    await expect(page.getByLabel('単価')).toBeVisible()
    await expect(page.getByRole('button', { name: '入庫を登録' })).toBeVisible()
    await expect(page.getByText('最新の入庫履歴')).toBeVisible()
    await expect(page.getByText('全 2 件')).toBeVisible()
    await expect(page.getByText('+12 本')).toBeVisible()
    await expect(page.getByText('850 円')).toBeVisible()
    await expect(page.getByText('定期仕入れ')).toBeVisible()
    await expect(page.getByText('不明な商品')).not.toBeVisible()

    await page.goto('/inventory/outbounds')

    await expect(page.getByRole('heading', { name: '出庫登録' })).toBeVisible()
    await expect(page.getByLabel('出庫理由')).toHaveValue('施術利用')
    await expect(page.getByRole('button', { name: '出庫を登録' })).toBeVisible()
    await expect(page.getByText('最新の出庫履歴')).toBeVisible()
    await expect(page.getByText('全 2 件')).toBeVisible()
    await expect(page.getByText('-2 本')).toBeVisible()
    await expect(page.getByRole('table').getByText('施術利用')).toBeVisible()
    await expect(page.getByText('-1 個')).toBeVisible()

    await page.goto('/inventory/purchase-orders')

    await expect(page.getByRole('heading', { name: '発注管理' })).toBeVisible()
    await expect(page.getByText('新規発注を作成')).toBeVisible()
    await expect(page.getByLabel('発注番号 (任意)')).toBeVisible()
    await expect(page.getByLabel('ステータス')).toHaveValue('draft')
    await expect(page.getByRole('button', { name: '発注を作成' })).toBeVisible()
    await expect(page.getByText('発注一覧')).toBeVisible()
    await expect(page.getByText('全 2 件')).toBeVisible()
    await expect(page.getByText('PO-20260316-001')).toBeVisible()
    await expect(page.getByText('仕入先: トリマー商会')).toBeVisible()
    await expect(page.getByText('ステータス: draft')).toBeVisible()
    await expect(page.getByText('10,200 円')).toBeVisible()
    await expect(page.getByText('発注明細').first()).toBeVisible()
    await expect(page.getByText('トリートメント剤 / 10 x 850 円')).toBeVisible()
    await expect(page.getByText('明細が未登録です。')).toBeVisible()
    await expect(page.getByRole('button', { name: '明細を追加' })).toHaveCount(2)
  })

  test('棚卸で帳簿在庫付き商品選択と差異履歴を表示できる', async ({ page }) => {
    await page.goto('/inventory/stocktake')

    await expect(page.getByRole('heading', { name: '棚卸', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: '棚卸調整を登録' })).toBeVisible()
    await expect(page.getByLabel('商品')).toBeVisible()
    const stocktakeSelect = page.getByLabel('商品')
    await expect(stocktakeSelect).toContainText('トリートメント剤 (帳簿在庫: 2 本)')
    await expect(stocktakeSelect).toContainText('ホテル用シーツ (帳簿在庫: 30 枚)')
    await expect(stocktakeSelect).toContainText('肉球クリーム (帳簿在庫: -5 個)')
    await expect(page.getByLabel('理由')).toHaveValue('棚卸調整')
    await expect(page.getByRole('button', { name: '差異を反映' })).toBeVisible()

    await expect(page.getByRole('heading', { name: '最新の棚卸調整履歴' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'トリートメント剤', exact: true })).toBeVisible()
    await expect(page.getByText('-1 本')).toBeVisible()
    await expect(page.getByText('棚卸差異')).toBeVisible()
    await expect(page.getByText('+2 個')).toBeVisible()
    await expect(page.getByText('倉庫在庫を反映')).toBeVisible()
  })
})
