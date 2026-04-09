import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(process.cwd(), '..')
const appRoot = path.resolve(process.cwd())
const reportPath = path.join(repoRoot, 'docs', 'test-coverage-audit-2026-04-09.md')
const report = fs.readFileSync(reportPath, 'utf8')
const lines = report.split('\n')
const sectionTitle = '## 仕様トレーサビリティ表（初版）'
const sectionStart = lines.findIndex((line) => line.trim() === sectionTitle)

if (sectionStart < 0) {
  console.error(`Traceability section not found: "${sectionTitle}"`)
  process.exit(1)
}

const tableLines = []
for (let i = sectionStart + 1; i < lines.length; i += 1) {
  const line = lines[i]
  if (line.startsWith('|')) {
    tableLines.push(line)
    continue
  }
  if (tableLines.length > 0) break
}

if (tableLines.length < 3) {
  console.error('Traceability table is missing header/separator/data rows.')
  process.exit(1)
}

function parseCells(row) {
  return row
    .trim()
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())
}

const headerCells = parseCells(tableLines[0])
if (
  headerCells.length < 4 ||
  headerCells[0] !== 'Test ID' ||
  headerCells[1] !== '仕様項目' ||
  headerCells[2] !== 'テストファイル'
) {
  console.error(
    'Traceability table header is invalid. Expected: Test ID | 仕様項目 | テストファイル | 検証アサーション（抜粋）'
  )
  process.exit(1)
}

const dataRows = tableLines
  .slice(2)
  .map((row) => ({ row, cells: parseCells(row) }))
  .filter(({ cells }) => cells.some((cell) => cell.length > 0))

if (dataRows.length === 0) {
  console.error('Traceability table has no data rows.')
  process.exit(1)
}

const failures = []
const seenSpecs = new Map()
const seenTestIds = new Map()
const referencedTests = new Set()
const traceIdByFile = new Map()
const requiredCategories = [
  { name: '顧客', pattern: /(顧客|customers)/i },
  { name: '予約', pattern: /(予約|appointments|visits)/i },
  { name: '会計', pattern: /(会計|payments|billing|receipts)/i },
  { name: '通知', pattern: /(通知|notifications|followup|reoffer)/i },
  { name: '設定', pattern: /(設定|settings)/i },
]
const categoryHit = new Map(requiredCategories.map((c) => [c.name, false]))

for (const { row, cells } of dataRows) {
  if (cells.length < 4) {
    failures.push(`Invalid row format: ${row}`)
    continue
  }

  const [testId, specItem, testCell, assertion] = cells
  const rowText = `${testId} ${specItem} ${testCell} ${assertion}`
  requiredCategories.forEach((category) => {
    if (category.pattern.test(rowText)) {
      categoryHit.set(category.name, true)
    }
  })
  if (!/^TRACE-\d{3}$/.test(testId)) {
    failures.push(`Invalid Test ID format: ${testId}`)
  }
  const testIdCount = seenTestIds.get(testId) ?? 0
  seenTestIds.set(testId, testIdCount + 1)
  if (!specItem) {
    failures.push(`Spec item is empty: ${row}`)
  }

  const count = seenSpecs.get(specItem) ?? 0
  seenSpecs.set(specItem, count + 1)

  if (!testCell) {
    failures.push(`Test file column is empty: ${row}`)
  }
  if (!assertion) {
    failures.push(`Assertion column is empty: ${row}`)
  }

  const matches = [...testCell.matchAll(/`([^`]+?\.(?:spec|test)\.ts(?:x)?)`/g)]
  if (matches.length === 0) {
    failures.push(`No test file path found in row: ${row}`)
    continue
  }

  for (const m of matches) {
    const rel = m[1].replace(/^groomer_app\//, '')
    if (!(rel.startsWith('e2e/') || rel.startsWith('tests/'))) {
      failures.push(`Test path must start with e2e/ or tests/: ${rel}`)
      continue
    }
    const abs = path.join(appRoot, rel)
    if (!fs.existsSync(abs)) {
      failures.push(`Missing test file: ${rel}`)
    } else {
      referencedTests.add(rel)
      const ids = traceIdByFile.get(rel) ?? new Set()
      ids.add(testId)
      traceIdByFile.set(rel, ids)
    }
  }
}

for (const [specItem, count] of seenSpecs.entries()) {
  if (count > 1) {
    failures.push(`Duplicate spec item detected (${count}): ${specItem}`)
  }
}
for (const [testId, count] of seenTestIds.entries()) {
  if (count > 1) {
    failures.push(`Duplicate Test ID detected (${count}): ${testId}`)
  }
}

for (const category of requiredCategories) {
  if (!categoryHit.get(category.name)) {
    failures.push(`Required category missing in traceability table: ${category.name}`)
  }
}

for (const rel of referencedTests) {
  const abs = path.join(appRoot, rel)
  const content = fs.readFileSync(abs, 'utf8')
  const hasTestBlock = /\b(test|it)\s*\(/.test(content)
  const hasAssertion = /\b(expect|assert)\b/.test(content)
  if (!hasTestBlock) {
    failures.push(`Referenced test file has no test/it block: ${rel}`)
  }
  if (!hasAssertion) {
    failures.push(`Referenced test file has no expect/assert usage: ${rel}`)
  }
  const idsInFile = traceIdByFile.get(rel) ?? new Set()
  for (const traceId of idsInFile) {
    if (!content.includes(traceId)) {
      failures.push(`Referenced test file does not contain Test ID "${traceId}": ${rel}`)
    }
  }
}

if (failures.length > 0) {
  console.error('Traceability check failed:')
  failures.forEach((item) => console.error(`- ${item}`))
  process.exit(1)
}

console.log(`Traceability check passed: ${dataRows.length} rows verified.`)
