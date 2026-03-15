'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getCustomerLtvRankLabel, getCustomerLtvRankTone } from '@/lib/customer-ltv'

type CustomerLtvSummaryRow = {
  annual_sales: number | null
  average_spend: number | null
  customer_id: string | null
  ltv_rank: string | null
  option_usage_rate: number | null
  visit_count: number | null
}

type CustomerLtvContextValue = {
  loading: boolean
  rowsByCustomerId: Map<string, CustomerLtvSummaryRow>
}

const CustomerLtvContext = createContext<CustomerLtvContextValue>({
  loading: true,
  rowsByCustomerId: new Map(),
})

let cachedCustomerLtvRows: CustomerLtvSummaryRow[] | null = null
let inflightCustomerLtvPromise: Promise<CustomerLtvSummaryRow[] | null> | null = null

async function fetchCustomerLtvRows() {
  if (cachedCustomerLtvRows) {
    return cachedCustomerLtvRows
  }
  if (inflightCustomerLtvPromise) {
    return inflightCustomerLtvPromise
  }

  inflightCustomerLtvPromise = fetch('/api/customers/ltv', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) return null
      const payload = (await response.json().catch(() => null)) as CustomerLtvSummaryRow[] | null
      cachedCustomerLtvRows = payload ?? []
      return cachedCustomerLtvRows
    })
    .finally(() => {
      inflightCustomerLtvPromise = null
    })

  return inflightCustomerLtvPromise
}

export function CustomerLtvProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<CustomerLtvSummaryRow[]>([])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const payload = await fetchCustomerLtvRows()
        if (!mounted) return
        setRows(payload ?? [])
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [])

  const value = useMemo(
    () => ({
      loading,
      rowsByCustomerId: new Map(
        rows
          .filter((row) => Boolean(row.customer_id))
          .map((row) => [row.customer_id as string, row])
      ),
    }),
    [loading, rows]
  )

  return <CustomerLtvContext.Provider value={value}>{children}</CustomerLtvContext.Provider>
}

function formatCurrency(value: number | null | undefined) {
  return Math.round(value ?? 0).toLocaleString()
}

export function CustomerLtvSummary({
  customerId,
  variant,
}: {
  customerId: string
  variant: 'mobile' | 'table'
}) {
  const { loading, rowsByCustomerId } = useContext(CustomerLtvContext)
  const row = rowsByCustomerId.get(customerId)

  if (variant === 'mobile') {
    return (
      <>
        <p>
          LTVランク:{' '}
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
              getCustomerLtvRankTone(row?.ltv_rank)
            }`}
          >
            {loading ? '...' : getCustomerLtvRankLabel(row?.ltv_rank)}
          </span>
        </p>
        <p>年間売上: {loading ? '読込中...' : `${formatCurrency(row?.annual_sales)}円`}</p>
        <p>来店回数: {loading ? '読込中...' : `${row?.visit_count ?? 0}回`}</p>
        <p>平均単価: {loading ? '読込中...' : `${formatCurrency(row?.average_spend)}円`}</p>
        <p>オプション利用率: {loading ? '読込中...' : `${row?.option_usage_rate ?? 0}%`}</p>
      </>
    )
  }

  return (
    <>
      <td className="py-3 px-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
            getCustomerLtvRankTone(row?.ltv_rank)
          }`}
        >
          {loading ? '...' : getCustomerLtvRankLabel(row?.ltv_rank)}
        </span>
      </td>
      <td className="py-3 px-2">{loading ? '読込中...' : `${formatCurrency(row?.annual_sales)} 円`}</td>
      <td className="py-3 px-2">{loading ? '読込中...' : `${row?.visit_count ?? 0} 回`}</td>
      <td className="py-3 px-2">{loading ? '読込中...' : `${formatCurrency(row?.average_spend)} 円`}</td>
      <td className="py-3 px-2">{loading ? '読込中...' : `${row?.option_usage_rate ?? 0}%`}</td>
    </>
  )
}
