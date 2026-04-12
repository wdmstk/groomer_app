import { expect, test } from '@playwright/test'

test.describe('会員ポータル再発行リクエスト', () => {
  // TRACE-334
  test('期限切れ時の再発行リクエストを送信できる', async ({ page }) => {
    let called = false

    await page.route('**/api/public/member-portal/e2e-token/reissue-request', async (route) => {
      called = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: '再発行リクエストを受け付けました。店舗からの案内をお待ちください。',
        }),
      })
    })

    await page.goto('/member-portal-reissue-e2e')

    await expect(page.getByRole('heading', { name: '会員証再発行リクエスト（E2E）' })).toBeVisible()
    await page.getByRole('button', { name: '再発行を依頼する' }).click()
    await expect(page.getByText('再発行リクエストを受け付けました。店舗からの案内をお待ちください。')).toBeVisible()
    expect(called).toBe(true)
  })
})
