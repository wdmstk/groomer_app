'use client'

import { useMemo, useState } from 'react'

type ImpactItem = {
  label: string
  count: number
}

type DeleteWithImpactDialogButtonProps = {
  action: string
  formClassName?: string
  buttonClassName?: string
  mobileLabel?: string
  desktopLabel: string
  title: string
  description: string
  impacts: ImpactItem[]
}

export function DeleteWithImpactDialogButton({
  action,
  formClassName,
  buttonClassName,
  mobileLabel = '削除',
  desktopLabel,
  title,
  description,
  impacts,
}: DeleteWithImpactDialogButtonProps) {
  const [open, setOpen] = useState(false)
  const normalizedImpacts = useMemo(() => impacts.filter((item) => item.count > 0), [impacts])
  const totalCount = normalizedImpacts.reduce((sum, item) => sum + item.count, 0)

  return (
    <form action={action} method="post" className={formClassName}>
      <input type="hidden" name="_method" value="delete" />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          buttonClassName ??
          'inline-flex h-9 w-full items-center justify-center whitespace-nowrap px-2 font-medium text-red-700 hover:bg-red-50 sm:w-auto sm:px-3'
        }
      >
        <span className="sm:hidden">{mobileLabel}</span>
        <span className="hidden sm:inline">{desktopLabel}</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
          >
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-600">{description}</p>
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              {normalizedImpacts.length === 0 ? (
                <p className="text-sm text-gray-700">関連データは見つかりませんでした。</p>
              ) : (
                <ul className="space-y-1 text-sm text-gray-800">
                  {normalizedImpacts.map((item) => (
                    <li key={item.label} className="flex items-center justify-between">
                      <span>{item.label}</span>
                      <span className="font-semibold">{item.count}件</span>
                    </li>
                  ))}
                  <li className="mt-2 flex items-center justify-between border-t border-gray-300 pt-2 font-semibold text-gray-900">
                    <span>合計</span>
                    <span>{totalCount}件</span>
                  </li>
                </ul>
              )}
            </div>
            <p className="mt-3 text-xs font-semibold text-red-700">
              この操作は元に戻せません。キャンセルするか、続行して削除するかを選択してください。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700"
              >
                続行して削除
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </form>
  )
}
