'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  renderFollowupLineTemplate,
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
  | 'reminder_line'
  | 'reminder_email'

const TEMPLATE_KEYS: TemplateKey[] = [
  'slot_reoffer_line',
  'followup_line',
  'reminder_line',
  'reminder_email',
]

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  slot_reoffer_line: '再販LINEテンプレ',
  followup_line: '再来店フォローLINEテンプレ',
  reminder_line: '前日リマインドLINEテンプレ',
  reminder_email: '前日リマインドメールテンプレ',
}

export function NotificationTemplateEditor() {
  const [templates, setTemplates] = useState<Record<TemplateKey, TemplateRow>>({
    slot_reoffer_line: { subject: '', body: '', is_active: true },
    followup_line: { subject: '', body: '', is_active: true },
    reminder_line: { subject: '', body: '', is_active: true },
    reminder_email: { subject: '', body: '', is_active: true },
  })
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<TemplateKey | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [testTargets, setTestTargets] = useState<Record<TemplateKey, string>>({
    slot_reoffer_line: '',
    followup_line: '',
    reminder_line: '',
    reminder_email: '',
  })

  const loadTemplates = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/notification-templates?scope=notifications', { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as
        | {
            templates?: Record<TemplateKey, TemplateRow>
            message?: string
          }
        | null
      if (!response.ok) {
        setError(payload?.message ?? 'テンプレ取得に失敗しました。')
        return
      }
      if (payload?.templates) {
        setTemplates((current) => ({
          slot_reoffer_line: payload.templates?.slot_reoffer_line ?? current.slot_reoffer_line,
          followup_line: payload.templates?.followup_line ?? current.followup_line,
          reminder_line: payload.templates?.reminder_line ?? current.reminder_line,
          reminder_email: payload.templates?.reminder_email ?? current.reminder_email,
        }))
      }
    } catch {
      setError('テンプレ取得中に通信エラーが発生しました。')
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
      {!loading
        ? TEMPLATE_KEYS.map((templateKey) => (
            <div key={templateKey} className="rounded border bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{TEMPLATE_LABELS[templateKey]}</h3>
                  <p className="text-xs text-gray-500">
                    利用可能変数:
                    {templateKey === 'slot_reoffer_line'
                      ? ' {{customer_name}}, {{appointment_range}}, {{menu}}, {{pet_name}}, {{note}}'
                      : templateKey === 'followup_line'
                        ? ' {{customer_name}}, {{last_visit_date}}, {{recommended_date}}'
                        : ' {{customer_name}}, {{store_name}}, {{appointment_range}}, {{menu}}'}
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={templates[templateKey].is_active}
                    onChange={(event) =>
                      setTemplates((current) => ({
                        ...current,
                        [templateKey]: {
                          ...current[templateKey],
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
                      value={templates[templateKey].subject ?? ''}
                      onChange={(event) =>
                        setTemplates((current) => ({
                          ...current,
                          [templateKey]: {
                            ...current[templateKey],
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
                      value={templates[templateKey].body}
                      onChange={(event) =>
                        setTemplates((current) => ({
                          ...current,
                          [templateKey]: {
                            ...current[templateKey],
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
                    onClick={() => void saveTemplate(templateKey)}
                    disabled={savingKey === templateKey}
                  >
                    {savingKey === templateKey ? '保存中...' : '保存'}
                  </Button>
                  <div className="rounded border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-gray-900">テスト送信</p>
                    <div className="mt-2 flex flex-col gap-2 md:flex-row">
                      <input
                        value={testTargets[templateKey]}
                        onChange={(event) =>
                          setTestTargets((current) => ({
                            ...current,
                            [templateKey]: event.target.value,
                          }))
                        }
                        className="w-full rounded border border-gray-300 px-3 py-2"
                        placeholder={
                          templateKey === 'reminder_email'
                            ? 'test@example.com'
                            : 'LINE user id'
                        }
                      />
                      <Button
                        type="button"
                        className="bg-amber-600 hover:bg-amber-700"
                        onClick={() => void sendTest(templateKey)}
                        disabled={savingKey === templateKey}
                      >
                        テスト送信
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="rounded border border-sky-200 bg-sky-50 p-3">
                  <p className="text-sm font-semibold text-gray-900">プレビュー</p>
                  <p className="mt-2 text-xs text-gray-500">件名</p>
                  <p className="text-sm text-gray-800">{previews[templateKey].subject}</p>
                  <p className="mt-3 text-xs text-gray-500">本文</p>
                  <pre className="whitespace-pre-wrap text-sm text-gray-800">{previews[templateKey].body}</pre>
                </div>
              </div>
            </div>
          ))
        : null}
    </div>
  )
}
