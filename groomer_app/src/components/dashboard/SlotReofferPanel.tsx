'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatPreferredMenusLabel } from '@/lib/waitlist-preferred-menus'

type SlotCandidate = {
  source: 'waitlist' | 'history'
  customer_id: string
  customer_name: string
  phone_number: string | null
  line_id: string | null
  pet_id: string | null
  pet_name: string | null
  breed: string | null
  score: number
  last_visit_at: string | null
  channel: 'line' | 'phone' | 'manual'
  waitlist_id: string | null
}

type SlotSentLog = {
  id: string
  target_customer_id: string | null
  target_pet_id: string | null
  target_staff_id: string | null
  target_customer_name: string | null
  target_pet_name: string | null
  target_staff_name: string | null
  status: string
  sent_at: string | null
  accepted_at: string | null
  notes: string | null
}

type SlotNotificationLog = {
  id: string
  customer_name: string | null
  channel: string
  status: string
  subject: string | null
  sent_at: string
}

type SlotTimelineLog = {
  id: string
  event_type: string
  created_at: string
  target_customer_name: string | null
}

type SlotRow = {
  appointment_id: string
  start_time: string
  end_time: string
  menu: string
  canceled_pet_name: string | null
  canceled_pet_breed: string | null
  canceled_staff_name: string | null
  candidates: SlotCandidate[]
  sent_logs: SlotSentLog[]
  notification_logs: SlotNotificationLog[]
  timeline: SlotTimelineLog[]
}

type WaitlistRow = {
  id: string
  customer_id: string
  customer_name: string
  pet_id: string | null
  pet_name: string | null
  desired_from: string | null
  desired_to: string | null
  preferred_menu: string | null
  preferred_staff_id: string | null
  preferred_staff_name: string | null
  channel: string
  notes: string | null
  created_at: string
}

type CustomerOption = {
  id: string
  full_name: string
  phone_number: string | null
  line_id: string | null
  pets: Array<{
    id: string
    name: string
    breed: string | null
  }>
}

type StaffOption = {
  id: string
  full_name: string
}

type ServiceMenuOption = {
  id: string
  name: string
  duration: number | null
}

type ReofferPayload = {
  slots?: SlotRow[]
  waitlists?: WaitlistRow[]
  customers?: CustomerOption[]
  staffs?: StaffOption[]
  service_menus?: ServiceMenuOption[]
  message?: string
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatEventLabel(eventType: string) {
  switch (eventType) {
    case 'slot_opened':
      return '空き枠化'
    case 'candidate_selected':
      return '候補選定'
    case 'sent':
      return '送信記録'
    case 'drafted':
      return '起票'
    case 'accepted':
      return '受付完了'
    case 'appointment_created':
      return '予約作成'
    case 'expired':
      return '期限切れ'
    case 'canceled':
      return '取り下げ'
    default:
      return eventType
  }
}

export function SlotReofferPanel() {
  const [slots, setSlots] = useState<SlotRow[]>([])
  const [waitlists, setWaitlists] = useState<WaitlistRow[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [staffs, setStaffs] = useState<StaffOption[]>([])
  const [serviceMenus, setServiceMenus] = useState<ServiceMenuOption[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [phoneModal, setPhoneModal] = useState<{
    reofferId: string
    customerName: string
    result: 'connected' | 'voicemail' | 'no_answer'
    note: string
  } | null>(null)
  const [waitlistForm, setWaitlistForm] = useState({
    customerId: '',
    petId: '',
    preferredMenus: [] as string[],
    desiredFrom: '',
    desiredTo: '',
    preferredStaffId: '',
    channel: 'manual',
    notes: '',
  })

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === waitlistForm.customerId) ?? null,
    [customers, waitlistForm.customerId]
  )

  const loadSlots = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/reoffers', { method: 'GET', cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as ReofferPayload | null
      if (!response.ok) {
        setError(payload?.message ?? '空き枠再販データの取得に失敗しました。')
        return
      }
      setSlots(payload?.slots ?? [])
      setWaitlists(payload?.waitlists ?? [])
      setCustomers(payload?.customers ?? [])
      setStaffs(payload?.staffs ?? [])
      setServiceMenus(payload?.service_menus ?? [])
      if (payload?.customers?.[0]?.id) {
        const firstCustomer = payload.customers[0]
        setWaitlistForm((current) =>
          current.customerId
            ? current
            : {
                ...current,
                customerId: firstCustomer.id,
                petId: firstCustomer.pets[0]?.id ?? '',
              }
        )
      }
    } catch {
      setError('空き枠再販データの取得中に通信エラーが発生しました。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSlots()
  }, [loadSlots])

  const sendReoffer = async (slot: SlotRow, candidate: SlotCandidate) => {
    setSavingId(`${slot.appointment_id}:${candidate.customer_id}:send`)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/reoffers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'reoffer_draft',
          appointment_id: slot.appointment_id,
          target_customer_id: candidate.customer_id,
          target_pet_id: candidate.pet_id,
          target_staff_id: null,
          channel: candidate.channel,
          subject: 'キャンセル枠のご案内',
          notes:
            candidate.source === 'waitlist'
              ? 'waitlist 登録顧客へキャンセル枠の案内を記録'
              : 'ダッシュボードから再販送信記録',
        }),
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        setError(payload?.message ?? '再販送信記録に失敗しました。')
        return
      }
      setMessage(`${candidate.customer_name}様への再販案内を起票しました。`)
      await loadSlots()
    } catch {
      setError('再販送信記録中に通信エラーが発生しました。')
    } finally {
      setSavingId(null)
    }
  }

  const approveReofferSend = async (log: SlotSentLog) => {
    setSavingId(`${log.id}:approve-send`)
    setMessage('')
    setError('')
    try {
      const response = await fetch(`/api/reoffers/${log.id}/approve-send`, {
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        setError(payload?.message ?? '承認送信に失敗しました。')
        return
      }
      setMessage(`${log.target_customer_name ?? '対象顧客'} への再販送信を承認しました。`)
      await loadSlots()
    } catch {
      setError('承認送信中に通信エラーが発生しました。')
    } finally {
      setSavingId(null)
    }
  }

  const updateReofferStatus = async (
    slot: SlotRow,
    log: SlotSentLog,
    status: 'accepted' | 'expired' | 'canceled'
  ) => {
    const label =
      status === 'accepted' ? '受付完了' : status === 'expired' ? '期限切れ' : '取り下げ'
    const notes =
      window.prompt(`${label} のメモを入力してください。不要なら空欄のままで構いません。`, '') ?? ''

    setSavingId(`${log.id}:${status}`)
    setMessage('')
    setError('')
    try {
      const response = await fetch(`/api/reoffers/${log.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          notes,
        }),
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        setError(payload?.message ?? `${label} に失敗しました。`)
        return
      }
      if (status === 'accepted' && log.target_customer_id) {
        const query = new URLSearchParams({
          tab: 'trimmer',
          modal: 'create',
          reoffer_id: log.id,
          reoffer_customer_id: log.target_customer_id,
          reoffer_start_time: slot.start_time,
          reoffer_end_time: slot.end_time,
        })
        if (log.target_pet_id) query.set('reoffer_pet_id', log.target_pet_id)
        if (log.target_staff_id) query.set('reoffer_staff_id', log.target_staff_id)
        if (log.notes) query.set('reoffer_note', log.notes)
        window.location.assign(`/reservation-management?${query.toString()}`)
        return
      }
      setMessage(`再販記録を ${label} に更新しました。`)
      await loadSlots()
    } catch {
      setError(`${label} 更新中に通信エラーが発生しました。`)
    } finally {
      setSavingId(null)
    }
  }

  const submitPhoneResult = async () => {
    if (!phoneModal) return

    setSavingId(`${phoneModal.reofferId}:phone`)
    setMessage('')
    setError('')
    try {
      const response = await fetch(`/api/reoffers/${phoneModal.reofferId}/phone-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: phoneModal.result,
          note: phoneModal.note,
        }),
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        setError(payload?.message ?? '電話結果の記録に失敗しました。')
        return
      }
      setMessage('電話結果を記録しました。')
      setPhoneModal(null)
      await loadSlots()
    } catch {
      setError('電話結果の記録中に通信エラーが発生しました。')
    } finally {
      setSavingId(null)
    }
  }

  const createWaitlist = async () => {
    if (!waitlistForm.customerId) {
      setError('waitlist 登録には顧客が必要です。')
      return
    }

    setSavingId('waitlist:create')
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/reoffers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'waitlist',
          customer_id: waitlistForm.customerId,
          pet_id: waitlistForm.petId || null,
          desired_from: waitlistForm.desiredFrom || null,
          desired_to: waitlistForm.desiredTo || null,
          preferred_menus: waitlistForm.preferredMenus,
          preferred_staff_id: waitlistForm.preferredStaffId || null,
          channel: waitlistForm.channel,
          notes: waitlistForm.notes || null,
        }),
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        setError(payload?.message ?? 'waitlist 登録に失敗しました。')
        return
      }
      setMessage('waitlist を登録しました。')
      setWaitlistForm((current) => ({
        ...current,
        desiredFrom: '',
        desiredTo: '',
        preferredMenus: [],
        preferredStaffId: '',
        notes: '',
      }))
      await loadSlots()
    } catch {
      setError('waitlist 登録中に通信エラーが発生しました。')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">キャンセル枠の即時再販</h2>
          <p className="text-xs text-gray-500">通知記録、waitlist、受付完了までここで閉じます。</p>
        </div>
        <Button type="button" className="bg-gray-700 hover:bg-gray-800" onClick={() => void loadSlots()}>
          再読込
        </Button>
      </div>

      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="rounded border border-sky-200 bg-sky-50 p-3">
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900">waitlist 登録</h3>
          <p className="text-xs text-gray-600">直前空き枠を優先案内したい顧客を先に登録します。</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-gray-700">
            顧客
            <select
              value={waitlistForm.customerId}
              onChange={(event) => {
                const nextCustomer = customers.find((customer) => customer.id === event.target.value) ?? null
                setWaitlistForm((current) => ({
                  ...current,
                  customerId: event.target.value,
                  petId: nextCustomer?.pets[0]?.id ?? '',
                }))
              }}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="">選択してください</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            ペット
            <select
              value={waitlistForm.petId}
              onChange={(event) =>
                setWaitlistForm((current) => ({ ...current, petId: event.target.value }))
              }
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="">未指定</option>
              {(selectedCustomer?.pets ?? []).map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            希望メニュー
            <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded border border-gray-300 bg-white p-2">
              {serviceMenus.length === 0 ? (
                <p className="text-xs text-gray-500">選択可能なメニューがありません。</p>
              ) : (
                serviceMenus.map((menu) => {
                  const checked = waitlistForm.preferredMenus.includes(menu.name)
                  return (
                    <label key={menu.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setWaitlistForm((current) => {
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
          </label>
          <label className="text-sm text-gray-700">
            希望担当
            <select
              value={waitlistForm.preferredStaffId}
              onChange={(event) =>
                setWaitlistForm((current) => ({ ...current, preferredStaffId: event.target.value }))
              }
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="">未指定</option>
              {staffs.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            希望開始
            <input
              type="datetime-local"
              value={waitlistForm.desiredFrom}
              onChange={(event) =>
                setWaitlistForm((current) => ({ ...current, desiredFrom: event.target.value }))
              }
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            希望終了
            <input
              type="datetime-local"
              value={waitlistForm.desiredTo}
              onChange={(event) =>
                setWaitlistForm((current) => ({ ...current, desiredTo: event.target.value }))
              }
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            案内チャネル
            <select
              value={waitlistForm.channel}
              onChange={(event) =>
                setWaitlistForm((current) => ({
                  ...current,
                  channel: event.target.value as 'line' | 'phone' | 'manual',
                }))
              }
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="manual">手動</option>
              <option value="line">LINE</option>
              <option value="phone">電話</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            メモ
            <input
              value={waitlistForm.notes}
              onChange={(event) =>
                setWaitlistForm((current) => ({ ...current, notes: event.target.value }))
              }
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              placeholder="木曜午前希望"
            />
          </label>
        </div>
        <div className="mt-3">
          <Button
            type="button"
            onClick={() => void createWaitlist()}
            disabled={savingId === 'waitlist:create'}
          >
            waitlist を登録
          </Button>
        </div>
        {waitlists.length > 0 ? (
          <div className="mt-4 space-y-2 border-t border-sky-200 pt-3 text-sm">
            <p className="font-semibold text-gray-900">登録済み waitlist</p>
            {waitlists.slice(0, 6).map((waitlist) => (
              <div key={waitlist.id} className="rounded border bg-white p-3">
                <p className="font-medium text-gray-900">
                  {waitlist.customer_name} / {waitlist.pet_name ?? 'ペット未指定'}
                </p>
                <p className="text-gray-700">
                  希望: {formatPreferredMenusLabel(waitlist.preferred_menu)} / 担当:{' '}
                  {waitlist.preferred_staff_name ?? '未指定'} / チャネル: {waitlist.channel}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDateTime(waitlist.desired_from)} - {formatDateTime(waitlist.desired_to)} / 登録:{' '}
                  {formatDateTime(waitlist.created_at)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-gray-500">読み込み中...</p> : null}
      {!loading && slots.length === 0 ? (
        <p className="text-sm text-gray-500">本日/明日のキャンセル枠はありません。</p>
      ) : null}

      {!loading
        ? slots.map((slot) => (
            <div key={slot.appointment_id} className="rounded border border-orange-200 bg-orange-50 p-3">
              <div className="mb-3">
                <p className="font-semibold text-gray-900">
                  {formatDateTime(slot.start_time)} - {formatDateTime(slot.end_time)}
                </p>
                <p className="text-sm text-gray-700">
                  メニュー: {slot.menu} / ペット: {slot.canceled_pet_name ?? '未登録'} / 犬種:{' '}
                  {slot.canceled_pet_breed ?? '未登録'} / 担当: {slot.canceled_staff_name ?? '未登録'}
                </p>
              </div>

              {slot.candidates.length === 0 ? (
                <p className="text-sm text-gray-500">候補顧客は見つかりません。</p>
              ) : (
                <div className="space-y-2">
                  {slot.candidates.map((candidate) => (
                    <div
                      key={`${slot.appointment_id}:${candidate.customer_id}`}
                      className="flex flex-col gap-2 rounded border bg-white p-3 text-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {candidate.customer_name} / {candidate.pet_name ?? 'ペット未登録'}
                        </p>
                        <p className="text-gray-700">
                          候補元: {candidate.source === 'waitlist' ? 'waitlist' : '履歴'} / 犬種:{' '}
                          {candidate.breed ?? '未登録'} / 電話: {candidate.phone_number ?? '未登録'} / LINE:{' '}
                          {candidate.line_id ?? '未登録'}
                        </p>
                        <p className="text-xs text-gray-500">
                          候補スコア: {candidate.score} / 前回来店:{' '}
                          {candidate.last_visit_at ? formatDateTime(candidate.last_visit_at) : '不明'} / 想定チャネル:{' '}
                          {candidate.channel}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {candidate.phone_number ? (
                          <a
                            href={`tel:${candidate.phone_number}`}
                            className="rounded bg-gray-700 px-2 py-1 text-xs font-semibold text-white"
                          >
                            電話
                          </a>
                        ) : null}
                        <Button
                          type="button"
                          onClick={() => void sendReoffer(slot, candidate)}
                          disabled={savingId === `${slot.appointment_id}:${candidate.customer_id}:send`}
                        >
                          再販案内を起票
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {slot.sent_logs.length > 0 ? (
                <div className="mt-3 space-y-2 border-t pt-3 text-xs text-gray-600">
                  <p className="font-semibold text-gray-700">再販送信記録</p>
                  {slot.sent_logs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-col gap-2 rounded border bg-white p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {log.target_customer_name ?? '未登録'} / {log.status}
                        </p>
                        <p className="text-gray-700">
                          ペット: {log.target_pet_name ?? '未登録'} / 担当: {log.target_staff_name ?? '未指定'}
                        </p>
                        <p className="text-xs text-gray-500">
                          送信: {formatDateTime(log.sent_at)} / 受付: {formatDateTime(log.accepted_at)}
                        </p>
                      </div>
                      {log.status === 'draft' ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => void approveReofferSend(log)}
                            disabled={savingId === `${log.id}:approve-send`}
                          >
                            承認して送信
                          </Button>
                          <Button
                            type="button"
                            className="bg-gray-700 hover:bg-gray-800"
                            onClick={() => void updateReofferStatus(slot, log, 'canceled')}
                            disabled={savingId === `${log.id}:canceled`}
                          >
                            起票を取り下げ
                          </Button>
                        </div>
                      ) : null}
                      {log.status === 'sent' ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            className="bg-sky-600 hover:bg-sky-700"
                            onClick={() =>
                              setPhoneModal({
                                reofferId: log.id,
                                customerName: log.target_customer_name ?? '未登録',
                                result: 'connected',
                                note: '',
                              })
                            }
                            disabled={savingId === `${log.id}:phone`}
                          >
                            電話結果
                          </Button>
                          <Button
                            type="button"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => void updateReofferStatus(slot, log, 'accepted')}
                            disabled={savingId === `${log.id}:accepted`}
                          >
                            受付完了して予約作成
                          </Button>
                          <Button
                            type="button"
                            className="bg-amber-600 hover:bg-amber-700"
                            onClick={() => void updateReofferStatus(slot, log, 'expired')}
                            disabled={savingId === `${log.id}:expired`}
                          >
                            期限切れ
                          </Button>
                          <Button
                            type="button"
                            className="bg-gray-700 hover:bg-gray-800"
                            onClick={() => void updateReofferStatus(slot, log, 'canceled')}
                            disabled={savingId === `${log.id}:canceled`}
                          >
                            取り下げ
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {slot.notification_logs.length > 0 ? (
                <div className="mt-3 border-t pt-3 text-xs text-gray-600">
                  <p className="font-semibold text-gray-700">通知ログ</p>
                  <div className="space-y-1">
                    {slot.notification_logs.slice(0, 5).map((log) => (
                      <p key={log.id}>
                        {log.customer_name ?? '未登録'} / {log.channel} / {log.status} /{' '}
                        {log.sent_at ? formatDateTime(log.sent_at) : '-'}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {slot.timeline.length > 0 ? (
                <div className="mt-3 border-t pt-3 text-xs text-gray-600">
                  <p className="font-semibold text-gray-700">イベント履歴</p>
                  <div className="space-y-1">
                    {slot.timeline.slice(0, 6).map((log) => (
                      <p key={log.id}>
                        {formatEventLabel(log.event_type)} / {log.target_customer_name ?? '未登録'} /{' '}
                        {formatDateTime(log.created_at)}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))
        : null}

      {phoneModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">電話結果を記録</h3>
              <button
                type="button"
                onClick={() => setPhoneModal(null)}
                className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-700">{phoneModal.customerName}</p>
              <label className="space-y-2 text-sm text-gray-700">
                通話結果
                <select
                  value={phoneModal.result}
                  onChange={(event) =>
                    setPhoneModal((current) =>
                      current
                        ? {
                            ...current,
                            result: event.target.value as 'connected' | 'voicemail' | 'no_answer',
                          }
                        : current
                    )
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2"
                >
                  <option value="connected">接続</option>
                  <option value="voicemail">留守電</option>
                  <option value="no_answer">不在</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                メモ
                <textarea
                  value={phoneModal.note}
                  onChange={(event) =>
                    setPhoneModal((current) =>
                      current
                        ? {
                            ...current,
                            note: event.target.value,
                          }
                        : current
                    )
                  }
                  rows={4}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                  placeholder="折り返し希望、再連絡時間帯など"
                />
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => void submitPhoneResult()}
                  disabled={savingId === `${phoneModal.reofferId}:phone`}
                >
                  保存
                </Button>
                <button
                  type="button"
                  onClick={() => setPhoneModal(null)}
                  className="text-sm text-gray-500"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
