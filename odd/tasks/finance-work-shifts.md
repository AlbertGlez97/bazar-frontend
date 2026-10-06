# Finance work shifts (Jornadas) — frontend

## Objective and authorized scope

Frontend only (`bazar-frontend`, branch `feat/finance-work-shifts`, stacked on `feat/finance-expenses`). Register real work, not pay: a work shift is never salary, commission, percentage, profit or distribution. No money values, no expected payment, no "what you get".

Authorized now: create, list, filter, summary, offline queue/sync/history, help, tests.
NOT authorized yet: correction/void (backend `POST /finance/work-shifts/:id/reversals` and receipt/list-item shapes are not defined). Do not guess them.
No backend changes, no push, no merge, no deploy, no distribution/payment calculation.

## Backend contract (source of truth: `bazar-api/odd/tasks/finance-work-shifts.md`, `bazar-api/src/finance/work-shift*.ts`)

- `POST /finance/work-shifts` socio only; body `{id UUIDv7, memberId, workDate YYYY-MM-DD, minutes? (int>=1 or null = unknown), note? (<=1000), createdByMemberId, deviceId}`; 201 on create, 200 exact replay (frozen receipt, may carry `warnings`).
- `GET /finance/work-shifts` filters `from` (inclusive) `to` (exclusive) `memberId` `status` `duration` `limit` `cursor`.
- `GET /finance/work-shifts/summary` -> `{totals:{shiftCount,knownMinutes,unknownDurationCount}, members:[...]}`, excludes reversed.
- `workDate` is a calendar date with no timezone: do not reuse instant helpers.

## Decisions

- Duration UX: two integer inputs (Hours, Minutes); empty = unknown (null), never 0; minutes = h*60+m with integers only.
- Reuse Expenses stack as template; new IndexedDB version 4 adds `pending-work-shifts` and `work-shift-history`, preserving all existing stores.
- TDD mode: not configured for this project (unknown). Ordinary implementation with tests alongside plus functional checks.
- Delivery strategy: ask-on-risk; forecast may exceed ~400 changed lines, slice into work-unit commits.

## Tasks

- [x] WS-F1 Types, IndexedDB v4 stores, records/db modules + upgrade tests (53a0cec)
- [x] WS-F2 Service (create/list/summary) + sync + store + AppLayout wiring + tests (362092f; AppLayout wiring test in 801036d)
- [x] WS-F3 Duration input + form validation/conversion + tests (9a06a25)
- [x] WS-F4 View (list, filters, summary, statuses), route, Finance tab + tests (801036d)
- [x] WS-F5 Help articles + evidence + tests; regression Contributions/Expenses (84d1e72)
- [ ] WS-F6 Corrections (BLOCKED until backend reversal contract exists)
- [ ] WS-F7 Real browser validation + future-date guard removal

## Route

Per task: delegated direct (one writer; trigger: 2+ non-trivial files).

## Progress / evidence

Branch created from `feat/finance-expenses` @ 28a2aa8.
WS-F1..F5 observed: `npm run test:run` 202 files / 3517 tests passed (includes Contributions and Expenses regression), `npm run lint` clean, `npm run build` (vue-tsc -b + vite build) OK (only the existing chunk-size notice). Existing tests touched only for the new DB version (3 to 4), the new store names and the third Finanzas tab.
Contract notes: list items expose `reversal`/`replacedByReversal` (read-only, shown as Anulada/Corregida); creation warnings only exist in the receipt and are kept when a list is merged; member names come from finance-references, then the list item `member`. No correction/void code was added (WS-F6 stays blocked). The form refuses a future date as a UI-only guard (not an API rule).
Frontend contract doc: `doc/finance-work-shifts.md`. Visual browser verification is still pending.
