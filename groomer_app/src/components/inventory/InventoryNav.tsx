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
    <div className="rounded-lg border bg-white p-3">
      <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500">在庫管理メニュー</p>
      <div className="flex flex-wrap gap-2">
        {inventoryLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              isActive(link.href) ? 'bg-blue-100 font-semibold text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
