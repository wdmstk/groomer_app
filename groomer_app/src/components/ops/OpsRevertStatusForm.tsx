'use client'
import { useState } from 'react'

type OpsRevertStatusFormProps = {
  appointmentId: string
}

export function OpsRevertStatusForm({ appointmentId }: OpsRevertStatusFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <form
      action={`/api/appointments/${appointmentId}/status/revert`}
      method="post"
      onSubmit={(event) => {
        const ok = window.confirm('完了を会計待ちへ差し戻します。よろしいですか？')
        if (!ok) {
          event.preventDefault()
          return
        }
        setIsSubmitting(true)
      }}
    >
      <input type="hidden" name="redirect_to" value="/ops/today" />
      <input type="hidden" name="reason" value="ops_today_revert" />
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
      >
        {isSubmitting ? '送信中...' : '差し戻し'}
      </button>
    </form>
  )
}
