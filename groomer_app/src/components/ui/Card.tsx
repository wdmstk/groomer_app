import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`p-6 bg-white shadow rounded ${className}`}>
      {children}
    </div>
  )
}