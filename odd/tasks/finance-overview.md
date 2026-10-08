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

- [x] Store reset on logout / account switch (IC1; volatile Phase4 stores only)
- [x] Percentage rounding can reach 101% (known + missing) (IC1; complementary rounding)
- [x] Overview blocked on slow partner summary (IC1; overview publishes independently)

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

- [x] Filters apply pending dates / controls diverge when the range is invalid (IC1; applied period stays stable)
- [x] `savedPeriod` is captured after an await (IC1; capture submitted period before awaiting)
- [x] Non-string dates in the receipt validator are untested (IC1; explicit string guards and JSON contract cases; no runtime defect reproduced)

## Browser findings

Found in a real browser (Resumen and Reservas) and fixed, each with tests (RED observed before GREEN) and full vitest 210 files / 3706 tests, lint and build green:

- [x] 1. Reservas two-column layout started at 768px, leaving ~120px columns next to the ~184px sidebar; it now starts at 1024px and stacks below (5e21c47)
- [x] 2. Stray space before the colon in the Resumen reserves copy ("...07/10/2026) : una reserva..."); the colon now follows the parenthesis, asserted with a regex (65b9988, 635c584)
- [x] 3. Amounts misaligned between cards with and without a note line; `OverviewFigure` grid now uses `align-content: start` so stretched rows do not push the amount down (65b9988)
- [x] 4. HTTP 404 on `GET /finance/overview` and on reserves list/create showed "Algo salió mal"; it now says the function is not yet available on the server, with no retry button (a missing route cannot be fixed by retrying). Cancel keeps its own 404 meaning, "reserve not found" (e779c0d)

Not browser-tested:

- Create and cancel a reserve against the real backend: the running Docker image lacks the /finance/overview and /finance/reserves routes.
- Keyboard and screen-reader focus order.
- A real offline state (only simulated in jsdom).
- Layout fixes 1 and 3 are asserted on the stylesheet only (jsdom has no layout engine); they were not re-measured after the change.

## Integrated closeout IC1 (local fixes; integration still pending)

All bounded frontend fixes pass automated checks. Parent-reported real API/lab/Chrome proof is recorded below. Native review remains pending; this is not Phase4 closure. Route: delegated direct (multi-file preparation and implementation). Engram mirror remains pending and parent-owned.

| Finding | Classification and correction |
| --- | --- |
| Off-view session leak | Confirmed bug: auth boundary resets only Phase4 in-memory stores on logout/token/account/member/device replacement. Reset generations suppress late reads, writes, failures and refresh continuation. Prior IndexedDB and durable queues are untouched. |
| Coverage rounding | Confirmed bug: 101/200 displayed 51 + 50. Missing percentage now complements rounded known percentage; partial coverage never reaches 100. Exact backend percentage remains unchanged. |
| Optional partner barrier | Confirmed performance defect: overview publishes without waiting for optional summary; request guards suppress late names across periods/reset. Last confirmed same-period data remains on failed refresh. |
| Draft filters | Confirmed bug: scope/status now query the applied range, even with invalid/unapplied draft dates. Explicit Apply/presets still apply the picker. |
| Saved period | Confirmed bug: submitted canonical range is captured before await, including when period changes during receipt/list refresh. Write busy guards stay active through refresh. |
| Receipt date types | Hardening/coverage only: null/number/object/array already failed downstream validation without a runtime crash. Explicit string guards now precede calendar validation; no reproduced runtime defect is claimed. |

### Reserve monthly behavior
Only Reservas default and Este mes use full civil month: inclusive picker end via endOfMonthKey, then existing reserve serialization sends the next first day exclusively. Leap February2028 sends [2028-02-01,2028-03-01); December2026 sends [2026-12-01,2027-01-01). UTC06 midnight business-date boundaries are tested. Linked month-to-date and custom exact ranges are preserved; shared presetRange and Resumen month-to-date remain unchanged. Copy explains monthly reserves subtract only from the identical full-month overview.

### Observed automated evidence
- Baseline focused six files:126 tests passed.
- RED before implementation:18 failures/130 passes in148 tests; corrected saved-period regression independently failed with expected original period versus changed day. Non-string JSON receipt tests passed baseline (hardening, not a reproduced bug).
- GREEN final focused six files:153 tests passed, exit0 (auth18, overview15, reserves29, coverage16, view44, receipt31).
- Full npm.cmd run test:run:210 files /3733 tests passed, exit0, no retry (106.98s). This includes general overview/business-time and prior-phase regression tests.
- npm.cmd run lint:exit0; npx.cmd vue-tsc --noEmit:exit0; npm.cmd run build:exit0 (vue-tsc -b, Vite, PWA).
- Build warns about unchanged large PDF/font/Excel dependency chunks (>500kB); non-blocking. Test harness logs missing stub router paths. Neither is represented as browser/API proof.
- Touched sources/tests normalized to LF only; git diff --check:exit0. Initial unrelated CRLF-only status entries were not normalized, reset or staged.
- No backend/lab/browser/remote/commit/review work performed by this frontend writer. Service/store/view fixtures prove consumer behavior only, not live receipts or layout.

### Next action and risks
Parent completed real create/reversal/replay409 arithmetic, logout/network behavior, responsive layouts and accessibility checks. Native risk assessment/review and the final closure decision remain pending. Reserves remain online-only: uncertain failures retain retry identity in memory, reset discards that volatile attempt, and there is no offline queue or fabricated success. A request already sent before logout cannot be undone; late responses cannot repopulate another session or trigger a new-session refresh. Commit identities and native review evidence remain parent-owned.

### Live-browser follow-up: confirmation after remount
Parent observed a real successful07Oct create followed by navigation to Resumen and back via Administrar reservas: store savedName survived, but view-local savedPeriod did not, producing an empty-period confirmation. Confirmed UX bug, not theoretical. ReservesView now clears transient action messages on mount before refreshing; list/retry identities remain intact. Immediate confirmation and captured-period-during-await regressions still pass.

Observed RED: remount regression1 failed/44 passed (view45 tests), exit1. GREEN: focused six files154 passed, exit0; full suite210 files/3734 passed, exit0 (105.82s, no retry). Lint, vue-tsc --noEmit, build and diff --check all exit0. Nonblocking dependency chunk warnings unchanged. Only view/test/tracker changed for this follow-up; no commit or lab/browser interaction. Parent must rebuild/refresh the real local frontend and re-observe navigation before accepting live closure.

## Parent-reported integrated evidence (2026-10-07)

Automated implementation checks and authorized live checks are completed. These observations were supplied by the parent browser/API actors, not inferred from mocks. Native review is still pending; no Phase4 closed claim is made.

| Live check | Observed result |
| --- | --- |
| Chrome October 7 baseline (MXN) | Sales 15000, known sold cost 6000, gross margin 9000, operating expense 1500, operating result 7500. Inventory purchases 3000 and capital contributions 8000 remain separate. Four shifts, 960 known minutes and one unknown duration. |
| Reserves and reversal | Planned total 3000 then 4000 changed potentially available amount from 4500 to 3500. Reversing the bazaar reserve restored 4500; historical cancellation reason remained visible. |
| Civil month | Exact monthly [2026-10-01,2026-11-01) reserve verified; auxiliary reserve subsequently cancelled. General analysis range stayed independent. |
| Real API worker | Create201, exact replay200, changed-payload conflict409, reversal201, reversal replay200, double-reversal409. |
| UTC06 contribution boundary | Parent observed temporal deltas 33/132/165/176 minor units across the 06Z boundary. |
| Real Chrome offline | User DevTools Offline produced: "No pudimos guardar la reserva. Revisa tu conexión; si reintentas no se duplicará." Reconnection using the same form created one MXN1 auxiliary reserve, then cancelled it. |
| API unreachable | Failure followed by retry succeeded with one auxiliary reserve, subsequently cancelled. No offline queue or fabricated success. |
| Logout/account context | Loaded summary then logout/login showed no retained financial data. Normal authorized login/member context restored summary via loading state before a fresh fetch. |
| Responsive/accessibility | Parent reports the previously requested live responsive and accessibility checks verified. |

Final source verification remains focused154 tests/full3734 tests, lint, vue-tsc, build and diff checks all passing; parent independently repeated focused154. No source changes or normalization during packaging. Rollback boundaries: session cache/race behavior is confined to auth/overview/reserves stores and their tests; coverage complement is confined to its util/test; reserve period/form/receipt behavior is confined to its view/service/tests. Tracker evidence stays with the final work unit. Three local Conventional Commits are being packaged on feat/finance-overview-reserves without attribution or remote operations; the parent will record the exact three hashes after packaging (the final commit cannot contain its own hash without amendment).
