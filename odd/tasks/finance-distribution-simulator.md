# Finance distribution simulator (Simulador) — frontend

## Objective

Add a "Simulador" tab to Finanzas: an online, pure simulation of how an amount of the period's potentially available money WOULD be split between members, using `POST /api/v1/finance/distribution-simulations`. It records nothing and is never a payment, withdrawal or obligation.

## Scope

- In: types, service, pure utils, in-memory Pinia store, `SimulatorView` at `/app/finanzas/simulador`, last Finanzas tab, help articles, tests.
- Pre-base ("Monto potencialmente disponible") is read from the existing `GET /finance/overview` through the existing service, in the new store (isolated; the Resumen store is never touched).
- Out: persistence/history of simulations, payments, withdrawals, capital recovery, custom partner weights, hourly rates, offline mode, decimal percentages.

## Constraints

- Source of truth: `bazar-api/doc/finance-distribution-simulator.md` and `src/finance/finance-distribution.{dto,service,controller}.ts` (re-read; they match the brief, no contract diff).
- Query `[from,to)` with `to` EXCLUSIVE: the picker's inclusive end is sent as `addDaysToKey(pickerTo, 1)`.
- Money is integer MXN cents and is NEVER recomputed on the client; percentages are integers and convert to bps as `percent * 100`.
- Result lives only in memory, resets with the session (same reset hook as the Phase 4 stores).
- No push, merge or deploy. Conventional Commits only. Advisory heuristic: ~400 authored changed lines per task.

## Tasks

- [x] FS-1 Types + service (strict validation) + pure utils + fixture + tests (5296dad)
- [x] FS-2 Ephemeral store (request-id guard, session reset, stale-result flag, overview pre-base) + tests (c076236)
- [x] FS-3 SimulatorView + components + Simulador tab (last) + lazy route + tab-list test updates (3608af1)
- [x] FS-4 Help articles + tests (5bd7e1d)
- [x] FS-5 Verification (full vitest, lint, vue-tsc, build, diff --check)

## Route per task

Delegated direct: single bounded writer (trigger: 2+ non-trivial files per task).

## Progress / evidence

Branch `feat/finance-distribution-simulator` created from `feat/finance-overview-reserves` @ 6e71c77 (includes d4623e6, ee75323, 2f5971c, 6e71c77). Patterns followed: session-scoped store reset registered in `auth.store.ts` (`resetPhase4`), request-id guards, complementary percent helpers.

Baseline before changes: full vitest 210 files / 3734 tests; 3 router tests timed out in the cold run (router.binding, router.mode-landing, router.test) and passed on re-run alone (117 tests), so they are a load flake.

FS-1 observed: service (25 tests) and utils (37 tests) passed, eslint clean. The strict validator rejects `persisted:true`, `simulation:false`, unknown role/status/basis/partnerMode, bps not summing to 10000, fractional or negative money and inconsistent sums (sanity only; money is never recomputed). `mockRejectedValue` misbehaved after `mockReset` in this vitest version, so the failure test uses `mockRejectedValueOnce`.

FS-2 observed: store tests (request-id guards for base and simulation, reset ignoring late responses, no persistence) plus an auth.store test; `resetPhase4` in `auth.store.ts` now also resets the simulator store (logout, token, account, apiBase, member and device changes). `npx vitest run src/stores` 23 files / 434 tests passed.

FS-3 observed: route `/app/finanzas/simulador` (name FinanceSimulator, lazy, socio + gestion), tab Simulador last; in-view guard shows the access message; components SimulatorRuleForm (rule + work basis steps) and SimulatorMemberResult (one card per member). The result restores its inputs when the view is re-opened in the same session (the store keeps it in memory). Tab-list assertions updated in Contributions, Expenses, WorkShifts, Overview, Reserves and finance-route tests. `npx vitest run src/views/finance src/router src/stores` 35 files / 791 tests passed; eslint and vue-tsc -b clean.

FS-4 observed: help articles `simulador-reparto` (guide) and `simulador-preguntas` (8 questions); `npx vitest run src/config src/views/help` 11 files / 343 tests passed.

FS-5 observed: `npx vitest run` 214 files / 3875 tests passed; `npm run lint` clean; `npx vue-tsc -b` clean; `npm run build` OK; `git diff --check` clean.

Limitations: integer percentages only; the pre-base comes from the overview endpoint; the UI amount cap is a convenience (the server decides); no browser/viewport validation yet (jsdom cannot measure layout); CashInput cannot receive `aria-describedby`, so the maximum hint is visible text next to it.
