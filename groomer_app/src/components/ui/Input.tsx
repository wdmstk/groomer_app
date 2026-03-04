export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full border p-2 rounded focus:ring-2 focus:ring-blue-400 outline-none ${className}`}
      {...props}
    />
  )
}