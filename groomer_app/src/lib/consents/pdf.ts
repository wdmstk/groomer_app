function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function encodeUtf16Hex(value: string) {
  const bytes: number[] = [0xfe, 0xff]
  for (const ch of value) {
    const code = ch.codePointAt(0)
    if (!code) continue
    if (code <= 0xffff) {
      bytes.push((code >> 8) & 0xff, code & 0xff)
      continue
    }
    const adjusted = code - 0x10000
    const high = 0xd800 + ((adjusted >> 10) & 0x3ff)
    const low = 0xdc00 + (adjusted & 0x3ff)
    bytes.push((high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff)
  }
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hasNonAscii(value: string) {
  return /[^\x20-\x7E]/.test(value)
}

type PdfPage = {
  title: string
  lines: string[]
}

function estimateTextWidth(text: string, fontSize: number) {
  return text.length * fontSize * 0.55
}

function buildAsciiContentStream(page: PdfPage) {
  let y = 790
  const commands = ['BT']

  const titleX = Math.max(48, (595 - estimateTextWidth(page.title, 18)) / 2)
  commands.push('/F1 18 Tf')
  commands.push(`1 0 0 1 ${titleX.toFixed(2)} ${y} Tm`)
  commands.push(`(${escapePdfText(page.title)}) Tj`)
  y -= 34

  commands.push('/F1 11 Tf')
  for (const raw of page.lines) {
    if (!raw.trim()) {
      y -= 10
      continue
    }
    const indent = raw.startsWith('  ') ? 18 : raw.startsWith('【') ? 0 : 8
    const line = escapePdfText(raw)
    commands.push(`1 0 0 1 ${(52 + indent).toFixed(2)} ${y} Tm`)
    commands.push(`(${line}) Tj`)
    y -= 16
  }
  commands.push('ET')
  return commands.join('\n')
}

function buildCjkContentStream(page: PdfPage) {
  let y = 790
  const commands = ['BT']

  const titleX = Math.max(48, (595 - estimateTextWidth(page.title, 18)) / 2)
  commands.push('/F1 18 Tf')
  commands.push(`1 0 0 1 ${titleX.toFixed(2)} ${y} Tm`)
  commands.push(`<${encodeUtf16Hex(page.title)}> Tj`)
  y -= 34

  commands.push('/F1 11 Tf')
  for (const raw of page.lines) {
    if (!raw.trim()) {
      y -= 10
      continue
    }
    const indent = raw.startsWith('  ') ? 18 : raw.startsWith('【') ? 0 : 8
    commands.push(`1 0 0 1 ${(52 + indent).toFixed(2)} ${y} Tm`)
    commands.push(`<${encodeUtf16Hex(raw)}> Tj`)
    y -= 16
  }
  commands.push('ET')
  return commands.join('\n')
}

function buildObjectsForAscii(streams: string[]) {
  const pageCount = streams.length
  const firstPageObjectId = 3
  const firstContentObjectId = firstPageObjectId + pageCount
  const fontObjectId = firstContentObjectId + pageCount
  const kids = Array.from({ length: pageCount }, (_, index) => `${firstPageObjectId + index} 0 R`).join(' ')

  const objects: string[] = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    `2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pageCount} >> endobj`,
  ]

  streams.forEach((_, index) => {
    const pageId = firstPageObjectId + index
    const contentId = firstContentObjectId + index
    objects.push(
      `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> >> endobj`
    )
  })
  streams.forEach((stream, index) => {
    const contentId = firstContentObjectId + index
    objects.push(`${contentId} 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj`)
  })
  objects.push(`${fontObjectId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`)
  return objects
}

function buildObjectsForCjk(streams: string[]) {
  const pageCount = streams.length
  const firstPageObjectId = 3
  const firstContentObjectId = firstPageObjectId + pageCount
  const fontObjectId = firstContentObjectId + pageCount
  const descendantFontObjectId = fontObjectId + 1
  const kids = Array.from({ length: pageCount }, (_, index) => `${firstPageObjectId + index} 0 R`).join(' ')

  const objects: string[] = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    `2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pageCount} >> endobj`,
  ]

  streams.forEach((_, index) => {
    const pageId = firstPageObjectId + index
    const contentId = firstContentObjectId + index
    objects.push(
      `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> >> endobj`
    )
  })
  streams.forEach((stream, index) => {
    const contentId = firstContentObjectId + index
    objects.push(`${contentId} 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj`)
  })
  objects.push(
    `${fontObjectId} 0 obj << /Type /Font /Subtype /Type0 /BaseFont /HeiseiKakuGo-W5 /Encoding /UniJIS-UCS2-H /DescendantFonts [${descendantFontObjectId} 0 R] >> endobj`
  )
  objects.push(
    `${descendantFontObjectId} 0 obj << /Type /Font /Subtype /CIDFontType0 /BaseFont /HeiseiKakuGo-W5 /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 5 >> >> endobj`
  )
  return objects
}

export function buildSimpleConsentPdf(params: {
  title: string
  lines: string[]
  secondPageTitle?: string
  secondPageLines?: string[]
}) {
  const pages: PdfPage[] = [
    { title: params.title, lines: params.lines },
    ...(params.secondPageTitle && params.secondPageLines
      ? [{ title: params.secondPageTitle, lines: params.secondPageLines }]
      : []),
  ]
  const useCjkFont = pages.some((page) => [page.title, ...page.lines].some(hasNonAscii))
  const streams = useCjkFont ? pages.map(buildCjkContentStream) : pages.map(buildAsciiContentStream)
  const objects = useCjkFont ? buildObjectsForCjk(streams) : buildObjectsForAscii(streams)

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += `${obj}\n`
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\n`
  pdf += `startxref\n${xrefOffset}\n%%EOF`

  return Buffer.from(pdf, 'utf8')
}
