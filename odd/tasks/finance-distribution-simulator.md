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

- [ ] FS-1 Types + service (strict validation) + pure utils + fixture + tests
- [ ] FS-2 Ephemeral store (request-id guard, session reset, stale-result flag, overview pre-base) + tests
- [ ] FS-3 SimulatorView + components + Simulador tab (last) + lazy route + tab-list test updates
- [ ] FS-4 Help articles + tests
- [ ] FS-5 Verification (full vitest, lint, vue-tsc, build, diff --check)

## Route per task

Delegated direct: single bounded writer (trigger: 2+ non-trivial files per task).

## Progress / evidence

Branch `feat/finance-distribution-simulator` created from `feat/finance-overview-reserves` @ 6e71c77 (includes d4623e6, ee75323, 2f5971c, 6e71c77). Patterns followed: session-scoped store reset registered in `auth.store.ts` (`resetPhase4`), request-id + session-generation guards, complementary percent helpers.
