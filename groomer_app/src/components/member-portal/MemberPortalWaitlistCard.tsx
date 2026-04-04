'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { decodePreferredMenus } from '@/lib/waitlist-preferred-menus'

type WaitlistRow = {
  id: string
  pet_id: string | null
  preferred_menu: string | null
  preferred_staff_id: string | null
  channel: string
  desired_from: string | null
  desired_to: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type WaitlistPayload = {
  waitlist?: WaitlistRow | null
  pets?: Array<{
    id: string
    name: string
  }>
  staffs?: Array<{
    id: string
    full_name: string
  }>
  serviceMenus?: Array<{
    id: string
    name: string
    duration: number | null
  }>
  defaultChannel?: 'manual' | 'line' | 'phone'
  message?: string
}

function toInputDateTime(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 16)
}

function formatDateTimeJst(value: string | null | undefined) {
  if (!value) return '未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未設定'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function MemberPortalWaitlistCard({ token }: { token: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pets, setPets] = useState<Array<{ id: string; name: string }>>([])
  const [staffs, setStaffs] = useState<Array<{ id: string; full_name: string }>>([])
  const [serviceMenus, setServiceMenus] = useState<Array<{ id: string; name: string; duration: number | null }>>([])
  const [waitlist, setWaitlist] = useState<WaitlistRow | null>(null)
  const [form, setForm] = useState({
    petId: '',
    preferredMenus: [] as string[],
    preferredStaffId: '',
    channel: 'manual' as 'manual' | 'line' | 'phone',
    desiredFrom: '',
    desiredTo: '',
    notes: '',
  })

  const endpoint = useMemo(
    () => `/api/public/member-portal/${encodeURIComponent(token)}/waitlist`,
    [token]
  )

  const applyWaitlistToForm = useCallback(
    (nextWaitlist: WaitlistRow | null, defaultChannel: 'manual' | 'line' | 'phone' = 'manual') => {
      setForm({
        petId: nextWaitlist?.pet_id ?? '',
        preferredMenus: decodePreferredMenus(nextWaitlist?.preferred_menu),
        preferredStaffId: nextWaitlist?.preferred_staff_id ?? '',
        channel:
          nextWaitlist?.channel === 'line' || nextWaitlist?.channel === 'phone'
            ? nextWaitlist.channel
            : defaultChannel,
        desiredFrom: toInputDateTime(nextWaitlist?.desired_from),
        desiredTo: toInputDateTime(nextWaitlist?.desired_to),
        notes: nextWaitlist?.notes ?? '',
      })
    },
    []
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(endpoint, { method: 'GET', cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as WaitlistPayload | null
      if (!response.ok) {
        setError(payload?.message ?? '空き枠待ち情報を取得できませんでした。')
        return
      }
      const nextWaitlist = payload?.waitlist ?? null
      setWaitlist(nextWaitlist)
      setPets(payload?.pets ?? [])
      setStaffs(payload?.staffs ?? [])
      setServiceMenus(payload?.serviceMenus ?? [])
      applyWaitlistToForm(nextWaitlist, payload?.defaultChannel ?? 'manual')
    } catch {
      setError('通信エラーが発生しました。')
    } finally {
      setLoading(false)
    }
  }, [applyWaitlistToForm, endpoint])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pet_id: form.petId || null,
          preferred_menus: form.preferredMenus,
          preferred_staff_id: form.preferredStaffId || null,
          channel: form.channel,
          desired_from: form.desiredFrom || null,
          desired_to: form.desiredTo || null,
          notes: form.notes || null,
        }),
      })
      const payload = (await response.json().catch(() => null)) as WaitlistPayload | null
      if (!response.ok) {
        setError(payload?.message ?? '空き枠待ちの登録に失敗しました。')
        return
      }
      const nextWaitlist = payload?.waitlist ?? null
      setWaitlist(nextWaitlist)
      applyWaitlistToForm(nextWaitlist, form.channel)
      setMessage(payload?.message ?? '空き枠待ちを登録しました。')
    } catch {
      setError('登録中に通信エラーが発生しました。')
    } finally {
      setSaving(false)
    }
  }

  const cancel = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(endpoint, { method: 'DELETE' })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        setError(payload?.message ?? '空き枠待ちの解除に失敗しました。')
        return
      }
      setWaitlist(null)
      applyWaitlistToForm(null, form.channel)
      setMessage(payload?.message ?? '空き枠待ちを解除しました。')
    } catch {
      setError('解除中に通信エラーが発生しました。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="space-y-3 border border-slate-200">
      <div>
        <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">空き枠案内</p>
        <h2 className="text-xl font-semibold text-slate-900">空き枠待ち登録</h2>
      </div>
      <p className="text-sm text-slate-600">
        キャンセル枠が出たときの優先案内を希望する場合、ここから登録できます。
      </p>
      {waitlist ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          登録済み: 最終更新 {formatDateTimeJst(waitlist.updated_at)}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-slate-600">読み込み中...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            ペット
            <select
              value={form.petId}
              onChange={(event) => setForm((current) => ({ ...current, petId: event.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            >
              <option value="">未指定</option>
              {pets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            連絡方法
            <select
              value={form.channel}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  channel: event.target.value === 'line' || event.target.value === 'phone' ? event.target.value : 'manual',
                }))
              }
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            >
              <option value="manual">手動</option>
              <option value="line">LINE</option>
              <option value="phone">電話</option>
            </select>
          </label>
          <fieldset className="space-y-1 text-sm text-slate-700 sm:col-span-2">
            希望メニュー
            <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-slate-300 bg-white p-2">
              {serviceMenus.length === 0 ? (
                <p className="text-xs text-slate-500">選択可能なメニューがありません。</p>
              ) : (
                serviceMenus.map((menu) => {
                  const checked = form.preferredMenus.includes(menu.name)
                  return (
                    <label key={menu.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setForm((current) => {
                            if (event.target.checked) {
                              return {
                                ...current,
                                preferredMenus: [...current.preferredMenus, menu.name],
                              }
                            }
                            return {
                              ...current,
                              preferredMenus: current.preferredMenus.filter((name) => name !== menu.name),
                            }
                          })
                        }
                      />
                      <span>
                        {menu.name}
                        {typeof menu.duration === 'number' && menu.duration > 0 ? ` (${menu.duration}分)` : ''}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </fieldset>
          <label className="space-y-1 text-sm text-slate-700">
            希望担当
            <select
              value={form.preferredStaffId}
              onChange={(event) =>
                setForm((current) => ({ ...current, preferredStaffId: event.target.value }))
              }
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            >
              <option value="">未指定</option>
              {staffs.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            希望開始
            <input
              type="datetime-local"
              value={form.desiredFrom}
              onChange={(event) => setForm((current) => ({ ...current, desiredFrom: event.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            希望終了
            <input
              type="datetime-local"
              value={form.desiredTo}
              onChange={(event) => setForm((current) => ({ ...current, desiredTo: event.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
            メモ
            <input
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="平日午前だと調整しやすいです"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void save()} disabled={loading || saving}>
          {saving ? '保存中...' : waitlist ? '登録内容を更新' : '空き枠待ちを登録'}
        </Button>
        {waitlist ? (
          <Button
            type="button"
            onClick={() => void cancel()}
            disabled={loading || saving}
            className="bg-slate-200 text-slate-800 hover:bg-slate-300"
          >
            登録を解除
          </Button>
        ) : null}
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </Card>
  )
}
