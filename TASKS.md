# TASKS.md

Development Task List

This file contains the list of development tasks for the project.
AI agents should prioritize unfinished tasks.

---

# Current Tasks

## Differentiation Features

### Phase 1: Photo Medical Record UX

* [x] Create branch `feat/medical-record-fast-flow`
* [x] Add appointment/payment driven prefill into photo medical record flow
* [x] Replace generic photo upload entry with `施術前を撮る` / `施術後を撮る`
* [x] Optimize photo medical record modal for mobile-first operation
* [x] Show share actions immediately after save
* [x] Add one-tap LINE send when customer has `line_id`
* [ ] Add tests for photo upload/share flow where feasible

### Phase 2: Deep LINE Integration

* [x] Create branch `feat/medical-record-line-share`
* [x] Add medical record LINE share sending path using existing `line_id`
* [x] Store notification logs for medical record share sends
* [x] Create branch `feat/line-webhook-linking`
* [x] Add LINE webhook endpoint
* [x] Verify LINE signature and persist webhook events
* [x] Design or implement customer auto-link flow from LINE events
* [x] Update customer screens to show LINE linked/unlinked state clearly

### Phase 3: Multi-pet Booking UX

* [x] Create branch `feat/multi-pet-booking-ui`
* [x] Add sequential family booking flow for same customer
* [x] Add `別のペットを続けて予約` action after first booking
* [x] Extend public reservation flow to add another pet in one session
* [x] Add family-level booking confirmation UI

### Phase 4: Multi-pet Booking Data Model

* [x] Create branch `feat/multi-pet-booking-group-model`
* [x] Design `appointment_groups` or equivalent grouping model
* [x] Define backward-compatible migration strategy
* [x] Update booking APIs to support grouped bookings
* [ ] Update notifications and cancellation flows for grouped bookings
* [x] Add DB migrations and tests

### Supporting Work

* [x] Keep `docs/differentiation-feature-roadmap.md` updated as implementation decisions evolve
* [ ] Run lint/tests for each feature branch
* [ ] Update README or runbooks when user-facing behavior changes

## Core Features

* [ ] Implement CSV file parser
* [ ] Add input validation
* [ ] Implement data analysis module
* [ ] Add Excel export functionality
* [ ] Create command-line interface

---

## Testing

* [ ] Add unit tests for parser
* [ ] Add unit tests for analysis
* [ ] Add integration tests for full pipeline

---

## Improvements

* [ ] Improve error handling
* [ ] Improve logging
* [ ] Add configuration file support

---

## Documentation

* [ ] Update README
* [ ] Add usage examples
* [ ] Document main modules

---

# Task Strategy

When implementing a task:

1. Identify the relevant module
2. Implement the feature
3. Write tests
4. Run linting
5. Commit changes

Agents should update this file when tasks are completed.

Completed tasks should be marked:

[x] Task name
