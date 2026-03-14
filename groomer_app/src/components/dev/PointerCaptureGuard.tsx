'use client'

import { useEffect } from 'react'

export function PointerCaptureGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    if (typeof window === 'undefined') return

    const proto = Element.prototype as Element & {
      releasePointerCapture(pointerId: number): void
    }
    const original = proto.releasePointerCapture
    if (typeof original !== 'function') return

    proto.releasePointerCapture = function safeReleasePointerCapture(pointerId: number) {
      try {
        original.call(this, pointerId)
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'NotFoundError' &&
          /No active pointer/.test(error.message)
        ) {
          return
        }
        throw error
      }
    }

    return () => {
      proto.releasePointerCapture = original
    }
  }, [])

  return null
}
