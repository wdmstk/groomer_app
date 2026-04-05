'use client'

import { useMemo, useState } from 'react'

type ProviderType = 'stripe' | 'komoju'

type PublicConnection = {
  provider: ProviderType
  is_active: boolean
  has_secret_key: boolean
  has_webhook_secret: boolean
  komoju_api_base_url: string | null
}

type Props = {
  initialConnections: PublicConnection[]
}

type DraftConnection = {
  provider: ProviderType
  is_active: boolean
  secret_key: string
  webhook_secret: string
  komoju_api_base_url: string
}

function defaultConnection(provider: ProviderType): PublicConnection {
  return {
    provider,
    is_active: false,
    has_secret_key: false,
    has_webhook_secret: false,
    komoju_api_base_url: null,
  }
}

export function StorePaymentProviderConnectionsPanel({ initialConnections }: Props) {
  const normalized = useMemo(() => {
    const byProvider = new Map(initialConnections.map((row) => [row.provider, row]))
    return {
      stripe: byProvider.get('stripe') ?? defaultConnection('stripe'),
      komoju: byProvider.get('komoju') ?? defaultConnection('komoju'),
    }
  }, [initialConnections])

  const [stripeDraft, setStripeDraft] = useState<DraftConnection>({
    provider: 'stripe',
    is_active: normalized.stripe.is_active,
    secret_key: '',
    webhook_secret: '',
    komoju_api_base_url: '',
  })
  const [komojuDraft, setKomojuDraft] = useState<DraftConnection>({
    provider: 'komoju',
    is_active: normalized.komoju.is_active,
    secret_key: '',
    webhook_secret: '',
    komoju_api_base_url: normalized.komoju.komoju_api_base_url ?? '',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [savingProvider, setSavingProvider] = useState<ProviderType | null>(null)
  const [statusByProvider, setStatusByProvider] = useState<Record<ProviderType, PublicConnection>>({
    stripe: normalized.stripe,
    komoju: normalized.komoju,
  })

  async function saveConnection(draft: DraftConnection) {
    setSavingProvider(draft.provider)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/settings/payment-provider-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; connection?: PublicConnection }
        | null
      if (!response.ok || !payload?.connection) {
        throw new Error(payload?.message ?? '保存に失敗しました。')
      }
      setStatusByProvider((prev) => ({
        ...prev,
        [draft.provider]: payload.connection!,
      }))
      setMessage(`${draft.provider === 'stripe' ? 'Stripe' : 'KOMOJU'} 接続設定を保存しました。`)
      if (draft.provider === 'stripe') {
        setStripeDraft((prev) => ({ ...prev, secret_key: '', webhook_secret: '' }))
      } else {
        setKomojuDraft((prev) => ({ ...prev, secret_key: '', webhook_secret: '' }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました。')
    } finally {
      setSavingProvider(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        店舗ごとに顧客決済用の API キー / Webhook 秘密鍵を登録します。空欄項目は既存値を維持します。
      </p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded border p-4">
          <h3 className="text-base font-semibold text-gray-900">Stripe 接続</h3>
          <p className="mt-1 text-xs text-gray-600">
            登録済みキー: {statusByProvider.stripe.has_secret_key ? 'あり' : 'なし'} / webhook: {statusByProvider.stripe.has_webhook_secret ? 'あり' : 'なし'}
          </p>
          <label className="mt-3 block space-y-1 text-sm text-gray-700">
            <span>Stripe Secret Key</span>
            <input
              type="password"
              value={stripeDraft.secret_key}
              onChange={(event) => setStripeDraft((prev) => ({ ...prev, secret_key: event.target.value }))}
              className="w-full rounded border p-2"
              placeholder="sk_live_*** / sk_test_***"
            />
          </label>
          <label className="mt-3 block space-y-1 text-sm text-gray-700">
            <span>Stripe Webhook Secret</span>
            <input
              type="password"
              value={stripeDraft.webhook_secret}
              onChange={(event) => setStripeDraft((prev) => ({ ...prev, webhook_secret: event.target.value }))}
              className="w-full rounded border p-2"
              placeholder="whsec_***"
            />
          </label>
          <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={stripeDraft.is_active}
              onChange={(event) => setStripeDraft((prev) => ({ ...prev, is_active: event.target.checked }))}
            />
            顧客決済で Stripe を有効化
          </label>
          <div className="mt-3">
            <button
              type="button"
              disabled={savingProvider === 'stripe'}
              onClick={() => void saveConnection(stripeDraft)}
              className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingProvider === 'stripe' ? '保存中...' : 'Stripe設定を保存'}
            </button>
          </div>
        </section>

        <section className="rounded border p-4">
          <h3 className="text-base font-semibold text-gray-900">KOMOJU 接続</h3>
          <p className="mt-1 text-xs text-gray-600">
            登録済みキー: {statusByProvider.komoju.has_secret_key ? 'あり' : 'なし'} / webhook: {statusByProvider.komoju.has_webhook_secret ? 'あり' : 'なし'}
          </p>
          <label className="mt-3 block space-y-1 text-sm text-gray-700">
            <span>KOMOJU Secret Key</span>
            <input
              type="password"
              value={komojuDraft.secret_key}
              onChange={(event) => setKomojuDraft((prev) => ({ ...prev, secret_key: event.target.value }))}
              className="w-full rounded border p-2"
              placeholder="sk_live_*** / sk_test_***"
            />
          </label>
          <label className="mt-3 block space-y-1 text-sm text-gray-700">
            <span>KOMOJU Webhook Secret</span>
            <input
              type="password"
              value={komojuDraft.webhook_secret}
              onChange={(event) => setKomojuDraft((prev) => ({ ...prev, webhook_secret: event.target.value }))}
              className="w-full rounded border p-2"
              placeholder="Webhook secret"
            />
          </label>
          <label className="mt-3 block space-y-1 text-sm text-gray-700">
            <span>KOMOJU API Base URL（任意）</span>
            <input
              type="text"
              value={komojuDraft.komoju_api_base_url}
              onChange={(event) => setKomojuDraft((prev) => ({ ...prev, komoju_api_base_url: event.target.value }))}
              className="w-full rounded border p-2"
              placeholder="https://api.komoju.com"
            />
          </label>
          <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={komojuDraft.is_active}
              onChange={(event) => setKomojuDraft((prev) => ({ ...prev, is_active: event.target.checked }))}
            />
            顧客決済で KOMOJU を有効化
          </label>
          <div className="mt-3">
            <button
              type="button"
              disabled={savingProvider === 'komoju'}
              onClick={() => void saveConnection(komojuDraft)}
              className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {savingProvider === 'komoju' ? '保存中...' : 'KOMOJU設定を保存'}
            </button>
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  )
}
