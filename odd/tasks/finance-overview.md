# Finance overview (Resumen) — frontend, Phase 4

## Objective

Add a "Resumen" tab to Finanzas: an online, read-only overview of recorded operating inputs for a period (`GET /api/v1/finance/overview`). It is NOT a cash balance, withdrawable profit or distribution.

## Scope

- In: types, service, pure util, Pinia store, `OverviewView` at `/app/finanzas/resumen`, first Finanzas tab, help articles, tests.
- Per-partner work (jornadas + hours, no money) reuses `GET /finance/work-shifts/summary` for the SAME period; if it fails the view shows overview totals only.
- Reserves: shown only as the overview returns them (`reserves.activeCount/plannedMinor`, warning `RESERVES_PENDING`) with a calm "aún no configurables" note.
- Out: reserves CRUD (the backend has NO reserves endpoints; no contract is invented), sharing/percentages/hourly value/capital recovery/advice, offline storage (online-only, no IndexedDB/outbox).

## Constraints

- Source of truth: `bazar-api/doc/finance-overview-reserves.md`, `src/finance/finance-overview.*.ts`. Query `[from,to)` with `to` exclusive: the picker's inclusive end is sent as `addDaysToKey(to, 1)`.
- Money is integer MXN cents and may be negative. Never use the words "Ganancia para repartir".
- Existing routes (`/app/finanzas`, `/gastos`, `/jornadas`) unchanged.
- No push, merge or deploy. Conventional Commits only.
- Advisory heuristic: ~400 authored changed lines per task.

## Tasks

- [x] FO-F1 Types + service + util (coverage text, exclusive-to, labelling) + tests (667b239)
- [x] FO-F2 Pinia store (stale-response guard, last confirmed data, per-partner summary) + tests (b7bbd9f)
- [x] FO-F3 View + Resumen tab (first) + lazy route + tests (a3ac1b9)
- [x] FO-F4 Help articles + tests (abfcaf7)
- [x] FO-F5 Verification (full vitest, lint, build)
- [x] FR1/FR2 Reserves CRUD — superseded by Phase 2 (backend create/list/cancel now exists)

## Route

Per task: delegated direct (single bounded writer; trigger: 2+ non-trivial files).

## Progress / evidence

Branch `feat/finance-overview-reserves` created from `feat/finance-work-shifts` @ 6e05a0a (clean tree). Backend contract re-read; it matches the brief (no diff).
FO-F1 observed: service/util tests 22 passed, eslint clean, vue-tsc -b clean. Auth + member/device headers come from the shared axios interceptor, so the overview service needs no explicit origin. Fixture shared at `src/services/__tests__/finance-overview.fixture.ts` (sibling convention).
FO-F2 observed: store tests 8 passed (stale-response guard for success and failure, last-confirmed data kept on error, partner degradation, reset).
FO-F3 observed: `npx vitest run src/views/finance src/router` 10 files / 242 tests passed (OverviewView 20 tests; Contributions/Expenses/WorkShifts tab assertions updated for the new first tab), eslint and vue-tsc -b clean. Route `/app/finanzas/resumen` (name FinanceOverview) lazy, same socio+gestion guard; `/app/finanzas` still Aportaciones.
FO-F4 observed: help articles `resumen-finanzas` (guide) and `resumen-preguntas` (7 questions: resultado operativo, margen vs resultado, compras de inventario, reserva, monto potencialmente disponible, por qué no es efectivo, aportación no es ingreso); `npx vitest run src/config src/views/help` 11 files / 336 tests passed, eslint clean.
FO-F5 observed: `npx vitest run` 206 files / 3576 tests passed (includes Aportaciones, Gastos and Jornadas regression; their tab assertions were updated for the new first tab), `npm run lint` clean, `npm run build` (vue-tsc -b + vite build) OK.
Commits: FO-F1 667b239, FO-F2 b7bbd9f, FO-F3 a3ac1b9, FO-F4 abfcaf7, evidence/closure commit below.
Pending: Reserves (FR1/FR2) blocked on backend (no reserves endpoints; the view only shows what the overview returns: `reserves.activeCount/plannedMinor` and a "próximamente" note). Real browser/viewport validation not done (jsdom cannot measure layout). Per-partner names come from the summary's embedded `member`; there is no fallback to the finance-references cache.

## Review follow-ups

Fixed in d2a5fec (full vitest 206 files / 3584 tests, lint, build all green):

- [x] Invalid response shape no longer shown as a network error: `FinanceOverviewContractError` maps to a dedicated message and the retry button is hidden for it (d2a5fec)
- [x] Stale label kept during retry: store `refreshFailed` flag cleared only on success or reset, so "Ultimo resumen confirmado" stays while retrying (d2a5fec)
- [x] Overview loads when access becomes allowed after mount (watcher refreshes, respecting range validity; reset on false kept) (d2a5fec)

Pending (out of scope, deferred):

- [ ] Store reset on logout / account switch
- [ ] Percentage rounding can reach 101% (known + missing)
- [ ] Overview blocked on slow partner summary (Promise.allSettled waits for both)

## Phase 2: Reservas (backend create/list/cancel now exists)

Source of truth re-read: `bazar-api/doc/finance-overview-reserves.md` (create/list/cancel) and `src/finance/finance-reserve.dto.ts`. It matches the brief; no contract diff. Online-only (no IndexedDB/outbox). Idempotency: the UUIDv7 of a create (and of a cancel) is generated once per form session / cancel dialog and reused on retry. Route `/app/finanzas/reservas` (name FinanceReserves), tab "Reservas" last.

- [x] FO-R1 Types + service + utils (period display, form validation, totals) + tests
- [x] FO-R2 Pinia store (list, cursor pagination, stale guard, create/cancel with reused ids, overview refresh) + tests
- [x] FO-R3 ReservesView + tab + lazy route + tab-list test updates
- [x] FO-R4 Overview integration (real reserves block, link, no "próximamente") + help + tests
- [x] FO-R5 Verification (full vitest, lint, build)

Route per task: delegated direct (single bounded writer; trigger: 2+ non-trivial files). Evidence and commit hashes are recorded below as each task closes.

### Phase 2 evidence
FO-R1 (df28d44) observed: service + utils tests 46 passed (create body/headers, replay, exact-period list params, cancel path, strict response validation, inclusive period display, form validation, totals separation, error mapping). RED not separately observed (types, service and utils were written together with their tests). Route: delegated direct.
FO-R2 (27afd58) observed: store tests 21 passed (exact-period + all-periods queries, cursor paging without duplicates, stale-response guard for list and next page, last list kept on failure, create refreshes list and an already loaded overview, retry after network/5xx reuses the SAME id and audit instant, 400 frees the id, 409 refreshes and frees the id, double-submit guard, cancel reuses id, reset). Route: delegated direct.
FO-R3 (c51dc0b) observed: `npx vitest run src/views/finance` 6 files / 150 tests passed (ReservesView 26 tests: tabs, exact-period request, one request per period/filter change, linked period, create with exclusive end + reused id on retry, 409 copy, cancel panel requires reason and returns focus, reversed display, other-period flag and separate totals, load more, no table, labels/aria-live). Tab-list assertions updated in Aportaciones/Gastos/Jornadas/Resumen view tests and finance-route.test.ts. eslint and vue-tsc -b clean. Route `/app/finanzas/reservas` (name FinanceReserves) lazy, same socio+gestion guard. Components: ReservesView.vue, components/ReserveCard.vue (inline confirm panel instead of AppModal: simpler focus return, no teleport). Route: delegated direct.
FO-R4 (c7849b6) observed: Resumen reserves block now shows real activeCount/plannedMinor, explains exact-period matching, links to /app/finanzas/reservas carrying the shown from/to, drops the "próximamente" copy and tolerates a stray RESERVES_PENDING; a period with only reserves no longer shows the empty state; prudent disclaimer unchanged. Fixture no longer sends RESERVES_PENDING by default. Help: new guide `reservas-finanzas`, updated `resumen-finanzas` tip and `resumen-preguntas` (reserve answer, new "¿Por qué mi reserva no aparece en este período?"). Overview/util/help tests updated; views+config+utils+services+stores suites green. Route: delegated direct.
FO-R5 observed: `npx vitest run` 210 files / 3683 tests passed, `npm run lint` clean (exit 0), `npm run build` (vue-tsc -b + vite build + PWA) OK. A first cold full run showed one 5s timeout in src/router tests (a different one each time, lazy-import cold start); a warm re-run of src/router and the full suite passed, so it is environmental flakiness, not a regression. Not done: real browser/viewport validation (jsdom cannot measure layout). Limitations: online-only (no offline queue), no edit (cancel + recreate), the picker used to block a future end date (lifted in 46cafb3 for Reservas and Resumen only, via `validateRange(..., { allowFuture: true })`, so a full-month reserve can be planned and matched; other views keep the no-future rule), no machine-readable reserve error codes (messages come from status only). Commits: FO-R1 df28d44, FO-R2 27afd58, FO-R3 c51dc0b, FO-R4 c7849b6, closure below.


## Review follow-ups (reserves)

Fixed (full vitest 210 files / 3696 tests, lint and build green after both):

- [x] 1. Cancel state attributed to the wrong card: store exposes `cancellingId`/`cancelErrorId`; busy and error derive from them; other cards get a disabled confirm with "Espera a que termine la anulación en curso."; the view no longer clears messages when the store would refuse (235442c)
- [x] 2. Default reserve stopped counting the next day: calm non-blocking hint when the applied period is open-ended, and future period end allowed in Reservas and Resumen (opt-in `allowFuture`, plus `endOfMonthKey`) (46cafb3)

Deferred (out of scope):

- [ ] Filters apply pending dates / controls diverge when the range is invalid
- [ ] `savedPeriod` is captured after an await
- [ ] Non-string dates in the receipt validator are untested
