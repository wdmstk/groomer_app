export function isDevBillingBypassEnabled() {
  return process.env.NODE_ENV !== 'production'
}

