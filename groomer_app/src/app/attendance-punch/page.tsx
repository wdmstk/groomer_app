import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { AttendancePunchActionPanel } from '@/components/attendance/AttendancePunchActionPanel'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { resolveAttendanceFeatureState } from '@/lib/attendance/feature'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams?: Promise<{
    staff_id?: string
  }>
}

type StoreRole = 'owner' | 'admin' | 'staff'

function todayDateKeyJst() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export default async function AttendancePunchPage({ searchParams }: PageProps) {
  const resolved = await searchParams
  const selectedStaffId = (resolved?.staff_id ?? '').trim()
  const { supabase, storeId } = await createStoreScopedClient()
  const db = supabase

  const { data: userResult } = await db.auth.getUser()
  const user = userResult.user
  const [{ data: membership }, { data: staffs }] = await Promise.all([
    db
      .from('store_memberships')
      .select('role')
      .eq('store_id', storeId)
      .eq('user_id', user?.id ?? '__none__')
      .eq('is_active', true)
      .maybeSingle(),
    db.from('staffs').select('id, full_name, user_id').eq('store_id', storeId).order('created_at', { ascending: true }),
  ])
  const role = (membership?.role ?? 'staff') as StoreRole
  const ownStaffId = (staffs ?? []).find((staff) => staff.user_id && staff.user_id === user?.id)?.id ?? ''

  const attendanceFeature = await resolveAttendanceFeatureState({ db, storeId })
  if (attendanceFeature.message) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">勤怠打刻</h1>
        <Card>
          <p className="text-sm text-red-700">{attendanceFeature.message}</p>
        </Card>
      </section>
    )
  }
  if (!attendanceFeature.enabled) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">勤怠打刻</h1>
        <Card>
          <p className="text-sm text-gray-600 dark:text-slate-300">この店舗では勤怠機能が無効です。</p>
        </Card>
      </section>
    )
  }

  const targetStaffs =
    role === 'owner' || role === 'admin'
      ? (staffs ?? [])
      : (staffs ?? []).filter((staff) => staff.id === ownStaffId)
  const canSelect = targetStaffs.some((staff) => staff.id === selectedStaffId)
  const targetStaffId = canSelect ? selectedStaffId : ''
  const targetStaff = targetStaffs.find((staff) => staff.id === targetStaffId) ?? null
  const businessDate = todayDateKeyJst()
  const [{ data: shiftSettings }, { data: todaysEvents }] = await Promise.all([
    db
      .from('store_shift_settings')
      .select('attendance_location_required')
      .eq('store_id', storeId)
      .maybeSingle(),
    targetStaff
      ? db
          .from('attendance_events')
          .select('event_type, occurred_at')
          .eq('store_id', storeId)
          .eq('staff_id', targetStaff.id)
          .eq('business_date', businessDate)
          .order('occurred_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ])
  const locationRequired = shiftSettings?.attendance_location_required === true

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">勤怠打刻</h1>
      {!targetStaff ? (
        <Card>
          <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">スタッフを選択</h2>
          <div className="flex flex-wrap gap-2">
            {targetStaffs.map((staff) => (
              <Link
                key={staff.id}
                href={`/attendance-punch?staff_id=${staff.id}`}
                className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                {staff.full_name}
              </Link>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">{targetStaff.full_name} の打刻</h2>
            <Link
              href="/attendance-punch"
              className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
            >
              スタッフ選択に戻る
            </Link>
          </div>
          <AttendancePunchActionPanel
            staffId={targetStaff.id}
            redirectTo={`/attendance-punch?staff_id=${targetStaff.id}`}
            businessDate={businessDate}
            locationRequired={locationRequired}
            events={
              (todaysEvents ?? []) as Array<{
                event_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
                occurred_at: string
              }>
            }
          />
        </Card>
      )}
    </section>
  )
}
