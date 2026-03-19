import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BACKUP_DIR = process.env.BACKUP_DIR
const BUCKET = process.env.SUPABASE_UPLOAD_BUCKET ?? 'pet-photos'

function requireEnv(value, name) {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is not set.`)
  }
  return value
}

function buildOutputDir(rootDir) {
  const date = new Date().toISOString().slice(0, 10)
  const runStamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '')
  return path.join(rootDir, `storage_${date}_${runStamp}`)
}

function toSafeRelativePath(storagePath) {
  const normalized = storagePath.replaceAll('\\', '/').replace(/^\/+/, '')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.some((part) => part === '..')) {
    throw new Error(`Unsafe storage path detected: ${storagePath}`)
  }
  return parts.join('/')
}

async function listObjectNames(client, bucket) {
  const pageSize = 1000
  const names = []

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .schema('storage')
      .from('objects')
      .select('name')
      .eq('bucket_id', bucket)
      .order('name', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw new Error(`Failed to list storage objects: ${error.message}`)
    }

    const rows = data ?? []
    for (const row of rows) {
      if (typeof row.name === 'string' && row.name.length > 0) {
        names.push(row.name)
      }
    }
    if (rows.length < pageSize) {
      break
    }
  }
  return names
}

async function downloadObject(client, bucket, storagePath, outputDir) {
  const safePath = toSafeRelativePath(storagePath)
  const { data, error } = await client.storage.from(bucket).createSignedUrl(storagePath, 60 * 10)
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to sign URL (${storagePath}): ${error?.message ?? 'unknown error'}`)
  }

  const response = await fetch(data.signedUrl)
  if (!response.ok) {
    throw new Error(`Failed to download (${storagePath}): HTTP ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const outputPath = path.join(outputDir, safePath)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, buffer)
}

async function main() {
  const url = requireEnv(SUPABASE_URL, 'SUPABASE_URL')
  const roleKey = requireEnv(SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY')
  const backupRoot = requireEnv(BACKUP_DIR, 'BACKUP_DIR')

  const outputDir = buildOutputDir(backupRoot)
  await fs.mkdir(outputDir, { recursive: true })

  const client = createClient(url, roleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const objectNames = await listObjectNames(client, BUCKET)
  let successCount = 0
  const failures = []

  for (const objectName of objectNames) {
    try {
      await downloadObject(client, BUCKET, objectName, outputDir)
      successCount += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push({ objectName, error: message })
      console.error(message)
    }
  }

  const manifest = {
    executedAt: new Date().toISOString(),
    bucket: BUCKET,
    totalObjects: objectNames.length,
    successCount,
    failureCount: failures.length,
    failures,
  }

  await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`Storage backup completed: ${outputDir}`)
  console.log(`objects=${objectNames.length} success=${successCount} failure=${failures.length}`)

  if (failures.length > 0) {
    process.exitCode = 2
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
