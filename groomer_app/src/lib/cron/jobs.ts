import { runAppointmentRemindersJob } from '@/lib/cron/services/appointment-reminders'
import { runBillingRemindersJob } from '@/lib/cron/services/billing-reminders'
import { runBillingStatusSyncJob } from '@/lib/cron/services/billing-status-sync'
import { runBillingTrialRolloverJob } from '@/lib/cron/services/billing-trial-rollover'
import { runNotificationUsageBillingJob } from '@/lib/cron/services/notification-usage-billing'
import { runPurgeMemberPortalAccessLogsJob } from '@/lib/cron/services/purge-member-portal-access-logs'
import { runScanStorageOrphansJob } from '@/lib/cron/services/scan-storage-orphans'
import { runHotelVaccineAlertsJob } from '@/lib/cron/services/hotel-vaccine-alerts'
import { runNextVisitSuggestionsJob } from '@/lib/cron/services/next-visit-suggestions'
import { runMedicalRecordAiTagsJob } from '@/lib/cron/services/medical-record-ai-tags'

export const ALLOWED_CRON_JOB_NAMES = [
  'billing-status-sync',
  'billing-trial-rollover',
  'billing-reminders',
  'notification-usage-billing',
  'remind-appointments',
  'next-visit-suggestions',
  'medical-record-ai-tags',
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
    case 'next-visit-suggestions':
      return runNextVisitSuggestionsJob()
    case 'medical-record-ai-tags':
      return runMedicalRecordAiTagsJob()
    case 'hotel-vaccine-alerts':
      return runHotelVaccineAlertsJob()
    case 'purge-member-portal-access-logs':
      return runPurgeMemberPortalAccessLogsJob()
    case 'scan-storage-orphans':
      return runScanStorageOrphansJob()
  }
}
