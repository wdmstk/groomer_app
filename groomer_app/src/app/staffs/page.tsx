import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormModal } from '@/components/ui/FormModal'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { InviteManager } from '@/components/staffs/InviteManager'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('staffs')
    .select('id, full_name, email, user_id')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
  const staffs = data ?? []
  const { data: selfMembership } = currentUser
    ? await supabase
        .from('store_memberships')
        .select('id, user_id, role')
        .eq('store_id', storeId)
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .maybeSingle()
    : { data: null }
  const currentMembership = selfMembership
  const canManageRoles = currentMembership?.role === 'owner'
  const admin = canManageRoles ? createAdminClient() : null
  const { data: memberships } =
    canManageRoles && admin
      ? await admin
          .from('store_memberships')
          .select('id, user_id, role')
          .eq('store_id', storeId)
          .eq('is_active', true)
      : {
          data: currentMembership ? [currentMembership] : ([] as { id: string; user_id: string; role: 'owner' | 'admin' | 'staff' }[]),
        }
  const { data: chatParticipants } =
    canManageRoles && admin
      ? await admin
          .from('store_chat_participants')
          .select('user_id, can_participate')
          .eq('store_id', storeId)
      : { data: [] as { user_id: string; can_participate: boolean }[] }
  const membershipByUserId = new Map((memberships ?? []).map((m) => [m.user_id, m]))
  const chatPermissionByUserId = new Map(
    (chatParticipants ?? []).map((row) => [row.user_id, row.can_participate])
  )

  function getMembershipLabel(userId: string | null) {
    if (!userId) return '未連携'
    const membership = membershipByUserId.get(userId)
    if (membership) return membership.role
    return canManageRoles ? '未所属' : '非表示'
  }

  function getChatPermissionLabel(userId: string | null) {
    if (!userId) return '未連携'
    const membership = membershipByUserId.get(userId)
    if (membership?.role === 'owner') return '常に許可'
    if (!canManageRoles) return '非表示'
    return chatPermissionByUserId.get(userId) ? '許可' : '未許可'
  }
  const { data: editStaff } = editId
    ? await supabase
        .from('staffs')
        .select('id, full_name, email, user_id')
        .eq('id', editId)
        .eq('store_id', storeId)
        .single()
    : { data: null }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">スタッフ管理</h1>
        <p className="text-gray-600">
          スタッフ情報の登録・更新・削除が行えます。
        </p>
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
            <Link
              href="/staffs?tab=list&modal=create"
              className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              新規登録
            </Link>
          </div>
        </div>
        {staffs.length === 0 ? (
          <p className="text-sm text-gray-500">スタッフがまだ登録されていません。</p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {staffs.map((staff) => {
                const membership = staff.user_id ? membershipByUserId.get(staff.user_id) : undefined
                return (
                <article key={staff.id} className="rounded border p-3 text-sm text-gray-700">
                  <p className="font-semibold text-gray-900">{staff.full_name}</p>
                  <p>メール: {staff.email ?? '未登録'}</p>
                  <p>User ID: {staff.user_id ?? '未登録'}</p>
                  <p>権限: {getMembershipLabel(staff.user_id ?? null)}</p>
                  <p>
                    チャット参加:{' '}
                    {getChatPermissionLabel(staff.user_id ?? null)}
                  </p>
                  {canManageRoles && membership ? (
                    <form action={`/api/store-memberships/${membership.id}/role`} method="post" className="mt-2 flex items-center gap-2">
                      <select
                        name="role"
                        defaultValue={membership.role}
                        className="rounded border p-1 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                      >
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                        <option value="staff">staff</option>
                      </select>
                      <Button type="submit" className="bg-gray-700 hover:bg-gray-800">
                        権限変更
                      </Button>
                    </form>
                  ) : null}
                  {canManageRoles && staff.user_id && membership?.role !== 'owner' ? (
                    <form
                      action={`/api/staffs/${staff.id}/chat-access`}
                      method="post"
                      className="mt-2 flex items-center gap-2"
                    >
                      <input
                        type="hidden"
                        name="can_participate"
                        value={chatPermissionByUserId.get(staff.user_id) ? 'false' : 'true'}
                      />
                      <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                        {chatPermissionByUserId.get(staff.user_id) ? '参加を停止' : '参加を許可'}
                      </Button>
                    </form>
                  ) : null}
                  <div className="mt-2 flex items-center gap-2">
                    <Link href={`/staffs?tab=list&edit=${staff.id}`} className="text-blue-600 text-sm">
                      編集
                    </Link>
                    <form action={`/api/staffs/${staff.id}`} method="post">
                      <input type="hidden" name="_method" value="delete" />
                      <Button type="submit" className="bg-red-500 hover:bg-red-600">
                        削除
                      </Button>
                    </form>
                  </div>
                </article>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm text-left">
                <thead className="text-gray-500 border-b">
                  <tr>
                    <th className="py-2 px-2">氏名</th>
                    <th className="py-2 px-2">メールアドレス</th>
                    <th className="py-2 px-2">User ID</th>
                    <th className="py-2 px-2">権限</th>
                    <th className="py-2 px-2">チャット参加</th>
                    <th className="py-2 px-2">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {staffs.map((staff) => {
                    const membership = staff.user_id ? membershipByUserId.get(staff.user_id) : undefined
                    return (
                    <tr key={staff.id} className="text-gray-700">
                      <td className="py-3 px-2 font-medium text-gray-900">{staff.full_name}</td>
                      <td className="py-3 px-2">{staff.email ?? '未登録'}</td>
                      <td className="py-3 px-2">{staff.user_id ?? '未登録'}</td>
                      <td className="py-3 px-2">{getMembershipLabel(staff.user_id ?? null)}</td>
                      <td className="py-3 px-2">{getChatPermissionLabel(staff.user_id ?? null)}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          {canManageRoles && membership ? (
                            <form action={`/api/store-memberships/${membership.id}/role`} method="post" className="flex items-center gap-2">
                              <select
                                name="role"
                                defaultValue={membership.role}
                                className="rounded border p-1 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                              >
                                <option value="owner">owner</option>
                                <option value="admin">admin</option>
                                <option value="staff">staff</option>
                              </select>
                              <Button type="submit" className="bg-gray-700 hover:bg-gray-800">
                                権限変更
                              </Button>
                            </form>
                          ) : null}
                          {canManageRoles && staff.user_id && membership?.role !== 'owner' ? (
                            <form action={`/api/staffs/${staff.id}/chat-access`} method="post">
                              <input
                                type="hidden"
                                name="can_participate"
                                value={chatPermissionByUserId.get(staff.user_id) ? 'false' : 'true'}
                              />
                              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                                {chatPermissionByUserId.get(staff.user_id) ? '参加停止' : '参加許可'}
                              </Button>
                            </form>
                          ) : null}
                          <Link
                            href={`/staffs?tab=list&edit=${staff.id}`}
                            className="text-blue-600 text-sm"
                          >
                            編集
                          </Link>
                          <form action={`/api/staffs/${staff.id}`} method="post">
                            <input type="hidden" name="_method" value="delete" />
                            <Button type="submit" className="bg-red-500 hover:bg-red-600">
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
