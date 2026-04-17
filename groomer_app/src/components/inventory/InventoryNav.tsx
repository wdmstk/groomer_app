'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const inventoryLinks = [
  { href: '/inventory', label: 'ダッシュボード' },
  { href: '/inventory/products', label: '商品マスタ' },
  { href: '/inventory/stocks', label: '在庫一覧' },
  { href: '/inventory/inbounds', label: '入庫登録' },
  { href: '/inventory/outbounds', label: '出庫登録' },
  { href: '/inventory/stocktake', label: '棚卸' },
  { href: '/inventory/purchase-orders', label: '発注管理' },
  { href: '/inventory/history', label: '在庫履歴' },
  { href: '/inventory/reports', label: 'レポート' },
]

export function InventoryNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/inventory') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-gray-200 bg-white p-2">
        {inventoryLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
              isActive(link.href) ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
