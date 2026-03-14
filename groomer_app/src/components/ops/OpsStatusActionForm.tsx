'use client'
import { useState } from 'react'

type OpsStatusActionFormProps = {
  appointmentId: string
  nextStatus: string
  label: string
}

export function OpsStatusActionForm({
  appointmentId,
  nextStatus,
  label,
}: OpsStatusActionFormProps) {
  const needsConfirm = nextStatus === '完了'
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <form
      action={`/api/appointments/${appointmentId}/status`}
      method="post"
      onSubmit={(event) => {
        if (needsConfirm) {
          const ok = window.confirm('この予約を完了にします。よろしいですか？')
          if (!ok) {
            event.preventDefault()
            return
          }
        }
        setIsSubmitting(true)
      }}
    >
      <input type="hidden" name="next_status" value={nextStatus} />
      <input type="hidden" name="redirect_to" value="/ops/today" />
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        {isSubmitting ? '送信中...' : label}
      </button>
    </form>
  )
}
