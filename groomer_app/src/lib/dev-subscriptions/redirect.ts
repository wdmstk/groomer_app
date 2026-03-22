export function buildDevSubscriptionsRedirectUrl(requestUrl: string, message: string) {
  const url = new URL('/dev/subscriptions', requestUrl)
  url.searchParams.set('message', message)
  return url
}
