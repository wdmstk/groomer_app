import { CancelReservationClient } from './page-client'

type CancelPageProps = {
  searchParams: Promise<{
    token?: string
  }>
}

export default async function CancelReservationPage({ searchParams }: CancelPageProps) {
  const resolved = await searchParams
  const token = resolved.token ?? ''
  return <CancelReservationClient token={token} />
}
