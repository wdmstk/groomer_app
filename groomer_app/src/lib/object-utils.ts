import type { Json } from '@/lib/supabase/database.types'

export type UnknownObject = { [key: string]: unknown }
export type JsonObject = { [key: string]: Json | undefined }

export function isObjectRecord(value: unknown): value is UnknownObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asObjectOrNull(value: unknown): UnknownObject | null {
  if (!isObjectRecord(value)) return null
  return value
}

export function asObject(value: unknown): UnknownObject {
  return asObjectOrNull(value) ?? {}
}

export function asJsonObjectOrNull(value: unknown): JsonObject | null {
  if (!isObjectRecord(value)) return null
  return value as JsonObject
}

export function asJsonObject(value: unknown): JsonObject {
  return asJsonObjectOrNull(value) ?? {}
}
