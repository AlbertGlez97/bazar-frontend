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
- [ ] FR1/FR2 Reserves CRUD — BLOCKED on backend (no endpoints exist)

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
