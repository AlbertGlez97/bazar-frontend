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

WS-F7 (in progress, not checked): future-date guard removed (a2adcad); form accepts any valid calendar date, no `max` on the date input. Observed after: `npm run test:run` 202 files / 3517 tests passed, `npm run lint` clean, `npm run build` OK, `git diff --check` clean. The list period picker still caps `to` at today (`validateRange` 'future' + `:max="today"`), so a future-dated shift is hidden by the default "Este mes" period and unreachable from the picker (not redesigned).
Real browser validation (lab, socio `Testing Cruz`, only member available; lab data notes prefixed `LAB-JORNADAS-`, not voidable yet): create with 8 h 30 min (minutes 510, `8 h 30 min`, Sincronizada), without duration (minutes null, `Duración no registrada`, summary sin duración +1, known minutes unchanged), only minutes (45, `45 min`), future date 2026-10-06 accepted by the API with no note; validations (minutes 60, -5, 1.5, hours -1, total 0) rejected in Spanish with `role=alert`, nothing stored; date and member required natively; duplicate warning shown in plain language from the stored receipt and kept after reload; controlled set (8 h, 4 h 30, no duration) gave summary 6 jornadas, 21 h 45 min, 2 sin duración (arithmetic 510+45+480+270=1305 min); period Ayer = 0, Hoy/Este mes consistent, member filter consistent (no status/duration filters exist in the UI); offline: lab frontend container stopped (the service worker answers 503; `navigator.onLine` stayed true), shift saved Pendiente in `pending-work-shifts`, reload kept it, container restarted, auto sync without reload moved it to `work-shift-history` with the same UUID, single POST 201, no duplicate, summary updated; IndexedDB version 4 with all 9 stores; Aportaciones and Gastos open and list; Ayuda articles correct; no horizontal overflow at 320, 390, 768 and 1280 px (measured in same-origin iframes because the browser window could not be resized); no console errors. Findings: a future-dated shift is hidden by the default period and the picker refuses a `Hasta` after today (when the range is invalid the list shows it but the summary asks for a valid period): pending a user decision, not redesigned. Fixes: plural agreement of the Horas/Minutos error (d6edb46) and `aria-describedby` hint on the duration fields (732b969). Collaborator permissions: not tested in the browser (no collaborator account in the lab), covered by tests. Final: `npm run test:run` 202 files / 3518 tests passed, `npm run lint` clean, `npm run build` OK, `git diff --check` clean. WS-F6 stays blocked; Fase 3 is NOT closed.
Lab (local compose `../deploy/docker-compose.prod.yml`): frontend image rebuilt with `VITE_API_URL=/api/v1` (`--no-deps`, no DB/volume touched); bundle contains `finanzas/jornadas`, `work-shifts`, `/api/v1`, no `Program Files`. The lab API was later rebuilt and now serves `/api/v1/finance/work-shifts` (401 without credentials). The lab bundle does not yet include the two small fixes above (d6edb46, 732b969).
