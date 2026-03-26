import { ConsentSignClient } from '@/components/consents/ConsentSignClient'

type PageProps = {
  params: Promise<{ token: string }>
}

export default async function ConsentSignPage({ params }: PageProps) {
  const { token } = await params

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <ConsentSignClient token={token} />
    </main>
  )
}
