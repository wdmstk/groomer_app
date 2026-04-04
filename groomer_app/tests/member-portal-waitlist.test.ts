import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeMemberPortalWaitlistInput,
  validateMemberPortalWaitlistInput,
} from '../src/lib/member-portal-waitlist.ts'

test('normalizeMemberPortalWaitlistInput trims values and applies fallback channel', () => {
  const normalized = normalizeMemberPortalWaitlistInput(
    {
      pet_id: '  pet-1 ',
      preferred_menu: '  シャンプー  ',
      preferred_staff_id: '  staff-1 ',
      channel: 'invalid',
      desired_from: ' 2026-04-05T10:00 ',
      desired_to: ' 2026-04-05T11:00 ',
      notes: '  連絡は平日希望 ',
    },
    'phone'
  )

  assert.equal(normalized.pet_id, 'pet-1')
  assert.equal(normalized.preferred_menu, 'シャンプー')
  assert.equal(normalized.preferred_staff_id, 'staff-1')
  assert.equal(normalized.channel, 'phone')
  assert.equal(normalized.desired_from, '2026-04-05T10:00')
  assert.equal(normalized.desired_to, '2026-04-05T11:00')
  assert.equal(normalized.notes, '連絡は平日希望')
})

test('normalizeMemberPortalWaitlistInput prefers preferred_menus array over single value', () => {
  const normalized = normalizeMemberPortalWaitlistInput(
    {
      preferred_menu: '単一メニュー',
      preferred_menus: ['  シャンプー  ', 'カット', 'シャンプー'],
    },
    'manual'
  )

  assert.equal(normalized.preferred_menu, 'シャンプー\nカット')
})

test('validateMemberPortalWaitlistInput rejects inverted date range', () => {
  const message = validateMemberPortalWaitlistInput({
    pet_id: null,
    preferred_menu: null,
    preferred_staff_id: null,
    channel: 'manual',
    desired_from: '2026-04-06T12:00',
    desired_to: '2026-04-06T11:00',
    notes: null,
  })

  assert.equal(message, '希望終了は希望開始以降で指定してください。')
})

test('validateMemberPortalWaitlistInput accepts empty date range', () => {
  const message = validateMemberPortalWaitlistInput({
    pet_id: null,
    preferred_menu: null,
    preferred_staff_id: null,
    channel: 'manual',
    desired_from: null,
    desired_to: null,
    notes: null,
  })

  assert.equal(message, null)
})

test('validateMemberPortalWaitlistInput accepts same datetime range', () => {
  const message = validateMemberPortalWaitlistInput({
    pet_id: null,
    preferred_menu: null,
    preferred_staff_id: null,
    channel: 'manual',
    desired_from: '2026-04-06T11:00',
    desired_to: '2026-04-06T11:00',
    notes: null,
  })

  assert.equal(message, null)
})
