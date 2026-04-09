import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormModal } from '@/components/ui/FormModal'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { InviteManager } from '@/components/staffs/InviteManager'
import {
  canCreateMoreStaff,
  getStaffMembershipLabel,
} from '@/lib/staffs/presentation'
import { staffsPageFixtures } from '@/lib/e2e/staffs-page-fixtures'
import { asStorePlanOptionsClient, fetchStorePlanOptionState } from '@/lib/store-plan-options'
import { isPlanAtLeast } from '@/lib/subscription-plan'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type StaffsPageProps = {
  searchParams?: Promise<{
    tab?: string
    modal?: string
    edit?: string
  }>
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default async function StaffsPage({ searchParams }: StaffsPageProps) {
  const resolvedSearchParams = await searchParams
  const activeTab = 'list'
  const isCreateModalOpen =
    resolvedSearchParams?.modal === 'create' || resolvedSearchParams?.tab === 'new'
  const editId = resolvedSearchParams?.edit
  const modalCloseRedirect = `/staffs?tab=${activeTab}`
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: staffsPageFixtures.storeId }
    : await createStoreScopedClient()
  const db = supabase as NonNullable<typeof supabase>
  const planState = isPlaywrightE2E
    ? { planCode: 'light', hotelOptionEnabled: false, notificationOptionEnabled: false }
    : await fetchStorePlanOptionState({
        supabase: asStorePlanOptionsClient(db),
        storeId,
      })
  const isStandardOrHigher = isPlaywrightE2E ? false : isPlanAtLeast(planState.planCode, 'standard')
  const isLightPlan = isPlaywrightE2E ? staffsPageFixtures.isLightPlan : !isStandardOrHigher
  const currentUser = isPlaywrightE2E ? { id: 'user-001' } : (await db.auth.getUser()).data.user
  const data = isPlaywrightE2E
    ? staffsPageFixtures.staffs
    : (
        await db
          .from('staffs')
          .select('id, full_name, email, user_id')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      ).data
  const staffs = data ?? []
  const canCreateStaff = canCreateMoreStaff({ isLightPlan, staffCount: staffs.length })
  const selfMembership = isPlaywrightE2E
    ? staffsPageFixtures.memberships[0]
    : currentUser
      ? (
          await db
            .from('store_memberships')
            .select('id, user_id, role')
            .eq('store_id', storeId)
            .eq('user_id', currentUser.id)
            .eq('is_active', true)
            .maybeSingle()
        ).data
      : null
  const currentMembership = selfMembership
  const canManageRoles = isPlaywrightE2E
    ? staffsPageFixtures.canManageRoles
    : currentMembership?.role === 'owner' && isStandardOrHigher
  const admin = canManageRoles ? createAdminClient() : null
  const memberships =
    isPlaywrightE2E
      ? staffsPageFixtures.memberships
      : canManageRoles && admin
        ? (
            await admin
              .from('store_memberships')
              .select('id, user_id, role')
              .eq('store_id', storeId)
              .eq('is_active', true)
          ).data
        : (currentMembership
            ? [currentMembership]
            : ([] as { id: string; user_id: string; role: 'owner' | 'admin' | 'staff' }[]))
  const membershipByUserId = new Map((memberships ?? []).map((m) => [m.user_id, m]))

  function getMembershipLabel(userId: string | null) {
    return getStaffMembershipLabel({
      userId,
      canManageRoles,
      roleByUserId: new Map(Array.from(membershipByUserId.entries()).map(([id, membership]) => [id, membership.role])),
    })
  }

  const editStaff =
    !editId
      ? null
      : isPlaywrightE2E
        ? staffsPageFixtures.staffs.find((staff) => staff.id === editId) ?? null
        : (
            await db
              .from('staffs')
              .select('id, full_name, email, user_id')
              .eq('id', editId)
              .eq('store_id', storeId)
              .single()
          ).data

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">スタッフ管理</h1>
        {isLightPlan ? (
          <p className="text-sm text-amber-700">
            ライトプランではスタッフは3人まで登録可能です。権限変更はスタンダード以上で利用できます。
          </p>
        ) : null}
      </div>

      <InviteManager />

      <div className="flex items-center gap-4 border-b">
        <Link
          href="/staffs?tab=list"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          スタッフ一覧
        </Link>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">スタッフ一覧</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">全 {staffs.length} 件</p>
            {canCreateStaff ? (
              <Link
                href="/staffs?tab=list&modal=create"
                className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                新規登録
              </Link>
            ) : (
              <span
                aria-disabled
                className="inline-flex cursor-not-allowed items-center rounded bg-gray-300 px-3 py-2 text-sm font-semibold text-gray-600"
              >
                上限（3人）
              </span>
            )}
          </div>
        </div>
        {staffs.length === 0 ? (
          <p className="text-sm text-gray-500">スタッフがまだ登録されていません。</p>
        ) : (
          <>
            <div className="space-y-2.5 md:hidden" data-testid="staffs-list-mobile">
              {staffs.map((staff) => {
                const membership = staff.user_id ? membershipByUserId.get(staff.user_id) : undefined
                return (
                <article
                  key={staff.id}
                  className="rounded border border-gray-200 p-3 text-sm text-gray-700"
                  data-testid={`staff-row-${staff.id}`}
                >
                  <p className="truncate font-semibold text-gray-900">{staff.full_name}</p>
                  <p className="truncate text-xs text-gray-500">メール: {staff.email ?? '未登録'}</p>
                  <p className="truncate text-xs text-gray-500">User ID: {staff.user_id ?? '未登録'}</p>
                  <span className="mt-2 inline-flex rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                    {getMembershipLabel(staff.user_id ?? null)}
                  </span>
                  {canManageRoles && membership ? (
                    <form action={`/api/store-memberships/${membership.id}/role`} method="post" className="mt-2 flex items-center gap-1.5">
                      <select
                        name="role"
                        defaultValue={membership.role}
                        className="h-7 rounded border px-1.5 text-xs focus:ring-2 focus:ring-blue-400 outline-none"
                      >
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                        <option value="staff">staff</option>
                      </select>
                      <Button type="submit" className="h-7 border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap">
                        権限変更
                      </Button>
                    </form>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/staffs?tab=list&edit=${staff.id}`}
                      className="inline-flex h-7 items-center justify-center rounded border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      編集
                    </Link>
                    <form action={`/api/staffs/${staff.id}`} method="post">
                      <input type="hidden" name="_method" value="delete" />
                      <Button type="submit" className="h-7 border border-red-300 bg-red-50 px-2 py-0 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap">
                        削除
                      </Button>
                    </form>
                  </div>
                </article>
                )
              })}
            </div>

            <div className="hidden md:block">
              <table className="min-w-full table-fixed text-sm text-left" data-testid="staffs-list">
                <thead className="border-b bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-2.5 py-2">スタッフ</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">権限</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {staffs.map((staff) => {
                    const membership = staff.user_id ? membershipByUserId.get(staff.user_id) : undefined
                    return (
                    <tr
                      key={staff.id}
                      className="text-gray-700"
                      data-testid={`staff-row-${staff.id}`}
                    >
                      <td className="px-2.5 py-2 align-top">
                        <p className="truncate font-medium text-gray-900">{staff.full_name}</p>
                        <p className="truncate text-xs text-gray-500">{staff.email ?? '未登録'}</p>
                        <p className="truncate text-xs text-gray-500">User ID: {staff.user_id ?? '未登録'}</p>
                      </td>
                      <td className="px-2.5 py-2 align-top">
                        <span className="inline-flex rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                          {getMembershipLabel(staff.user_id ?? null)}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {canManageRoles && membership ? (
                            <form action={`/api/store-memberships/${membership.id}/role`} method="post" className="flex items-center gap-1.5">
                              <select
                                name="role"
                                defaultValue={membership.role}
                                className="h-7 rounded border px-1.5 text-xs focus:ring-2 focus:ring-blue-400 outline-none"
                              >
                                <option value="owner">owner</option>
                                <option value="admin">admin</option>
                                <option value="staff">staff</option>
                              </select>
                              <Button type="submit" className="h-7 border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap">
                                権限変更
                              </Button>
                            </form>
                          ) : null}
                          <Link
                            href={`/staffs?tab=list&edit=${staff.id}`}
                            className="inline-flex h-7 items-center justify-center rounded border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          >
                            編集
                          </Link>
                          <form action={`/api/staffs/${staff.id}`} method="post">
                            <input type="hidden" name="_method" value="delete" />
                            <Button type="submit" className="h-7 border border-red-300 bg-red-50 px-2 py-0 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap">
                              削除
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {isCreateModalOpen || editStaff ? (
        <FormModal
          title={editStaff ? 'スタッフ情報の更新' : '新規スタッフ登録'}
          closeRedirectTo={modalCloseRedirect}
          description="スタッフ情報はモーダルで入力します。"
          reopenLabel="スタッフモーダルを開く"
        >
          <form
            action={editStaff ? `/api/staffs/${editStaff.id}` : '/api/staffs'}
            method="post"
            className="space-y-4"
          >
            {editStaff && <input type="hidden" name="_method" value="put" />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-2 text-sm text-gray-700">
                氏名
                <Input
                  name="full_name"
                  required
                  defaultValue={editStaff?.full_name ?? ''}
                  placeholder="山田 太郎"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                メールアドレス
                <Input
                  type="email"
                  name="email"
                  defaultValue={editStaff?.email ?? ''}
                  placeholder="taro@example.com"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                Supabase Auth User ID
                <Input
                  name="user_id"
                  defaultValue={editStaff?.user_id ?? ''}
                  placeholder="auth.users のUUID"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit">{editStaff ? '更新する' : '登録する'}</Button>
              {editStaff && (
                <Link href={modalCloseRedirect} className="text-sm text-gray-500">
                  編集をやめる
                </Link>
              )}
            </div>
          </form>
        </FormModal>
      ) : null}
    </section>
  )
}
