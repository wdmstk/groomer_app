import type { InputHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className = '', ...props }: InputProps) {
  const hasValueProp = Object.prototype.hasOwnProperty.call(props, 'value')
  const normalizedClassName = `w-full border p-2 rounded focus:ring-2 focus:ring-blue-400 outline-none ${className}`

  if (hasValueProp) {
    return <input className={normalizedClassName} {...props} value={props.value ?? ''} />
  }

  return <input className={normalizedClassName} {...props} />
}
