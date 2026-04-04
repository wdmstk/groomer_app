import { test, expect } from '@playwright/test'

test.describe('ペット一覧', () => {
  test('実運用に近いペットデータを一覧表示できる', async ({ page }) => {
    await page.goto('/pets?tab=list')

    await expect(page.getByRole('heading', { name: 'ペット管理' })).toBeVisible()
    await expect(page.getByTestId('pets-list')).toBeVisible()
    await expect(page.getByText('全 2 件')).toBeVisible()

    const primaryRow = page.getByTestId('pets-list').getByTestId('pet-row-pet-001')
    await expect(primaryRow).toContainText('こむぎ')
    await expect(primaryRow).toContainText('山田 花子')
    await expect(primaryRow).toContainText('トイプードル')
    await expect(primaryRow).toContainText('0 kg')
    await expect(primaryRow).toContainText('心臓, アレルギー')

    const fallbackRow = page.getByTestId('pets-list').getByTestId('pet-row-pet-002')
    await expect(fallbackRow).toContainText('ひじき')
    await expect(fallbackRow).toContainText('未登録')
    await expect(fallbackRow).toContainText('なし')
    await expect(fallbackRow).toContainText('未登録')
  })

  test('新規ペットモーダルを開ける', async ({ page }) => {
    await page.goto('/pets?tab=list&modal=create')

    await expect(page.getByRole('heading', { name: '新規ペット登録' })).toBeVisible()
    await expect(page.getByLabel('飼い主')).toBeVisible()
    await expect(page.getByLabel('ペット名')).toBeVisible()
    await expect(page.getByLabel('体重 (kg)')).toBeVisible()
  })

  test('ペット編集モーダルで電子同意書サマリーを表示できる', async ({ page }) => {
    await page.goto('/pets?tab=list&edit=pet-001')

    await expect(page.getByRole('heading', { name: 'ペット情報の更新' })).toBeVisible()
    await expect(page.getByText('電子同意書（最新5件）')).toBeVisible()
    await expect(page.getByText('同意書はまだありません。')).toBeVisible()
    await expect(page.getByText('同意書作成は予約管理から行ってください')).toBeVisible()
  })
})
