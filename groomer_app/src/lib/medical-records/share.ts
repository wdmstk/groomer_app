import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export const MEDICAL_RECORD_SHARE_DAYS = 7

export function generateMedicalRecordShareToken() {
  return crypto.randomBytes(24).toString('base64url')
}

export function hashMedicalRecordShareToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function getMedicalRecordShareExpiresAt(days = MEDICAL_RECORD_SHARE_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

type CreateMedicalRecordShareLinkParams = {
  supabase: SupabaseClient<Database>
  storeId: string
  recordId: string
  createdByUserId: string | null
}

export async function createMedicalRecordShareLink({
  supabase,
  storeId,
  recordId,
  createdByUserId,
}: CreateMedicalRecordShareLinkParams) {
  const shareToken = generateMedicalRecordShareToken()
  const expiresAt = getMedicalRecordShareExpiresAt()
  const shareLinkInsert: Database['public']['Tables']['medical_record_share_links']['Insert'] = {
    store_id: storeId,
    medical_record_id: recordId,
    token_hash: hashMedicalRecordShareToken(shareToken),
    expires_at: expiresAt,
    created_by_user_id: createdByUserId,
  }

  const { data: shareLink, error } = await supabase
    .from('medical_record_share_links')
    .insert(shareLinkInsert)
    .select('id, medical_record_id, expires_at, created_by_user_id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return {
    shareLink,
    shareToken,
    expiresAt,
  }
}

export function buildMedicalRecordShareUrl(requestUrl: string, shareToken: string) {
  return new URL(`/shared/medical-records/${shareToken}`, requestUrl).toString()
}

export function buildMedicalRecordShareLineMessage(params: {
  customerName: string | null
  petName: string | null
  shareUrl: string
}) {
  const customerName = params.customerName?.trim() || 'お客様'
  const petName = params.petName?.trim() || 'ペット'

  return `${customerName}様\n${petName}ちゃんの写真カルテをご案内します。\nこちらからご確認ください。\n${params.shareUrl}`
}
