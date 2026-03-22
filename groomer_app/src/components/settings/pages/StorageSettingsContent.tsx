import { Card } from '@/components/ui/Card'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'
import { settingsPageFixtures } from '@/lib/e2e/settings-page-fixtures'
import {
  fetchStoreStorageQuotaState,
  formatBytesToJa,
} from '@/lib/storage-quota'
import { getMedicalRecordPhotoBucket } from '@/lib/medical-records/photos'
import { getMedicalRecordVideoBucket } from '@/lib/medical-records/videos'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type PageProps = {
  searchParams?: Promise<{
    saved?: string
    error?: string
  }>
}

export default async function StorageSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const guard = isPlaywrightE2E
    ? settingsPageFixtures.storageGuard
    : await requireOwnerStoreMembership()
  if (!guard.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">容量設定</h1>
        <Card>
          <p className="text-sm text-red-700">{guard.message}</p>
        </Card>
      </section>
    )
  }

  const photoBucket = getMedicalRecordPhotoBucket()
  const videoBucket = getMedicalRecordVideoBucket()
  const buckets = Array.from(new Set([photoBucket, videoBucket]))
  const quota = isPlaywrightE2E
    ? settingsPageFixtures.storageQuota
    : await fetchStoreStorageQuotaState({
        storeId: guard.storeId,
        buckets,
        allowUsageFetchFailure: true,
      })
  const usagePercent = quota.totalLimitBytes > 0 ? Math.min(100, (quota.usageBytes / quota.totalLimitBytes) * 100) : 0
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">容量設定</h1>
        <p className="text-sm text-gray-600">
          店舗ごとの使用容量を確認し、超過時の動作を設定します。
        </p>
      </div>

      {params?.saved === '1' ? (
        <Card className="border border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-700">容量設定を保存しました。</p>
        </Card>
      ) : null}
      {params?.error ? (
        <Card className="border border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{params.error}</p>
        </Card>
      ) : null}
      {quota.usageWarning ? (
        <Card className="border border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">{quota.usageWarning}</p>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">現在の使用状況</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
          <p>対象バケット: {buckets.join(', ')}</p>
          <p>プラン: {quota.planCode}</p>
          <p>使用量: {formatBytesToJa(quota.usageBytes)}</p>
          <p>上限: {formatBytesToJa(quota.totalLimitBytes)}</p>
          <p>基本上限: {formatBytesToJa(quota.baseLimitBytes)}</p>
          <p>追加容量: {formatBytesToJa(quota.extraCapacityBytes)}</p>
        </div>
        <div className="mt-4">
          <div className="h-3 w-full overflow-hidden rounded bg-gray-100">
            <div
              className={`h-full ${usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-600">{usagePercent.toFixed(1)}%</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">超過時の動作</h2>
        <p className="mt-2 text-xs text-gray-600">
          追加容量は「追加課金済み容量」として扱います（課金処理そのものは billing 画面での運用に連動）。
        </p>
        <form action="/api/settings/storage-policy" method="post" className="mt-4 space-y-4">
          <label className="block text-sm text-gray-700">
            方針
            <select
              name="policy"
              defaultValue={quota.policy}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 md:max-w-sm"
            >
              <option value="block">追加登録を停止する</option>
              <option value="cleanup_orphans">孤立した古いファイルを先に整理する</option>
            </select>
          </label>

          <label className="block text-sm text-gray-700">
            追加容量（GB）
            <input
              type="number"
              min={0}
              step={1}
              name="extra_capacity_gb"
              defaultValue={Math.floor(quota.extraCapacityBytes / (1024 * 1024 * 1024))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 md:max-w-sm"
            />
          </label>

          <label className="block text-sm text-gray-700">
            カスタム上限（MB, 任意）
            <input
              type="number"
              min={0}
              step={1}
              name="custom_limit_mb"
              defaultValue={quota.customLimitBytes !== null ? Math.floor(quota.customLimitBytes / (1024 * 1024)) : ''}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 md:max-w-sm"
            />
          </label>

          <input type="hidden" name="redirect_to" value="/settings/storage" />
          <button
            type="submit"
            className="inline-flex items-center rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            容量設定を保存
          </button>
        </form>
      </Card>
    </section>
  )
}
