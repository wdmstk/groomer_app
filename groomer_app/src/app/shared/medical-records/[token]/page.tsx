import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Card } from '@/components/ui/Card'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createSignedPhotoUrlMap } from '@/lib/medical-records/photos'
import { hashMedicalRecordShareToken } from '@/lib/medical-records/share'

type SharedRecordPageProps = {
  params: Promise<{
    token: string
  }>
}

type SharedPhotoRow = {
  id: string
  photo_type: 'before' | 'after'
  storage_path: string
  comment: string | null
  sort_order: number
  taken_at: string | null
}

function formatDateTimeJst(value: string | null | undefined) {
  if (!value) return '未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未設定'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export default async function SharedMedicalRecordPage({ params }: SharedRecordPageProps) {
  const { token } = await params
  const adminSupabase = createAdminSupabaseClient()
  const tokenHash = hashMedicalRecordShareToken(token)

  const { data: share } = await adminSupabase
    .from('medical_record_share_links')
    .select('id, medical_record_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!share) {
    notFound()
  }

  const { data: photos } = await adminSupabase
    .from('medical_record_photos')
    .select('id, photo_type, storage_path, comment, sort_order, taken_at')
    .eq('medical_record_id', share.medical_record_id)
    .order('photo_type', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const photoList = (photos ?? []) as SharedPhotoRow[]
  const signedUrlMap = await createSignedPhotoUrlMap(
    adminSupabase,
    photoList.map((photo) => photo.storage_path),
    60 * 60
  )
  const beforePhotos = photoList.filter((photo) => photo.photo_type === 'before')
  const afterPhotos = photoList.filter((photo) => photo.photo_type === 'after')

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">写真カルテ</h1>
          <p className="text-sm text-slate-600">共有期限: {formatDateTimeJst(share.expires_at)}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">施術前</h2>
              <p className="text-sm text-slate-500">{beforePhotos.length} 枚</p>
            </div>
            {beforePhotos.length === 0 ? (
              <p className="text-sm text-slate-500">写真はありません。</p>
            ) : (
              <div className="space-y-4">
                {beforePhotos.map((photo) => {
                  const signedUrl = signedUrlMap.get(photo.storage_path)
                  return (
                    <article key={photo.id} className="overflow-hidden rounded border">
                      <div className="relative aspect-[4/3] bg-slate-50">
                        {signedUrl ? (
                          <Image
                            src={signedUrl}
                            alt="施術前写真"
                            fill
                            sizes="(max-width: 1024px) 100vw, 50vw"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="space-y-1 p-3 text-sm text-slate-700">
                        <p>撮影日時: {formatDateTimeJst(photo.taken_at)}</p>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">施術後</h2>
              <p className="text-sm text-slate-500">{afterPhotos.length} 枚</p>
            </div>
            {afterPhotos.length === 0 ? (
              <p className="text-sm text-slate-500">写真はありません。</p>
            ) : (
              <div className="space-y-4">
                {afterPhotos.map((photo) => {
                  const signedUrl = signedUrlMap.get(photo.storage_path)
                  return (
                    <article key={photo.id} className="overflow-hidden rounded border">
                      <div className="relative aspect-[4/3] bg-slate-50">
                        {signedUrl ? (
                          <Image
                            src={signedUrl}
                            alt="施術後写真"
                            fill
                            sizes="(max-width: 1024px) 100vw, 50vw"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="space-y-1 p-3 text-sm text-slate-700">
                        <p>撮影日時: {formatDateTimeJst(photo.taken_at)}</p>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  )
}
