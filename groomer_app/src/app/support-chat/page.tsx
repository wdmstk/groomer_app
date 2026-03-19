import { redirect } from 'next/navigation'
import { OwnerSupportChat } from '@/components/support/OwnerSupportChat'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

export default async function SupportChatPage() {
  if (isPlaywrightE2E) {
    return <OwnerSupportChat />
  }
  redirect('/support-tickets')
}
