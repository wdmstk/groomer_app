'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  renderMedicalRecordShareLineTemplate,
  renderFollowupLineTemplate,
  renderNextVisitSuggestionLineTemplate,
  renderReminderTemplate,
  renderSlotReofferLineTemplate,
} from '@/lib/notification-templates'

type TemplateRow = {
  subject: string | null
  body: string
  is_active: boolean
}

type TemplateKey =
  | 'slot_reoffer_line'
  | 'followup_line'
  | 'next_visit_suggestion_line'
  | 'reminder_line'
  | 'medical_record_share_line'
  | 'reminder_email'

const TEMPLATE_KEYS: TemplateKey[] = [
  'slot_reoffer_line',
  'followup_line',
  'next_visit_suggestion_line',
  'reminder_line',
  'medical_record_share_line',
  'reminder_email',
]

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  slot_reoffer_line: '再販LINEテンプレ',
  followup_line: '再来店フォローLINEテンプレ',
  next_visit_suggestion_line: '次回来店提案LINEテンプレ',
  reminder_line: '前日リマインドLINEテンプレ',
  medical_record_share_line: '写真カルテ共有LINEテンプレ',
  reminder_email: '前日リマインドメールテンプレ',
}

let cachedNotificationTemplates: Record<TemplateKey, TemplateRow> | null = null
let inflightNotificationTemplatesPromise: Promise<Record<TemplateKey, TemplateRow> | null> | null = null

async function fetchNotificationTemplates() {
  if (cachedNotificationTemplates) {
    return cachedNotificationTemplates
  }
  if (inflightNotificationTemplatesPromise) {
    return inflightNotificationTemplatesPromise
  }

  inflightNotificationTemplatesPromise = fetch('/api/notification-templates?scope=notifications', { cache: 'no-store' })
    .then(async (response) => {
      const payload = (await response.json().catch(() => null)) as
        | {
            templates?: Record<TemplateKey, TemplateRow>
            message?: string
          }
        | null
      if (!response.ok) {
        throw new Error(payload?.message ?? 'テンプレ取得に失敗しました。')
      }
      cachedNotificationTemplates = payload?.templates ?? null
      return cachedNotificationTemplates
    })
    .finally(() => {
      inflightNotificationTemplatesPromise = null
    })

  return inflightNotificationTemplatesPromise
}

function clearNotificationTemplatesCache() {
  cachedNotificationTemplates = null
  inflightNotificationTemplatesPromise = null
}

export function NotificationTemplateEditor() {
  const [templates, setTemplates] = useState<Record<TemplateKey, TemplateRow>>({
    slot_reoffer_line: { subject: '', body: '', is_active: true },
    followup_line: { subject: '', body: '', is_active: true },
    next_visit_suggestion_line: { subject: '', body: '', is_active: true },
    reminder_line: { subject: '', body: '', is_active: true },
    medical_record_share_line: { subject: '', body: '', is_active: true },
    reminder_email: { subject: '', body: '', is_active: true },
  })
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<TemplateKey | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [activeTemplateKey, setActiveTemplateKey] = useState<TemplateKey>('slot_reoffer_line')
  const [testTargets, setTestTargets] = useState<Record<TemplateKey, string>>({
    slot_reoffer_line: '',
    followup_line: '',
    next_visit_suggestion_line: '',
    reminder_line: '',
    medical_record_share_line: '',
    reminder_email: '',
  })

  const loadTemplates = async () => {
    setLoading(true)
    setError('')
    try {
      const templatesPayload = await fetchNotificationTemplates()
      if (templatesPayload) {
        setTemplates((current) => ({
          slot_reoffer_line: templatesPayload.slot_reoffer_line ?? current.slot_reoffer_line,
          followup_line: templatesPayload.followup_line ?? current.followup_line,
          next_visit_suggestion_line:
            templatesPayload.next_visit_suggestion_line ?? current.next_visit_suggestion_line,
          reminder_line: templatesPayload.reminder_line ?? current.reminder_line,
          medical_record_share_line:
            templatesPayload.medical_record_share_line ?? current.medical_record_share_line,
          reminder_email: templatesPayload.reminder_email ?? current.reminder_email,
        }))
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'テンプレ取得中に通信エラーが発生しました。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTemplates()
  }, [])

  const saveTemplate = async (templateKey: TemplateKey) => {
    setSavingKey(templateKey)
    setMessage('')
    setError('')
    try {
      const template = templates[templateKey]
      const response = await fetch('/api/notification-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_key: templateKey,
          channel: templateKey === 'reminder_email' ? 'email' : 'line',
          subject: template.subject,
          body: template.body,
          is_active: template.is_active,
        }),
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        setError(payload?.message ?? 'テンプレ保存に失敗しました。')
        return
      }
      clearNotificationTemplatesCache()
      setMessage(`${TEMPLATE_LABELS[templateKey]}を保存しました。`)
    } catch {
      setError('テンプレ保存中に通信エラーが発生しました。')
    } finally {
      setSavingKey(null)
    }
  }

  const sendTest = async (templateKey: TemplateKey) => {
    const target = testTargets[templateKey].trim()
    if (!target) {
      setError('テスト送信先を入力してください。')
      return
    }

    setSavingKey(templateKey)
    setMessage('')
    setError('')
    try {
      const template = templates[templateKey]
      const response = await fetch('/api/notification-templates/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_key: templateKey,
          channel: templateKey === 'reminder_email' ? 'email' : 'line',
          target,
          subject: template.subject,
          body: template.body,
        }),
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        setError(payload?.message ?? 'テスト送信に失敗しました。')
        return
      }
      setMessage(`${TEMPLATE_LABELS[templateKey]}をテスト送信しました。`)
    } catch {
      setError('テスト送信中に通信エラーが発生しました。')
    } finally {
      setSavingKey(null)
    }
  }

  const previews = useMemo(
    () => ({
      slot_reoffer_line: {
        subject: templates.slot_reoffer_line.subject ?? 'キャンセル枠のご案内',
        body: renderSlotReofferLineTemplate({
          customerName: '山田様',
          menu: 'シャンプーコース',
          petName: 'ココ',
          startTime: '2026-03-02T10:00:00+09:00',
          endTime: '2026-03-02T11:30:00+09:00',
          note: 'ご希望の場合は店舗までご連絡ください。',
          templateBody: templates.slot_reoffer_line.body,
        }),
      },
      followup_line: {
        subject: templates.followup_line.subject ?? '再来店フォロー',
        body: renderFollowupLineTemplate({
          customerName: '山田様',
          lastVisitAt: '2026-01-10T10:00:00+09:00',
          recommendedAt: '2026-02-24T10:00:00+09:00',
          templateBody: templates.followup_line.body,
        }),
      },
      next_visit_suggestion_line: {
        subject: templates.next_visit_suggestion_line.subject ?? '次回来店のご提案',
        body: renderNextVisitSuggestionLineTemplate({
          customerName: '山田様',
          petName: 'ココ',
          lastVisitAt: '2026-02-01T10:00:00+09:00',
          recommendedAt: '2026-03-18T10:00:00+09:00',
          recommendationReason: '犬種: トイプードル / 毛量: 多め / 施術後45日目安',
          templateBody: templates.next_visit_suggestion_line.body,
        }),
      },
      reminder_line: (() => {
        const rendered = renderReminderTemplate({
          customerName: '山田様',
          storeName: '青山店',
          menu: 'カットコース',
          startTime: '2026-03-02T10:00:00+09:00',
          endTime: '2026-03-02T11:30:00+09:00',
          subjectTemplate: templates.reminder_line.subject,
          bodyTemplate: templates.reminder_line.body,
        })
        return rendered
      })(),
      medical_record_share_line: {
        subject: templates.medical_record_share_line.subject ?? '写真カルテ共有',
        body: renderMedicalRecordShareLineTemplate({
          customerName: '山田',
          petName: 'ココ',
          shareUrl: 'https://example.com/shared/medical-records/sample-token',
          templateBody: templates.medical_record_share_line.body,
        }),
      },
      reminder_email: (() => {
        const rendered = renderReminderTemplate({
          customerName: '山田様',
          storeName: '青山店',
          menu: 'カットコース',
          startTime: '2026-03-02T10:00:00+09:00',
          endTime: '2026-03-02T11:30:00+09:00',
          subjectTemplate: templates.reminder_email.subject,
          bodyTemplate: templates.reminder_email.body,
        })
        return rendered
      })(),
    }),
    [templates]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">通知テンプレ管理</h2>
          <p className="text-xs text-gray-500">再販、再来店フォロー、前日リマインドの文面を店舗単位で編集します。</p>
        </div>
        <Button type="button" className="bg-gray-700 hover:bg-gray-800" onClick={() => void loadTemplates()}>
          再読込
        </Button>
      </div>
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-gray-500">読み込み中...</p> : null}
      {!loading ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_KEYS.map((templateKey) => (
              <button
                key={templateKey}
                type="button"
                onClick={() => setActiveTemplateKey(templateKey)}
                className={`rounded px-3 py-2 text-sm font-semibold ${
                  activeTemplateKey === templateKey
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {TEMPLATE_LABELS[templateKey]}
              </button>
            ))}
          </div>
          <div className="rounded border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{TEMPLATE_LABELS[activeTemplateKey]}</h3>
                <p className="text-xs text-gray-500">
                  利用可能変数:
                  {activeTemplateKey === 'slot_reoffer_line'
                    ? ' {{customer_name}}, {{appointment_range}}, {{menu}}, {{pet_name}}, {{note}}'
                    : activeTemplateKey === 'followup_line'
                      ? ' {{customer_name}}, {{last_visit_date}}, {{recommended_date}}'
                      : activeTemplateKey === 'next_visit_suggestion_line'
                        ? ' {{customer_name}}, {{pet_name}}, {{last_visit_date}}, {{recommended_date}}, {{recommendation_reason}}'
                        : activeTemplateKey === 'medical_record_share_line'
                          ? ' {{customer_name}}, {{pet_name}}, {{share_url}}'
                          : ' {{customer_name}}, {{store_name}}, {{appointment_range}}, {{menu}}'}
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={templates[activeTemplateKey].is_active}
                  onChange={(event) =>
                    setTemplates((current) => ({
                      ...current,
                      [activeTemplateKey]: {
                        ...current[activeTemplateKey],
                        is_active: event.target.checked,
                      },
                    }))
                  }
                />
                有効
              </label>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="space-y-3">
                <label className="block space-y-2 text-sm text-gray-700">
                  <span>件名</span>
                  <input
                    value={templates[activeTemplateKey].subject ?? ''}
                    onChange={(event) =>
                      setTemplates((current) => ({
                        ...current,
                        [activeTemplateKey]: {
                          ...current[activeTemplateKey],
                          subject: event.target.value,
                        },
                      }))
                    }
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="block space-y-2 text-sm text-gray-700">
                  <span>本文</span>
                  <textarea
                    value={templates[activeTemplateKey].body}
                    onChange={(event) =>
                      setTemplates((current) => ({
                        ...current,
                        [activeTemplateKey]: {
                          ...current[activeTemplateKey],
                          body: event.target.value,
                        },
                      }))
                    }
                    rows={8}
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  />
                </label>
                <Button
                  type="button"
                  onClick={() => void saveTemplate(activeTemplateKey)}
                  disabled={savingKey === activeTemplateKey}
                >
                  {savingKey === activeTemplateKey ? '保存中...' : '保存'}
                </Button>
                <div className="rounded border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-gray-900">テスト送信</p>
                  <div className="mt-2 flex flex-col gap-2 md:flex-row">
                    <input
                      value={testTargets[activeTemplateKey]}
                      onChange={(event) =>
                        setTestTargets((current) => ({
                          ...current,
                          [activeTemplateKey]: event.target.value,
                        }))
                      }
                      className="w-full rounded border border-gray-300 px-3 py-2"
                      placeholder={
                        activeTemplateKey === 'reminder_email'
                          ? 'test@example.com'
                          : 'LINE user id'
                      }
                    />
                    <Button
                      type="button"
                      className="bg-amber-600 hover:bg-amber-700"
                      onClick={() => void sendTest(activeTemplateKey)}
                      disabled={savingKey === activeTemplateKey}
                    >
                      テスト送信
                    </Button>
                  </div>
                </div>
              </div>
              <div className="rounded border border-sky-200 bg-sky-50 p-3">
                <p className="text-sm font-semibold text-gray-900">プレビュー</p>
                <p className="mt-2 text-xs text-gray-500">件名</p>
                <p className="text-sm text-gray-800">{previews[activeTemplateKey].subject}</p>
                <p className="mt-3 text-xs text-gray-500">本文</p>
                <pre className="whitespace-pre-wrap text-sm text-gray-800">{previews[activeTemplateKey].body}</pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
