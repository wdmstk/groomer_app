import Link from 'next/link'

export function GlobalFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-sm text-slate-100 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© GroomBase / SAKE Lab</p>
        <nav className="flex flex-wrap items-center gap-4">
          <Link href="/legal/privacy" className="font-medium text-slate-100 hover:text-sky-300 hover:underline">
            プライバシーポリシー
          </Link>
          <Link href="/legal/terms" className="font-medium text-slate-100 hover:text-sky-300 hover:underline">
            利用規約
          </Link>
          <Link href="/legal/security" className="font-medium text-slate-100 hover:text-sky-300 hover:underline">
            セキュリティポリシー
          </Link>
          <Link href="/legal/tokusho" className="font-medium text-slate-100 hover:text-sky-300 hover:underline">
            特定商取引法に基づく表記
          </Link>
        </nav>
      </div>
    </footer>
  )
}
