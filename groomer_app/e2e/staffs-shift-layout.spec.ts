import { expect, test } from '@playwright/test'

test.describe('スタッフシフト表示', () => {
  test('操作ボタンが見切れず、時間編集ポップオーバーが表示される', async ({ page }) => {
    await page.goto('/staffs?tab=shift&shift_from=2026-04-15&shift_to=2026-04-15')

    await expect(page.getByRole('heading', { name: 'シフト管理' })).toBeVisible()
    const strategySelect = page.locator('select[name="strategy"]').first()
    await expect(strategySelect).toBeVisible()
    await expect(strategySelect).toHaveValue('rule_based')

    const publishButton = page.getByRole('button', { name: '公開' }).first()
    const hideButton = page.getByRole('button', { name: '非公開' }).first()
    const deleteButtons = page.getByRole('button', { name: '削除' })

    await expect(publishButton).toBeVisible()
    await expect(hideButton).toBeVisible()
    await expect(deleteButtons.first()).toBeVisible()

    for (const button of [publishButton, hideButton, deleteButtons.first()]) {
      const notClipped = await button.evaluate((el) => el.scrollWidth <= el.clientWidth)
      expect(notClipped).toBeTruthy()
    }

    const editSummary = page.locator('summary:has-text("時間編集")').first()
    await expect(editSummary).toBeVisible()
    await editSummary.click()

    const openDetails = page.locator('details[open]').first()
    const startTimeInput = openDetails.locator('input[name="start_time"]').first()
    await expect(startTimeInput).toBeVisible()

    const isTopMost = await startTimeInput.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const top = document.elementFromPoint(centerX, centerY)
      return top === el || !!top?.closest('details[open]')
    })
    expect(isTopMost).toBeTruthy()
  })

  test('モバイル幅ではカード表示で操作できる', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/staffs?tab=shift&shift_from=2026-04-15&shift_to=2026-04-15')
    const mobileContainer = page.locator('div.md\\:hidden').first()

    await expect(page.getByRole('heading', { name: 'シフト管理' })).toBeVisible()
    await expect(mobileContainer.locator('p.font-semibold', { hasText: '佐藤 未来' }).first()).toBeVisible()
    await expect(mobileContainer.getByRole('button', { name: '時間更新' }).first()).toBeVisible()
    await expect(mobileContainer.getByRole('button', { name: '公開' }).first()).toBeVisible()
    await expect(mobileContainer.getByRole('button', { name: '削除' }).first()).toBeVisible()
  })
})
