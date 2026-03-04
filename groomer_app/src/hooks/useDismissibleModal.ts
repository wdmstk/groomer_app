'use client'

import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'

type UseDismissibleModalParams = {
  open: boolean
  onClose: () => void
}

type UseDismissibleModalResult = {
  modalPanelRef: RefObject<HTMLDivElement | null>
  handleBackdropClick: (event: ReactMouseEvent<HTMLDivElement>) => void
}

export function useDismissibleModal({
  open,
  onClose,
}: UseDismissibleModalParams): UseDismissibleModalResult {
  const modalPanelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (modalPanelRef.current && !modalPanelRef.current.contains(event.target as Node)) {
      onClose()
    }
  }

  return {
    modalPanelRef,
    handleBackdropClick,
  }
}
