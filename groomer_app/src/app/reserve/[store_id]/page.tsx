import { ReserveForm } from './reserve-form'

type ReservePageProps = {
  params: Promise<{
    store_id: string
  }>
  searchParams?: Promise<{
    member_portal_token?: string
  }>
}

export default async function ReservePage({ params, searchParams }: ReservePageProps) {
  const { store_id: storeId } = await params
  const resolvedSearchParams = await searchParams
  return (
    <ReserveForm
      storeId={storeId}
      memberPortalToken={resolvedSearchParams?.member_portal_token ?? ''}
    />
  )
}
