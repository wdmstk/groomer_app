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

function buildAsciiContentStream(lines: string[]) {
  const commands = ['BT', '/F1 11 Tf', '1 0 0 1 50 760 Tm']
  for (const raw of lines) {
    const line = escapePdfText(raw)
    commands.push(`(${line}) Tj`)
    commands.push('0 -16 Td')
  }
  commands.push('ET')
  return commands.join('\n')
}

function buildCjkContentStream(lines: string[]) {
  const commands = ['BT', '/F1 11 Tf', '1 0 0 1 50 760 Tm']
  for (const raw of lines) {
    commands.push(`<${encodeUtf16Hex(raw)}> Tj`)
    commands.push('0 -16 Td')
  }
  commands.push('ET')
  return commands.join('\n')
}

function buildObjectsForAscii(stream: string) {
  return [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ]
}

function buildObjectsForCjk(stream: string) {
  return [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type0 /BaseFont /HeiseiKakuGo-W5 /Encoding /UniJIS-UCS2-H /DescendantFonts [6 0 R] >> endobj',
    '6 0 obj << /Type /Font /Subtype /CIDFontType0 /BaseFont /HeiseiKakuGo-W5 /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 5 >> >> endobj',
  ]
}

export function buildSimpleConsentPdf(params: { title: string; lines: string[] }) {
  const lines = [params.title, ...params.lines]
  const useCjkFont = lines.some(hasNonAscii)
  const stream = useCjkFont ? buildCjkContentStream(lines) : buildAsciiContentStream(lines)
  const objects = useCjkFont ? buildObjectsForCjk(stream) : buildObjectsForAscii(stream)

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
