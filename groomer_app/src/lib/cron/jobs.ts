import { runAppointmentRemindersJob } from '@/lib/cron/services/appointment-reminders'
import { runBillingRemindersJob } from '@/lib/cron/services/billing-reminders'
import { runBillingStatusSyncJob } from '@/lib/cron/services/billing-status-sync'
import { runBillingTrialRolloverJob } from '@/lib/cron/services/billing-trial-rollover'
import { runScanStorageOrphansJob } from '@/lib/cron/services/scan-storage-orphans'

export const ALLOWED_CRON_JOB_NAMES = [
  'billing-status-sync',
  'billing-trial-rollover',
  'billing-reminders',
  'remind-appointments',
  'scan-storage-orphans',
] as const

export type CronJobName = (typeof ALLOWED_CRON_JOB_NAMES)[number]

export function isCronJobName(value: string): value is CronJobName {
  return ALLOWED_CRON_JOB_NAMES.includes(value as CronJobName)
}

export async function runCronJobByName(jobName: CronJobName) {
  switch (jobName) {
    case 'billing-status-sync':
      return runBillingStatusSyncJob()
    case 'billing-trial-rollover':
      return runBillingTrialRolloverJob()
    case 'billing-reminders':
      return runBillingRemindersJob()
    case 'remind-appointments':
      return runAppointmentRemindersJob()
    case 'scan-storage-orphans':
      return runScanStorageOrphansJob()
  }
}
