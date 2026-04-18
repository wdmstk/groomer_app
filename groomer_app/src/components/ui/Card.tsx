import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`rounded bg-white p-6 shadow dark:border dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      {children}
    </div>
  )
}
