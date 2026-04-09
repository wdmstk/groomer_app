import { test, expect } from '@playwright/test'

test.describe('会員証URL Phase2', () => {
  test('顧客管理βで再発行リクエスト対応フローを実行できる', async ({ page }) => {
    await page.route('**/api/customers/*/member-portal-reissue-requests', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pendingRequest: {
            id: 'reissue-req-001',
            status: 'pending',
            requestedAt: '2026-04-05T00:00:00.000Z',
            note: null,
          },
        }),
      })
    })

    let resolveReissueRequest: boolean | null = null
    await page.route('**/api/customers/*/member-portal-link', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      const raw = route.request().postData() ?? '{}'
      const body = JSON.parse(raw) as { resolveReissueRequest?: boolean }
      resolveReissueRequest = body.resolveReissueRequest === true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: '会員証URLを発行しました。',
          portalUrl: 'https://example.com/shared/member-portal/token-001',
          expiresAt: '2026-07-01T00:00:00.000Z',
        }),
      })
    })

    await page.goto('/customers/manage?view=detail&customer_id=customer-001&tab=basic')

    await expect(page.getByText('会員証URL')).toBeVisible()
    const issueButton = page.getByRole('button', { name: 'リクエスト対応で再発行' })
    await expect(issueButton).toBeVisible()
    await issueButton.click()

    await expect(page.getByText('会員証URLを発行し、クリップボードへコピーしました。')).toBeVisible()
    expect(resolveReissueRequest).toBe(true)
  })
})
