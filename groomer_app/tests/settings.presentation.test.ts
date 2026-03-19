import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getSettingsManageLabel,
  toSettingsBool,
  toSettingsFollowupDays,
  toSettingsInt,
} from '../src/lib/settings/presentation.ts'

test('settings presentation helpers normalize roles and booleans', () => {
  assert.deepEqual(getSettingsManageLabel('admin'), {
    currentRole: 'admin',
    canManage: true,
    label: 'あり（owner/admin）',
  })
  assert.deepEqual(getSettingsManageLabel(null), {
    currentRole: '未所属',
    canManage: false,
    label: 'なし',
  })
  assert.equal(toSettingsBool(null, true), true)
})

test('settings presentation helpers clamp ints and followup days', () => {
  assert.equal(toSettingsInt(30.8, 18, 0, 23), 23)
  assert.deepEqual(toSettingsFollowupDays([60, 30, 30, 500, 1]), [1, 30, 60])
  assert.deepEqual(toSettingsFollowupDays(null), DEFAULT_NOTIFICATION_SETTINGS.followup_days)
})
