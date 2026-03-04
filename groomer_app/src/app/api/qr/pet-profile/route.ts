import { NextResponse } from 'next/server'

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const customerName = url.searchParams.get('customer_name') ?? '未登録顧客'
  const petName = url.searchParams.get('pet_name') ?? '未登録ペット'
  const payload = url.searchParams.get('payload') ?? ''
  if (!payload) {
    return NextResponse.json({ message: 'payload is required' }, { status: 400 })
  }

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&ecc=M&data=${encodeURIComponent(payload)}`
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="700" viewBox="0 0 600 700">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="300" y="48" text-anchor="middle" font-size="24" font-family="sans-serif" fill="#111827">${escapeXml(customerName)}</text>
  <text x="300" y="82" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#374151">${escapeXml(petName)}</text>
  <image href="${escapeXml(qrApiUrl)}" x="60" y="110" width="480" height="480"/>
</svg>`

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
