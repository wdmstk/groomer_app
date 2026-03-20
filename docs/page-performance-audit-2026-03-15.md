# Page Performance Audit

Updated: 2026-03-15

## Goal

Apply the same performance review criteria across all pages without making blanket changes that increase complexity or regress UX.

## Review Criteria

- Keep initial render focused on data needed for the active tab or visible panel.
- Move large client-only UI blocks behind `next/dynamic` when they are not part of the first paint.
- Avoid duplicate client fetches caused by remounts or unstable effect dependencies.
- Avoid generating expensive derived assets such as signed URLs for rows that are not currently open.
- Prefer page-specific fixes over global rewrites.

## Already Improved

- `/dashboard`
  - Applied: `next/dynamic` for `QuickPaymentModal` and `SlotReofferPanel`.
  - Applied: tab-aware data loading so `overview` no longer fetches all followup and reoffer detail data.
  - Latest observed log: `GET /dashboard 200 in 1004ms (compile: 43ms, proxy.ts: 166ms, render: 796ms)`.

- `/customers`
  - Applied: dynamic import for `RevisitAlertList` and `CustomerCreateModal`.
  - Applied: shared in-flight caching for `/api/customers/ltv` and `/api/followups`.
  - Applied: alerts tab now skips list-only support data.
  - Latest observed logs: `/customers 602ms`, `/customers?tab=alerts 393ms`.

- `/appointments`
  - Applied: `next/dynamic` for `AppointmentCalendar` and `AppointmentCreateModal`.
  - Applied: form support data now loads only when create/edit/followup/reoffer flows need it.
  - Applied: shared `/api/stores` client cache for `StoreSwitcher` and `ReserveUrlCopyButton`.
  - Latest observed log: `GET /appointments 200 in 646ms (compile: 52ms, proxy.ts: 220ms, render: 373ms)`.

- `/medical-records`
  - Applied: signed URLs only for gallery and editing context.
  - Applied: form support data gated to modal usage.
  - Applied: `next/dynamic` for `MedicalRecordCreateModal`.
  - Latest observed log: `GET /medical-records 200 in 2.8s (compile: 1396ms, proxy.ts: 909ms, render: 534ms)`.

- `/hotel`
  - Applied: `next/dynamic` for `HotelStaysManager`.
  - Latest observed log: `GET /hotel 200 in 2.4s (compile: 1134ms, proxy.ts: 808ms, render: 505ms)`.

- `/service-menus`
  - Applied: moved duration suggestions to `/api/service-menus/duration-suggestions` and client-side loading.

- `/ops/today`
  - Applied: `next/dynamic` for `OpsStatusActionForm` and `OpsRevertStatusForm`.
  - Latest observed log: `GET /ops/today 200 in 1745ms (compile: 898ms, proxy.ts: 337ms, render: 510ms)`.

- `/visits`
  - Applied: extracted `VisitCreateModal` and loaded it with `next/dynamic`.
  - Applied: tab-aware query gating for list, revisit, followup, cycle, and quality sections.
  - Latest observed log: `GET /visits 200 in 1472ms (compile: 759ms, proxy.ts: 253ms, render: 460ms)`.

- `/settings/notifications`
  - Applied: `next/dynamic` for `NotificationTemplateEditor`.
  - Applied: shared in-flight cache for `/api/notification-templates`.
  - Applied: editor now renders one template at a time instead of all templates simultaneously.
  - Latest observed steady-state log: `GET /settings/notifications 200 in 540ms (compile: 46ms, proxy.ts: 223ms, render: 271ms)`.

- `/staffs`
  - Applied: `next/dynamic` for `InviteManager` and `FormModal`.
  - Applied: shared in-flight cache for `/api/store-invites`.

- `/support-tickets`
  - Applied: `next/dynamic` for `OwnerSupportTickets`.
  - Applied: shared in-flight cache for `/api/support-tickets`.

- `/settings/storage`
  - Applied: `next/dynamic` for `StorageAddonCheckoutPanel`.
  - Applied: partial-failure fallback and 5s timeout in storage usage aggregation for settings page only.
  - Latest observed log: `GET /settings/storage 200 in 2.5s (compile: 747ms, proxy.ts: 312ms, render: 1458ms)`.

## Route Inventory

### Higher structural risk

- `/dashboard`
  - `src/app/dashboard/page.tsx`: 1698 lines

- `/visits`
  - `src/app/visits/page.tsx`: 731 lines

- `/medical-records`
  - `src/app/medical-records/page.tsx`: 751 lines

- `/appointments`
  - `src/app/appointments/page.tsx`: 681 lines

- `/customers`
  - `src/app/customers/page.tsx`: 533 lines

- `/billing`
  - `src/app/billing/page.tsx`: 513 lines

- `/settings/notifications`
  - `src/app/settings/notifications/page.tsx`: 425 lines

### Remaining follow-up candidates

- `/inventory/*`
  - Most routes are now compile-heavy first-hit pages with render around 224-363ms.
  - Continue using modal extraction and route-level dynamic imports where product editing remains the biggest client bundle.

- `/billing`
  - Multiple billing panels were moved behind `next/dynamic`.
  - Re-check if render remains above about 600ms after a stable restart.

- `/settings/storage`
  - Current fix prioritizes availability over exact live usage.
  - If needed later, replace recursive full-bucket listing with a cheaper persisted usage snapshot.

## Large Client Components

- `src/components/hotel/HotelStaysManager.tsx`: 1689 lines
- `src/components/dev/CronJobsManager.tsx`: 953 lines
- `src/components/customers/RevisitAlertList.tsx`: 914 lines
- `src/components/medical-records/MedicalRecordCreateModal.tsx`: 911 lines
- `src/components/appointments/AppointmentForm.tsx`: 881 lines
- `src/components/appointments/AppointmentCalendar.tsx`: 880 lines
- `src/components/dashboard/SlotReofferPanel.tsx`: 826 lines
- `src/components/ui/Sidebar.tsx`: 566 lines

These files are the primary compile-risk candidates for horizontal review.

## Horizontal Rollout Patterns

### Pattern A: Active-scope data loading

Use when a route has tabs or closed panels.

- Fetch only the data needed for the active tab.
- Return `[]` or `null` fallbacks for inactive sections.
- Keep derived calculations working with empty fallbacks.

Applied to:

- `/dashboard`
- `/appointments`
- `/customers`
- `/ops/today`
- `/visits`

### Pattern B: Dynamic client islands

Use when a page imports a large client component that is not required for first paint.

- Replace direct import with `next/dynamic`.
- Add a lightweight loading placeholder only when needed.

Applied to:

- `/dashboard`
- `/hotel`
- `/appointments`
- `/medical-records`
- `/customers`
- `/settings/notifications`
- `/staffs`
- `/support-tickets`
- `/billing`
- `/settings/storage`

### Pattern C: Shared client fetch caching

Use when the same helper API is fetched more than once due to remounts or Strict Mode.

Applied to:

- `StoreSwitcher` and `ReserveUrlCopyButton` -> `/api/stores`
- `CustomerLtvSummary` -> `/api/customers/ltv`
- `RevisitAlertList` -> `/api/followups`
- `InviteManager` -> `/api/store-invites`
- `OwnerSupportTickets` -> `/api/support-tickets`
- `NotificationTemplateEditor` -> `/api/notification-templates`

### Pattern D: Expensive asset generation on demand

Use when a list page creates derived URLs or heavy transforms for every row.

Applied to:

- `/medical-records` photo signed URLs

## Recommended Next Checks

1. `/inventory/*`
   - Finish checking route-level compile costs after the product modal extraction.

2. `/billing`
   - Re-measure after a stable restart and split any still-heavy panels by visible section if needed.

3. `/settings/storage`
   - Consider moving usage aggregation to a background snapshot if admin storage listing stays unstable.

## Pages That Do Not Need Immediate Changes

- `/dashboard/appointments-kpi`
- `/dashboard/notification-logs`
- `/dashboard/audit-logs`
- `/manual`
- `/pets`
- `/hq`

## Guardrails

- Do not add dynamic imports to every page by default.
- Do not move data fetches client-side unless initial server render is clearly the bottleneck.
- Keep mobile UX first. Loading placeholders must not block core actions.
- Prefer instrumentation and user-observed logs over assumptions.
