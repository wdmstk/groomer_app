import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'

type ServiceMenuRow = {
  id: string
  name: string
  duration: number
}

type AppointmentDurationLearningRow = {
  menu: string | null
  duration: number | null
}

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()
  const learningWindowDays = 60
  const learningStartIso = new Date(Date.now() - learningWindowDays * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: menus, error: menusError }, { data: completedAppointments, error: appointmentsError }] =
    await Promise.all([
      supabase
        .from('service_menus')
        .select('id, name, duration')
        .eq('store_id', storeId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false }),
      supabase
        .from('appointments')
        .select('menu, duration')
        .eq('store_id', storeId)
        .in('status', ['完了', '来店済'])
        .gte('start_time', learningStartIso)
        .not('duration', 'is', null),
    ])

  const error = menusError ?? appointmentsError
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  const menuRows = (menus ?? []) as ServiceMenuRow[]
  const durationLearningRows = (completedAppointments ?? []) as AppointmentDurationLearningRow[]
  const actualDurationsByMenu = new Map<string, number[]>()

  durationLearningRows.forEach((row) => {
    const menuName = row.menu?.trim()
    if (!menuName || !row.duration || row.duration <= 0) return
    const list = actualDurationsByMenu.get(menuName) ?? []
    list.push(row.duration)
    actualDurationsByMenu.set(menuName, list)
  })

  const rows = menuRows
    .map((menu) => {
      const samples = actualDurationsByMenu.get(menu.name) ?? []
      if (samples.length < 5) return null
      const avg = Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length)
      const delta = avg - menu.duration
      if (Math.abs(delta) < 10) return null
      return {
        id: menu.id,
        name: menu.name,
        currentDuration: menu.duration,
        recommendedDuration: Math.max(1, avg),
        sampleCount: samples.length,
        delta,
      }
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs((b?.delta ?? 0)) - Math.abs((a?.delta ?? 0)))

  return NextResponse.json({
    learningWindowDays,
    rows,
  })
}
