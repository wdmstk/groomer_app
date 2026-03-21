import { redirect } from 'next/navigation'

type RawSearchParams = Record<string, string | string[] | undefined>

type LegacySettingsPageProps = {
  searchParams?: Promise<RawSearchParams>
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function LegacySetupStoreSettingsPage({ searchParams }: LegacySettingsPageProps) {
  const params = (await searchParams) ?? {}
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (key === 'tab') return
    const normalized = firstParam(value)
    if (normalized) {
      query.set(key, normalized)
    }
  })
  query.set('tab', 'setup-store')
  redirect(`/settings?${query.toString()}`)
}
