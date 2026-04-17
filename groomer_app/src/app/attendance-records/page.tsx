import { redirect } from 'next/navigation'

type PageProps = {
  searchParams?: Promise<{
    attendance_staff_id?: string
    attendance_month?: string
  }>
}

export default async function AttendanceRecordsPage({ searchParams }: PageProps) {
  const resolved = await searchParams
  const query = new URLSearchParams()
  query.set('tab', 'attendance-records')
  if (resolved?.attendance_staff_id) query.set('attendance_staff_id', resolved.attendance_staff_id)
  if (resolved?.attendance_month) query.set('attendance_month', resolved.attendance_month)
  redirect(`/staffs?${query.toString()}`)
}
