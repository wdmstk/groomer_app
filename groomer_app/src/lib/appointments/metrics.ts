export const APPOINTMENT_METRIC_EVENTS = {
  appointmentFormSubmit: 'appointment_form_submit',
  sameDayMoveResponse: 'same_day_move_response',
} as const

export const APPOINTMENT_METRIC_EVENT_TYPES = [
  APPOINTMENT_METRIC_EVENTS.appointmentFormSubmit,
  APPOINTMENT_METRIC_EVENTS.sameDayMoveResponse,
] as const

export type AppointmentMetricEventType = (typeof APPOINTMENT_METRIC_EVENT_TYPES)[number]
export type AppointmentMetricMode = 'new' | 'edit' | 'unknown'

export type AppointmentMetricRequestBody = {
  event_type?: string
  mode?: string
  elapsed_ms?: number
  click_count?: number
  field_change_count?: number
  selected_menu_count?: number
  used_template_copy?: boolean
  succeeded?: boolean
}

export function isAppointmentMetricEventType(value: string): value is AppointmentMetricEventType {
  return APPOINTMENT_METRIC_EVENT_TYPES.includes(value as AppointmentMetricEventType)
}

export function normalizeAppointmentMetricMode(value: string | null | undefined): AppointmentMetricMode {
  if (value === 'new' || value === 'edit') return value
  return 'unknown'
}

export function buildAppointmentMetricMeta(
  eventType: AppointmentMetricEventType,
  body: AppointmentMetricRequestBody | null
) {
  switch (eventType) {
    case APPOINTMENT_METRIC_EVENTS.appointmentFormSubmit:
      return {}
    case APPOINTMENT_METRIC_EVENTS.sameDayMoveResponse:
      return {
        succeeded: Boolean(body?.succeeded),
      }
  }
}
