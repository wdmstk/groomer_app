import test from 'node:test'
import assert from 'node:assert/strict'
import {
  requireJournalPermission,
  resolveJournalPermissions,
  type JournalPermissions,
} from '../src/lib/journal/permissions.ts'

function createSupabaseStub(result: { data: unknown; error: { message: string } | null }) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => result,
                  }
                },
              }
            },
          }
        },
      }
    },
  }
}

test('resolveJournalPermissions returns role defaults when override is missing', async () => {
  const supabase = createSupabaseStub({ data: null, error: null })

  const owner = await resolveJournalPermissions({
    supabase,
    storeId: 'store-1',
    role: 'owner',
  })
  const staff = await resolveJournalPermissions({
    supabase,
    storeId: 'store-1',
    role: 'staff',
  })

  assert.deepEqual(owner, {
    canCreate: true,
    canPublish: true,
    canViewInternal: true,
    canDelete: true,
  })
  assert.deepEqual(staff, {
    canCreate: true,
    canPublish: false,
    canViewInternal: false,
    canDelete: false,
  })
})

test('resolveJournalPermissions applies DB override when available', async () => {
  const supabase = createSupabaseStub({
    data: {
      can_create: true,
      can_publish: true,
      can_view_internal: false,
      can_delete: false,
    },
    error: null,
  })

  const permissions = await resolveJournalPermissions({
    supabase,
    storeId: 'store-1',
    role: 'staff',
  })

  assert.deepEqual(permissions, {
    canCreate: true,
    canPublish: true,
    canViewInternal: false,
    canDelete: false,
  })
})

test('requireJournalPermission blocks non-permitted operation', () => {
  const permissions: JournalPermissions = {
    canCreate: true,
    canPublish: false,
    canViewInternal: false,
    canDelete: false,
  }

  const denied = requireJournalPermission(permissions, 'canPublish')
  assert.equal(denied.ok, false)
  if (!denied.ok) {
    assert.equal(denied.status, 403)
  }

  const allowed = requireJournalPermission(permissions, 'canCreate')
  assert.equal(allowed.ok, true)
})
