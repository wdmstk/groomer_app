'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { useDismissibleModal } from '@/hooks/useDismissibleModal'

type PetCreateModalProps = {
  title: string
  children: ReactNode
  closeRedirectTo?: string
}

export function PetCreateModal({ title, children, closeRedirectTo = '/pets?tab=list' }: PetCreateModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const handleClose = useCallback(() => {
    if (closeRedirectTo) {
      router.push(closeRedirectTo)
      return
    }
    setOpen(false)
  }, [closeRedirectTo, router])
  const { modalPanelRef, handleBackdropClick } = useDismissibleModal({
    open,
    onClose: handleClose,
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded border bg-white p-3">
        <p className="text-sm text-gray-600">ペット登録はモーダルで入力します。</p>
        {!open ? (
          <Button type="button" onClick={() => setOpen(true)}>
            ペットモーダルを開く
          </Button>
        ) : null}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleBackdropClick}
        >
          <div
            ref={modalPanelRef}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <button
                type="button"
                onClick={handleClose}
                className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </div>
  )
}
