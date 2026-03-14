import { runAppointmentRemindersJob } from '@/lib/cron/services/appointment-reminders'
import { runBillingRemindersJob } from '@/lib/cron/services/billing-reminders'
import { runBillingStatusSyncJob } from '@/lib/cron/services/billing-status-sync'
import { runBillingTrialRolloverJob } from '@/lib/cron/services/billing-trial-rollover'
import { runNotificationUsageBillingJob } from '@/lib/cron/services/notification-usage-billing'
import { runPurgeMemberPortalAccessLogsJob } from '@/lib/cron/services/purge-member-portal-access-logs'
import { runScanStorageOrphansJob } from '@/lib/cron/services/scan-storage-orphans'
import { runHotelVaccineAlertsJob } from '@/lib/cron/services/hotel-vaccine-alerts'

export const ALLOWED_CRON_JOB_NAMES = [
  'billing-status-sync',
  'billing-trial-rollover',
  'billing-reminders',
  'notification-usage-billing',
  'remind-appointments',
  'hotel-vaccine-alerts',
  'purge-member-portal-access-logs',
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
    case 'notification-usage-billing':
      return runNotificationUsageBillingJob()
    case 'remind-appointments':
      return runAppointmentRemindersJob()
    case 'hotel-vaccine-alerts':
      return runHotelVaccineAlertsJob()
    case 'purge-member-portal-access-logs':
      return runPurgeMemberPortalAccessLogsJob()
    case 'scan-storage-orphans':
      return runScanStorageOrphansJob()
  }
}
