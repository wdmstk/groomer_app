'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ViewMode = 'staff' | 'admin'

function readViewModeFromCookie(): ViewMode {
  if (typeof document === 'undefined') return 'staff'
  const cookie = document.cookie
    .split('; ')
    .find((row) => row.startsWith('manual_view_mode='))
    ?.split('=')[1]
  return cookie === 'admin' ? 'admin' : 'staff'
}

function writeViewModeCookie(mode: ViewMode) {
  document.cookie = `manual_view_mode=${mode}; path=/; max-age=31536000; samesite=lax`
}

export function ManualViewModeSwitch() {
  const router = useRouter()
  const [mode, setMode] = useState<ViewMode>(() => readViewModeFromCookie())

  function handleModeChange(nextMode: ViewMode) {
    setMode(nextMode)
    writeViewModeCookie(nextMode)
    router.refresh()
  }

  return (
    <div className="rounded border bg-white px-3 py-2">
      <p className="mb-2 text-xs font-semibold text-gray-600">表示モード（全マニュアル共通）</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleModeChange('staff')}
          className={`rounded px-2 py-1 text-xs ${
            mode === 'staff' ? 'bg-blue-100 font-semibold text-blue-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          スタッフ向け簡易版
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('admin')}
          className={`rounded px-2 py-1 text-xs ${
            mode === 'admin' ? 'bg-blue-100 font-semibold text-blue-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          管理者向け詳細版
        </button>
      </div>
    </div>
  )
}
