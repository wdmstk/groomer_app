import { redirect } from 'next/navigation'
import { DeveloperSupportChat } from '@/components/support/DeveloperSupportChat'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

export default async function DevSupportChatPage() {
  if (isPlaywrightE2E) {
    return <DeveloperSupportChat />
  }
  redirect('/dev/support-tickets')
}
