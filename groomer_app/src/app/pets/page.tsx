import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { PetCreateModal } from '@/components/pets/PetCreateModal'
import { petsPageFixtures } from '@/lib/e2e/pets-page-fixtures'
import {
  formatPetFallback,
  formatPetList,
  formatPetWeight,
  getPetRelatedValue,
  resolvePetQrDisplayUrl,
} from '@/lib/pets/presentation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type CustomerOption = {
  id: string
  full_name: string
}

type PetRow = {
  id: string
  name: string
  customer_id: string
  breed: string | null
  gender: string | null
  date_of_birth: string | null
  weight: number | null
  vaccine_date: string | null
  chronic_diseases: string[] | null
  notes: string | null
  qr_code_url: string | null
  qr_payload: string | null
  customers?: { full_name: string } | { full_name: string }[] | null
}

type PetsPageProps = {
  searchParams?: Promise<{
    tab?: string
    modal?: string
    edit?: string
  }>
}

const genderOptions = ['オス', 'メス', '不明']
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

export default async function PetsPage({ searchParams }: PetsPageProps) {
  const resolvedSearchParams = await searchParams
  const activeTab = 'list'
  const isCreateModalOpen =
    resolvedSearchParams?.modal === 'create' || resolvedSearchParams?.tab === 'new'
  const editId = resolvedSearchParams?.edit
  const modalCloseRedirect = `/pets?tab=${activeTab}`
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: petsPageFixtures.storeId }
    : await createStoreScopedClient()

  const petsSelectWithQr =
    'id, name, customer_id, breed, gender, date_of_birth, weight, vaccine_date, chronic_diseases, notes, qr_code_url, qr_payload, customers(full_name)'
  const petsSelectBase =
    'id, name, customer_id, breed, gender, date_of_birth, weight, vaccine_date, chronic_diseases, notes, customers(full_name)'
  const petsData = isPlaywrightE2E
    ? petsPageFixtures.pets
    : (() => {
        return supabase
          .from('pets')
          .select(petsSelectWithQr)
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      })()

  const resolvedPetsData = isPlaywrightE2E
    ? petsData
    : await petsData.then((petsQuery) =>
        petsQuery.error && petsQuery.error.message.includes('qr_code_url')
          ? supabase
              .from('pets')
              .select(petsSelectBase)
              .eq('store_id', storeId)
              .order('created_at', { ascending: false })
              .then((response) =>
                response.data?.map((row) => ({
                  ...row,
                  qr_code_url: null,
                  qr_payload: null,
                })) ?? []
              )
          : petsQuery.data ?? []
      )

  const customers = isPlaywrightE2E
    ? petsPageFixtures.customers
    : (
        await supabase
          .from('customers')
          .select('id, full_name')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      ).data

  let editPetData: PetRow | null = null
  if (editId && !isPlaywrightE2E) {
    const editWithQr = await supabase
      .from('pets')
      .select(
        'id, name, customer_id, breed, gender, date_of_birth, weight, vaccine_date, chronic_diseases, notes, qr_code_url, qr_payload'
      )
      .eq('id', editId)
      .eq('store_id', storeId)
      .single()

    if (editWithQr.error && editWithQr.error.message.includes('qr_code_url')) {
      const editBase = await supabase
        .from('pets')
        .select(
          'id, name, customer_id, breed, gender, date_of_birth, weight, vaccine_date, chronic_diseases, notes'
        )
        .eq('id', editId)
        .eq('store_id', storeId)
        .single()
      editPetData = editBase.data
        ? {
            ...editBase.data,
            qr_code_url: null,
            qr_payload: null,
          }
        : null
    } else {
      editPetData = (editWithQr.data as PetRow | null) ?? null
    }
  }
  if (editId && isPlaywrightE2E) {
    editPetData = (petsPageFixtures.pets.find((pet) => pet.id === editId) as PetRow | undefined) ?? null
  }

  const petList = (resolvedPetsData ?? []) as PetRow[]
  const customerOptions: CustomerOption[] = customers ?? []

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">ペット管理</h1>
      </div>

      <div className="flex items-center gap-4 border-b">
        <Link
          href="/pets?tab=list"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          ペット一覧
        </Link>
      </div>

      {activeTab === 'list' ? (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">ペット一覧</h2>
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500">全 {petList.length} 件</p>
              <Link
                href="/pets?tab=list&modal=create"
                className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                新規登録
              </Link>
            </div>
          </div>
          {petList.length === 0 ? (
            <p className="text-sm text-gray-500">ペットがまだ登録されていません。</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden" data-testid="pets-list-mobile">
                {petList.map((pet) => (
                  <article
                    key={pet.id}
                    className="rounded border p-3 text-sm text-gray-700"
                    data-testid={`pet-row-${pet.id}`}
                  >
                    {(() => {
                      const qrDisplayUrl = resolvePetQrDisplayUrl(pet)
                      return (
                        <>
                    <p className="font-semibold text-gray-900">{pet.name}</p>
                    <p>飼い主: {getPetRelatedValue(pet.customers, 'full_name')}</p>
                    <p>犬種: {formatPetFallback(pet.breed)}</p>
                    <p>性別: {formatPetFallback(pet.gender)}</p>
                    <p>生年月日: {formatPetFallback(pet.date_of_birth)}</p>
                    <p>体重: {formatPetWeight(pet.weight)}</p>
                    <p>ワクチン: {formatPetFallback(pet.vaccine_date)}</p>
                    <p>持病: {formatPetList(pet.chronic_diseases)}</p>
                    <p>注意事項: {formatPetFallback(pet.notes)}</p>
                    <p>
                      QR: {qrDisplayUrl ? <a href={qrDisplayUrl} className="text-blue-600 underline" target="_blank" rel="noreferrer">表示</a> : '未生成'}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Link href={`/pets?tab=list&edit=${pet.id}`} className="text-blue-600 text-sm">
                        編集
                      </Link>
                      <form action={`/api/pets/${pet.id}`} method="post">
                        <input type="hidden" name="_method" value="delete" />
                        <Button type="submit" className="bg-red-500 hover:bg-red-600">
                          削除
                        </Button>
                      </form>
                    </div>
                        </>
                      )
                    })()}
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm text-left" data-testid="pets-list">
                  <thead className="text-gray-500 border-b">
                    <tr>
                      <th className="py-2 px-2">ペット名</th>
                      <th className="py-2 px-2">飼い主</th>
                      <th className="py-2 px-2">犬種</th>
                      <th className="py-2 px-2">性別</th>
                      <th className="py-2 px-2">生年月日</th>
                      <th className="py-2 px-2">体重</th>
                      <th className="py-2 px-2">ワクチン</th>
                      <th className="py-2 px-2">持病</th>
                      <th className="py-2 px-2">注意事項</th>
                      <th className="py-2 px-2">QR</th>
                      <th className="py-2 px-2">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {petList.map((pet) => (
                      <tr
                        key={pet.id}
                        className="text-gray-700"
                        data-testid={`pet-row-${pet.id}`}
                      >
                        {(() => {
                          const qrDisplayUrl = resolvePetQrDisplayUrl(pet)
                          return (
                            <>
                        <td className="py-3 px-2 font-medium text-gray-900">{pet.name}</td>
                        <td className="py-3 px-2">{getPetRelatedValue(pet.customers, 'full_name')}</td>
                        <td className="py-3 px-2">{formatPetFallback(pet.breed)}</td>
                        <td className="py-3 px-2">{formatPetFallback(pet.gender)}</td>
                        <td className="py-3 px-2">{formatPetFallback(pet.date_of_birth)}</td>
                        <td className="py-3 px-2">{formatPetWeight(pet.weight)}</td>
                        <td className="py-3 px-2">{formatPetFallback(pet.vaccine_date)}</td>
                        <td className="py-3 px-2">{formatPetList(pet.chronic_diseases)}</td>
                        <td className="py-3 px-2">{formatPetFallback(pet.notes)}</td>
                        <td className="py-3 px-2">
                          {qrDisplayUrl ? (
                            <a
                              href={qrDisplayUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 underline"
                            >
                              QR表示
                            </a>
                          ) : (
                            '未生成'
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/pets?tab=list&edit=${pet.id}`}
                              className="text-blue-600 text-sm"
                            >
                              編集
                            </Link>
                            <form action={`/api/pets/${pet.id}`} method="post">
                              <input type="hidden" name="_method" value="delete" />
                              <Button type="submit" className="bg-red-500 hover:bg-red-600">
                                削除
                              </Button>
                            </form>
                          </div>
                        </td>
                            </>
                          )
                        })()}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      ) : null}

      {isCreateModalOpen || editPetData ? (
        <PetCreateModal
          title={editPetData ? 'ペット情報の更新' : '新規ペット登録'}
          closeRedirectTo={modalCloseRedirect}
        >
          <form
            action={editPetData ? `/api/pets/${editPetData.id}` : '/api/pets'}
            method="post"
            className="space-y-4"
          >
            {editPetData && <input type="hidden" name="_method" value="put" />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2 text-sm text-gray-700">
              飼い主
              <select
                name="customer_id"
                required
                defaultValue={editPetData?.customer_id ?? ''}
                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-400 outline-none"
              >
                <option value="" disabled>
                  選択してください
                </option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              ペット名
              <Input
                name="name"
                required
                defaultValue={editPetData?.name ?? ''}
                placeholder="モコ"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              犬種
              <Input
                name="breed"
                defaultValue={editPetData?.breed ?? ''}
                placeholder="トイプードル"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              性別
              <select
                name="gender"
                defaultValue={editPetData?.gender ?? ''}
                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-400 outline-none"
              >
                <option value="">未選択</option>
                {genderOptions.map((gender) => (
                  <option key={gender} value={gender}>
                    {gender}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              生年月日
              <Input
                type="date"
                name="date_of_birth"
                defaultValue={editPetData?.date_of_birth ?? ''}
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              体重 (kg)
              <Input
                type="number"
                step="0.1"
                name="weight"
                defaultValue={editPetData?.weight?.toString() ?? ''}
                placeholder="3.2"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              最終ワクチン接種日
              <Input
                type="date"
                name="vaccine_date"
                defaultValue={editPetData?.vaccine_date ?? ''}
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              持病 (カンマ区切り)
              <Input
                name="chronic_diseases"
                defaultValue={editPetData?.chronic_diseases?.join(', ') ?? ''}
                placeholder="心臓, アレルギー"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
              注意事項
              <Input
                name="notes"
                defaultValue={editPetData?.notes ?? ''}
                placeholder="噛む、怖がりなど"
              />
            </label>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit">{editPetData ? '更新する' : '登録する'}</Button>
              {editPetData && (
                <Link href={modalCloseRedirect} className="text-sm text-gray-500">
                  編集をやめる
                </Link>
              )}
            </div>
          </form>
        </PetCreateModal>
      ) : null}
    </section>
  )
}
