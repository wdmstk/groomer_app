import { ConsentSignClient } from '@/components/consents/ConsentSignClient'

type PageProps = {
  params: Promise<{ token: string }>
  searchParams?: Promise<{ service_name?: string; appointment_id?: string }>
}

export default async function ConsentSignPage({ params, searchParams }: PageProps) {
  const { token } = await params
  const resolvedSearchParams = await searchParams

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <ConsentSignClient
        token={token}
        serviceName={resolvedSearchParams?.service_name ?? ''}
        appointmentId={resolvedSearchParams?.appointment_id ?? ''}
      />
    </main>
  )
}
