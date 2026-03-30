import { deflateSync, inflateSync } from 'node:zlib'

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

function stripInvisibleChars(value: string) {
  return value.replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '')
}

type PdfPage = {
  title: string
  lines: string[]
  mode?: 'default' | 'audit'
  image?: PdfImageObject | null
}

type PositionedLine = {
  text: string
  indent: number
}

type PositionedPage = {
  title: string
  lines: Array<PositionedLine | null>
  mode: 'default' | 'audit'
  imageReservedHeight?: number
  image?: {
    name: string
    width: number
    height: number
  }
}

type PdfImageObject = {
  width: number
  height: number
  compressedRgbHex: string
}

function estimateTextWidth(text: string, fontSize: number, cjk: boolean) {
  const clean = stripInvisibleChars(text)
  let width = 0
  for (const char of clean) {
    if (cjk) {
      width += char === ' ' ? fontSize * 0.5 : fontSize * 1.0
      continue
    }
    if (char === ' ') {
      width += fontSize * 0.32
      continue
    }
    if (/[A-Z]/.test(char)) {
      width += fontSize * 0.62
      continue
    }
    if (/[a-z0-9]/.test(char)) {
      width += fontSize * 0.52
      continue
    }
    if (/[^\x20-\x7E]/.test(char)) {
      width += fontSize * (cjk ? 1.0 : 0.92)
      continue
    }
    width += fontSize * 0.56
  }
  return width
}

function measureCharWidth(
  char: string,
  fontSize: number,
  cjk: boolean,
  cjkCharRatio: number,
  cjkSpaceRatio: number
) {
  if (cjk) {
    return char === ' ' ? fontSize * cjkSpaceRatio : fontSize * cjkCharRatio
  }
  const safety = 1.22
  if (char === ' ') return fontSize * 0.32
  if (/[A-Z]/.test(char)) return fontSize * 0.62 * safety
  if (/[a-z0-9]/.test(char)) return fontSize * 0.52 * safety
  if (/[^\x20-\x7E]/.test(char)) return fontSize * (cjk ? 1.02 : 0.94) * safety
  return fontSize * 0.58 * safety
}

function wrapLineByWidth(
  text: string,
  maxWidth: number,
  fontSize: number,
  cjk: boolean,
  cjkCharRatio: number,
  cjkSpaceRatio: number
) {
  if (!text) return ['']
  const cleanText = stripInvisibleChars(text)
  const chunks: string[] = []
  let current = ''
  let currentWidth = 0

  for (const char of cleanText) {
    const charWidth = measureCharWidth(char, fontSize, cjk, cjkCharRatio, cjkSpaceRatio)
    if (current && currentWidth + charWidth > maxWidth) {
      chunks.push(current)
      current = char
      currentWidth = charWidth
      continue
    }
    current += char
    currentWidth += charWidth
  }
  if (current) chunks.push(current)
  return chunks.length > 0 ? chunks : ['']
}

function getIndentLevel(raw: string) {
  if (raw.startsWith('    ')) return 2
  if (raw.startsWith('  ')) return 1
  return 0
}

function normalizeLine(raw: string) {
  if (!raw) return ''
  const trimmed = raw.trimEnd()
  return trimmed.startsWith('  ') ? trimmed.trimStart() : trimmed
}

function getLayout(mode: 'default' | 'audit', cjk: boolean) {
  const defaultLayout = {
    pageWidth: 595,
    leftMargin: 44,
    rightMargin: 44,
    topY: 800,
    bottomY: 42,
    titleFontSize: 16,
    titleGap: 24,
    bodyFontSize: cjk ? 8.2 : 8.8,
    lineHeight: cjk ? 10.0 : 9.8,
    paragraphGap: 4.5,
    indentStep: 14,
    cjkCharRatio: 1.05,
    cjkSpaceRatio: 0.58,
  }
  if (mode !== 'audit') return defaultLayout
  return {
    ...defaultLayout,
    leftMargin: 44,
    rightMargin: 44,
    bodyFontSize: cjk ? 8.2 : 8.8,
    lineHeight: cjk ? 10.0 : 9.8,
    paragraphGap: 4.5,
    indentStep: 12,
    cjkCharRatio: 1.05,
    cjkSpaceRatio: 0.54,
  }
}

function buildPositionedPages(page: PdfPage, cjk: boolean) {
  const mode = page.mode ?? 'default'
  const layout = getLayout(mode, cjk)
  const pageWidth = layout.pageWidth
  const leftMargin = layout.leftMargin
  const rightMargin = layout.rightMargin
  const contentWidth = pageWidth - leftMargin - rightMargin
  const topY = layout.topY
  const bottomY = layout.bottomY
  const titleFontSize = layout.titleFontSize
  const titleGap = layout.titleGap
  const bodyFontSize = layout.bodyFontSize
  const lineHeight = layout.lineHeight
  const paragraphGap = layout.paragraphGap
  const indentStep = layout.indentStep
  const imageReserve = page.image ? 240 : 0
  const maxBodyHeight = topY - titleGap - bottomY - imageReserve
  const continuationTitle = cjk ? `${page.title}（続き）` : `${page.title} (cont.)`
  const positionedPages: PositionedPage[] = [{ title: page.title, mode, lines: [], imageReservedHeight: imageReserve }]
  let remainingHeight = maxBodyHeight

  function getCurrentPage() {
    return positionedPages[positionedPages.length - 1]
  }

  function pushNewPage() {
    positionedPages.push({ title: continuationTitle, mode, lines: [] })
    remainingHeight = topY - titleGap - bottomY
  }

  for (const raw of page.lines) {
    if (!raw.trim()) {
      if (paragraphGap > remainingHeight && getCurrentPage().lines.length > 0) {
        pushNewPage()
      }
      getCurrentPage().lines.push(null)
      remainingHeight -= paragraphGap
      continue
    }

    const indentLevel = getIndentLevel(raw)
    const indent = indentLevel * indentStep
    const maxWidth = Math.max(60, contentWidth - indent)
    const normalized = normalizeLine(raw)
    const wrapped = wrapLineByWidth(
      normalized,
      maxWidth,
      bodyFontSize,
      cjk,
      layout.cjkCharRatio,
      layout.cjkSpaceRatio
    )

    for (const line of wrapped) {
      if (lineHeight > remainingHeight && getCurrentPage().lines.length > 0) {
        pushNewPage()
      }
      getCurrentPage().lines.push({ text: line, indent })
      remainingHeight -= lineHeight
    }
  }

  return {
    positionedPages,
    leftMargin,
    titleFontSize,
    titleGap,
    bodyFontSize,
    lineHeight,
    paragraphGap,
    pageWidth,
  }
}

function buildContentStream(page: PositionedPage, cjk: boolean) {
  const layout = getLayout(page.mode, cjk)
  const leftMargin = layout.leftMargin
  const titleFontSize = layout.titleFontSize
  const titleGap = layout.titleGap
  const bodyFontSize = layout.bodyFontSize
  const lineHeight = layout.lineHeight
  const paragraphGap = layout.paragraphGap
  const pageWidth = layout.pageWidth
  let y = 800
  const commands = ['BT']

  const titleX = Math.max(leftMargin, (pageWidth - estimateTextWidth(page.title, titleFontSize, cjk)) / 2)
  commands.push(`/F1 ${titleFontSize} Tf`)
  commands.push(`1 0 0 1 ${titleX.toFixed(2)} ${y} Tm`)
  commands.push(cjk ? `<${encodeUtf16Hex(page.title)}> Tj` : `(${escapePdfText(page.title)}) Tj`)
  y -= titleGap

  commands.push(`/F1 ${bodyFontSize} Tf`)
  for (const line of page.lines) {
    if (!line) {
      y -= paragraphGap
      continue
    }
    const x = leftMargin + line.indent
    commands.push(`1 0 0 1 ${x.toFixed(2)} ${y} Tm`)
    if (cjk) {
      commands.push(`<${encodeUtf16Hex(line.text)}> Tj`)
    } else {
      commands.push(`(${escapePdfText(line.text)}) Tj`)
    }
    y -= lineHeight
  }
  commands.push('ET')
  if (page.image) {
    const maxWidth = 440
    const maxHeight = 190
    const scale = Math.min(maxWidth / page.image.width, maxHeight / page.image.height, 1)
    const drawWidth = page.image.width * scale
    const drawHeight = page.image.height * scale
    const drawX = (pageWidth - drawWidth) / 2
    const drawY = Math.max(52, y - drawHeight - 14)
    const framePadding = 8
    commands.push('q')
    commands.push('1 w')
    commands.push(
      `${(drawX - framePadding).toFixed(2)} ${(drawY - framePadding).toFixed(2)} ${(drawWidth + framePadding * 2).toFixed(2)} ${(drawHeight + framePadding * 2).toFixed(2)} re S`
    )
    commands.push(`${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm`)
    commands.push(`/${page.image.name} Do`)
    commands.push('Q')
  }
  return commands.join('\n')
}

function buildObjectsForAscii(params: {
  streams: string[]
  pageImages: Array<PdfImageObject | null>
}) {
  const pageCount = params.streams.length
  const firstPageObjectId = 3
  const firstContentObjectId = firstPageObjectId + pageCount
  const fontObjectId = firstContentObjectId + pageCount
  const firstImageObjectId = fontObjectId + 1
  const kids = Array.from({ length: pageCount }, (_, index) => `${firstPageObjectId + index} 0 R`).join(' ')

  const objects: string[] = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    `2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pageCount} >> endobj`,
  ]

  const imageObjectIdByPage = new Array<number | null>(pageCount).fill(null)
  let nextImageObjectId = firstImageObjectId
  for (let index = 0; index < pageCount; index += 1) {
    if (!params.pageImages[index]) continue
    imageObjectIdByPage[index] = nextImageObjectId
    nextImageObjectId += 1
  }

  params.streams.forEach((_, index) => {
    const pageId = firstPageObjectId + index
    const contentId = firstContentObjectId + index
    const imageObjectId = imageObjectIdByPage[index]
    const imageResource = imageObjectId ? ` /XObject << /Im1 ${imageObjectId} 0 R >>` : ''
    objects.push(
      `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontObjectId} 0 R >>${imageResource} >> >> endobj`
    )
  })
  params.streams.forEach((stream, index) => {
    const contentId = firstContentObjectId + index
    objects.push(`${contentId} 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj`)
  })
  objects.push(`${fontObjectId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`)
  params.pageImages.forEach((image, pageIndex) => {
    if (!image) return
    const imageObjectId = imageObjectIdByPage[pageIndex]
    if (!imageObjectId) return
    const hexPayload = `${image.compressedRgbHex}>`
    objects.push(
      `${imageObjectId} 0 obj << /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /FlateDecode] /Length ${hexPayload.length} >> stream\n${hexPayload}\nendstream endobj`
    )
  })
  return objects
}

function buildObjectsForCjk(params: {
  streams: string[]
  pageImages: Array<PdfImageObject | null>
}) {
  const pageCount = params.streams.length
  const firstPageObjectId = 3
  const firstContentObjectId = firstPageObjectId + pageCount
  const fontObjectId = firstContentObjectId + pageCount
  const descendantFontObjectId = fontObjectId + 1
  const firstImageObjectId = descendantFontObjectId + 1
  const kids = Array.from({ length: pageCount }, (_, index) => `${firstPageObjectId + index} 0 R`).join(' ')

  const objects: string[] = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    `2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pageCount} >> endobj`,
  ]

  const imageObjectIdByPage = new Array<number | null>(pageCount).fill(null)
  let nextImageObjectId = firstImageObjectId
  for (let index = 0; index < pageCount; index += 1) {
    if (!params.pageImages[index]) continue
    imageObjectIdByPage[index] = nextImageObjectId
    nextImageObjectId += 1
  }

  params.streams.forEach((_, index) => {
    const pageId = firstPageObjectId + index
    const contentId = firstContentObjectId + index
    const imageObjectId = imageObjectIdByPage[index]
    const imageResource = imageObjectId ? ` /XObject << /Im1 ${imageObjectId} 0 R >>` : ''
    objects.push(
      `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontObjectId} 0 R >>${imageResource} >> >> endobj`
    )
  })
  params.streams.forEach((stream, index) => {
    const contentId = firstContentObjectId + index
    objects.push(`${contentId} 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj`)
  })
  objects.push(
    `${fontObjectId} 0 obj << /Type /Font /Subtype /Type0 /BaseFont /HeiseiKakuGo-W5 /Encoding /UniJIS-UCS2-H /DescendantFonts [${descendantFontObjectId} 0 R] >> endobj`
  )
  objects.push(
    `${descendantFontObjectId} 0 obj << /Type /Font /Subtype /CIDFontType0 /BaseFont /HeiseiKakuGo-W5 /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 5 >> >> endobj`
  )
  params.pageImages.forEach((image, pageIndex) => {
    if (!image) return
    const imageObjectId = imageObjectIdByPage[pageIndex]
    if (!imageObjectId) return
    const hexPayload = `${image.compressedRgbHex}>`
    objects.push(
      `${imageObjectId} 0 obj << /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /FlateDecode] /Length ${hexPayload.length} >> stream\n${hexPayload}\nendstream endobj`
    )
  })
  return objects
}

function parsePngSignatureImage(buffer: Buffer): PdfImageObject {
  const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('invalid png signature')
  }

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idatChunks: Buffer[] = []
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const chunkDataStart = offset + 8
    const chunkDataEnd = chunkDataStart + length
    if (chunkDataEnd + 4 > buffer.length) break
    const chunk = buffer.subarray(chunkDataStart, chunkDataEnd)
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0)
      height = chunk.readUInt32BE(4)
      bitDepth = chunk[8]
      colorType = chunk[9]
    } else if (type === 'IDAT') {
      idatChunks.push(chunk)
    } else if (type === 'IEND') {
      break
    }
    offset = chunkDataEnd + 4
  }

  if (!width || !height || bitDepth !== 8 || ![0, 2, 4, 6].includes(colorType)) {
    throw new Error('unsupported png format')
  }

  const compressed = Buffer.concat(idatChunks)
  const inflated = inflateSync(compressed)
  const channels = colorType === 6 ? 4 : colorType === 4 ? 2 : colorType === 2 ? 3 : 1
  const bytesPerPixel = channels
  const stride = width * bytesPerPixel
  const scanlineSize = stride + 1
  if (inflated.length < scanlineSize * height) {
    throw new Error('corrupted png data')
  }

  const raw = Buffer.alloc(width * height * 3)
  const prev = Buffer.alloc(stride)
  const current = Buffer.alloc(stride)

  function paeth(a: number, b: number, c: number) {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    if (pa <= pb && pa <= pc) return a
    if (pb <= pc) return b
    return c
  }

  for (let row = 0; row < height; row += 1) {
    const rowOffset = row * scanlineSize
    const filterType = inflated[rowOffset]
    inflated.copy(current, 0, rowOffset + 1, rowOffset + 1 + stride)
    for (let i = 0; i < stride; i += 1) {
      const left = i >= bytesPerPixel ? current[i - bytesPerPixel] : 0
      const up = prev[i]
      const upLeft = i >= bytesPerPixel ? prev[i - bytesPerPixel] : 0
      switch (filterType) {
        case 0:
          break
        case 1:
          current[i] = (current[i] + left) & 0xff
          break
        case 2:
          current[i] = (current[i] + up) & 0xff
          break
        case 3:
          current[i] = (current[i] + Math.floor((left + up) / 2)) & 0xff
          break
        case 4:
          current[i] = (current[i] + paeth(left, up, upLeft)) & 0xff
          break
        default:
          throw new Error('unsupported png filter')
      }
    }

    for (let x = 0; x < width; x += 1) {
      const inBase = x * channels
      const outBase = (row * width + x) * 3
      if (channels === 4) {
        const r = current[inBase]
        const g = current[inBase + 1]
        const b = current[inBase + 2]
        const a = current[inBase + 3]
        raw[outBase] = Math.round((r * a + 255 * (255 - a)) / 255)
        raw[outBase + 1] = Math.round((g * a + 255 * (255 - a)) / 255)
        raw[outBase + 2] = Math.round((b * a + 255 * (255 - a)) / 255)
      } else if (channels === 3) {
        raw[outBase] = current[inBase]
        raw[outBase + 1] = current[inBase + 1]
        raw[outBase + 2] = current[inBase + 2]
      } else if (channels === 2) {
        const gray = current[inBase]
        const a = current[inBase + 1]
        const composited = Math.round((gray * a + 255 * (255 - a)) / 255)
        raw[outBase] = composited
        raw[outBase + 1] = composited
        raw[outBase + 2] = composited
      } else {
        const gray = current[inBase]
        raw[outBase] = gray
        raw[outBase + 1] = gray
        raw[outBase + 2] = gray
      }
    }
    current.copy(prev, 0, 0, stride)
  }

  const compressedRgb = deflateSync(raw)
  return {
    width,
    height,
    compressedRgbHex: compressedRgb.toString('hex'),
  }
}

export function buildSimpleConsentPdf(params: {
  title: string
  lines: string[]
  secondPageTitle?: string
  secondPageLines?: string[]
  secondPageSignatureImagePng?: Buffer
  thirdPageTitle?: string
  thirdPageLines?: string[]
}) {
  const logicalPages: PdfPage[] = [
    { title: params.title, lines: params.lines, mode: 'default' },
    ...(params.secondPageTitle && params.secondPageLines
      ? [{ title: params.secondPageTitle, lines: params.secondPageLines, mode: 'default' as const }]
      : []),
    ...(params.thirdPageTitle && params.thirdPageLines
      ? [{ title: params.thirdPageTitle, lines: params.thirdPageLines, mode: 'audit' as const }]
      : []),
  ]
  const useCjkFont = logicalPages.some((page) => [page.title, ...page.lines].some(hasNonAscii))
  const pageGroups = logicalPages.map((page) => buildPositionedPages(page, useCjkFont).positionedPages)
  const pages = pageGroups.flat()
  const pageImages: Array<PdfImageObject | null> = pages.map(() => null)
  if (params.secondPageSignatureImagePng && params.secondPageTitle && params.secondPageLines) {
    try {
      const image = parsePngSignatureImage(params.secondPageSignatureImagePng)
      const secondGroup = pageGroups[1]
      if (secondGroup && secondGroup.length > 0) {
        secondGroup[secondGroup.length - 1] = {
          ...secondGroup[secondGroup.length - 1],
          image: { name: 'Im1', width: image.width, height: image.height },
        }
      }
      const updatedPages = pageGroups.flat()
      for (let i = 0; i < updatedPages.length; i += 1) {
        pages[i] = updatedPages[i]
      }
      for (let i = 0; i < pageImages.length; i += 1) {
        pageImages[i] = null
      }
      const imagePageIndex = pages.findIndex((page) => page.image?.name === 'Im1')
      if (imagePageIndex >= 0) pageImages[imagePageIndex] = image
    } catch {
      // keep PDF generation resilient even if image parse fails
    }
  }
  const streams = pages.map((page) => buildContentStream(page, useCjkFont))
  const objects = useCjkFont
    ? buildObjectsForCjk({ streams, pageImages })
    : buildObjectsForAscii({ streams, pageImages })

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
