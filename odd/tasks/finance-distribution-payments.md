# Distribution payments frontend — Phase 6

Record real payments against the frozen participants of a distribution agreement, using the exact bazar-api contract. La Marchanta never moves money: it records what was agreed, what was actually paid and what is pending. "Agreed" is never "paid".

## Scope and constraints

- Frontend only (`bazar-frontend`); bazar-api is a read-only reference (`../bazar-api/doc/finance-distribution-payments.md`, `src/finance/finance-payments.*`).
- Base: `main` at `ac13ae6`; branch: `feat/finance-distribution-payments`. No push, merge, deploy or Cloudflare.
- Payments are online only: no offline queue, no IndexedDB, no localStorage, no optimistic totals. IndexedDB `DB_VERSION` stays 4.
- Payments are immutable and only reversible; correction is reverse (anular) then register the right payment.
- The agreement PDF, Resumen/overview, Aportaciones, Gastos, Jornadas, Reservas and the Simulador logic are NOT touched. No new Finanzas tab.
- UI lives inside Finanzas -> Acuerdos -> Detalle. Socio-only (the detail view already is).
- Planning heuristic of about 400 authored changed lines per task is advisory only.
- Phase 6 stays NOT CLOSED here: the parent runs real integration and closes it.

## Tasks

- [x] P6-F1 — Payments service, store and session reset. Types, defensive guards (`src/utils/finance-payment-guards.ts`), error mapping and money/time helpers (`src/utils/finance-payments.ts`), `FinancePaymentsService`, memory-only `finance-payments.store.ts` registered in `auth.store.ts` `resetPhase4()`. Route: delegated writer (this single frontend writer); the contract, store pattern and guards are non-trivial files in one coherent boundary.
- [ ] P6-F2 — Payments section, register dialog, history and reversal dialog inside the agreement detail, void-agreement warning, voided-agreement notice.
- [ ] P6-F3 — Help articles in Spanish and documentation (`doc/finance-architecture.md`, `doc/finance-distribution-agreements.md`).

## Verification

Vitest + Vue Test Utils, meaningful deterministic RED before GREEN for behavior. Full `npx vitest run`, `npm run lint`, `npx vue-tsc -b`, `npm run build`, `git diff --check` at closure. Real browser/backend integration is the parent's job.

## Evidence and next step

- P6-F1 RED observed: the service test and the store test were run before any implementation existed and failed with `Failed to resolve import` (module missing). After implementation: service 49 tests, store 41 tests, utils 21 tests, auth store reset test GREEN.
- Deviation: `src/services/finance-agreements.service.ts` is outside the allowed edit surface, so `validAgreement` keeps ignoring the optional `paymentSummary` of the agreement detail. The view validates it separately (`validPaymentSummary`) before using it and prefers the summary returned by `GET .../payments`.
