import { InviteAcceptClient } from './page-client'

type InviteTokenPageProps = {
  params: Promise<{
    token: string
  }>
}

export default async function InviteTokenPage({ params }: InviteTokenPageProps) {
  const { token } = await params
  return <InviteAcceptClient token={token} />
}
