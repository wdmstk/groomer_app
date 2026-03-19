import { ReserveForm } from './reserve-form'

type ReservePageProps = {
  params: Promise<{
    store_id: string
  }>
  searchParams?: Promise<{
    member_portal_token?: string
    memberPortalToken?: string
    token?: string
    mode?: string
  }>
}

export default async function ReservePage({ params, searchParams }: ReservePageProps) {
  const { store_id: storeId } = await params
  const resolvedSearchParams = await searchParams
  const memberPortalToken =
    resolvedSearchParams?.member_portal_token ??
    resolvedSearchParams?.memberPortalToken ??
    resolvedSearchParams?.token ??
    ''
  const reservationMode = resolvedSearchParams?.mode === 'repeat' ? 'repeat' : 'new'
  return (
    <ReserveForm
      storeId={storeId}
      memberPortalToken={memberPortalToken}
      reservationMode={reservationMode}
    />
  )
}
