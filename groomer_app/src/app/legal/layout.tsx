import Link from 'next/link'

export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link href="/lp" className="text-sm text-sky-700 hover:underline">
            料金ページに戻る
          </Link>
        </div>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">{children}</article>
      </div>
    </main>
  )
}

