import { expect, test } from '@playwright/test'

test.describe('電子同意書導線', () => {
  test('店頭署名チャネルで同意書作成メッセージを表示できる', async ({ page }) => {
    await page.route('**/api/consents/documents', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 'consent-doc-created',
                customer_id: 'customer-001',
                pet_id: 'pet-001',
                status: 'draft',
                signed_at: null,
                created_at: '2026-03-27T01:00:00.000Z',
              },
            ],
          }),
        })
        return
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          document: { id: 'consent-doc-created', status: 'draft', token_expires_at: '2026-03-29T01:00:00.000Z' },
          sign_url: 'https://example.com/consent/sign/token-in-person',
        }),
      })
    })

    await page.goto('/consents')
    await page.getByTestId('consent-doc-template').selectOption('tpl-001')
    await page.getByTestId('consent-doc-customer').selectOption('customer-001')
    await page.getByTestId('consent-doc-pet').selectOption('pet-001')
    await page.getByTestId('consent-doc-channel').selectOption('in_person')
    await page.getByTestId('consent-doc-submit').click()

    await expect(page.getByTestId('consent-message')).toContainText('同意書を作成しました。署名画面を別タブで開きました。')
  })

  test('LINEチャネルで同意書作成メッセージを表示できる', async ({ page }) => {
    await page.route('**/api/consents/documents', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [] }),
        })
        return
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          document: { id: 'consent-doc-line', status: 'sent', token_expires_at: '2026-03-29T01:00:00.000Z' },
          sign_url: 'https://example.com/consent/sign/token-line',
        }),
      })
    })

    await page.goto('/consents')
    await page.getByTestId('consent-doc-template').selectOption('tpl-001')
    await page.getByTestId('consent-doc-customer').selectOption('customer-001')
    await page.getByTestId('consent-doc-pet').selectOption('pet-001')
    await page.getByTestId('consent-doc-channel').selectOption('line')
    await page.getByTestId('consent-doc-submit').click()

    await expect(page.getByTestId('consent-message')).toContainText('同意書を作成し、LINE送信しました。')
  })

  // TRACE-310
  test('署名画面で署名送信完了とPDFリンクを表示できる', async ({ page }) => {
    await page.route('**/api/public/consents/e2e-sign-token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          document: { id: 'consent-doc-sign', status: 'sent', expires_at: '2026-03-29T01:00:00.000Z' },
          template_version: {
            title: '施術前同意書',
            body_html: '<p>内容を確認してください。</p>',
            version_no: 1,
          },
          customer: { full_name: '山田 花子' },
          pet: { name: 'こむぎ' },
        }),
      })
    })

    await page.route('**/api/public/consents/e2e-sign-token/sign', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          document_id: 'consent-doc-sign',
          signed_at: '2026-03-27T01:00:00.000Z',
          pdf_url: 'https://example.com/signed/consent-doc-sign.pdf',
        }),
      })
    })

    await page.goto('/consent/sign/e2e-sign-token')
    await expect(page.getByRole('heading', { name: '施術同意書' })).toBeVisible()
    await expect(page.getByText('施術前同意書')).toBeVisible()
    await page.getByLabel('署名者名').fill('山田 花子')
    await page.getByLabel('上記内容を確認し、施術同意書に同意します。').check()
    const canvas = page.locator('canvas').first()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('署名キャンバスが表示されていません。')
    await page.mouse.move(box.x + 20, box.y + 20)
    await page.mouse.down()
    await page.mouse.move(box.x + 180, box.y + 90)
    await page.mouse.move(box.x + 260, box.y + 120)
    await page.mouse.up()
    await page.getByRole('button', { name: '署名して送信' }).click()

    await expect(page.getByText('署名が完了しました。')).toBeVisible()
    await expect(page.getByRole('link', { name: 'PDFを開く' })).toHaveAttribute(
      'href',
      'https://example.com/signed/consent-doc-sign.pdf'
    )
  })
})
