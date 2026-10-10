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
- [x] P6-F2 — Payments section (`AgreementPayments.vue`), register dialog (`AgreementPaymentForm.vue`), history with ANULADO, reversal dialog (`AgreementPaymentReverseForm.vue`) inside the agreement detail, void-agreement payments warning, voided-agreement notice. Route: delegated (same single writer); several non-trivial Vue files plus tests.
- [x] P6-F3 — Help articles in Spanish (`pagos-acuerdo`, `pagos-preguntas`, plus corrected agreement articles that said payments do not exist) and documentation (`doc/finance-architecture.md`, `doc/finance-distribution-agreements.md`). Route: inline-sized content by the same writer; the Phase 6 row stays NOT CLOSED.

## Verification

Vitest + Vue Test Utils, meaningful deterministic RED before GREEN for behavior. Full `npx vitest run`, `npm run lint`, `npx vue-tsc -b`, `npm run build`, `git diff --check` at closure. Real browser/backend integration is the parent's job.

## Evidence and next step

- P6-F1 RED observed: the service test and the store test were run before any implementation existed and failed with `Failed to resolve import` (module missing). After implementation: service 49 tests, store 41 tests, utils 31 tests, auth store reset test GREEN.
- Deviation: `src/services/finance-agreements.service.ts` is outside the allowed edit surface, so `validAgreement` keeps ignoring the optional `paymentSummary` of the agreement detail. The view validates it separately (`validPaymentSummary`) before using it and prefers the summary returned by `GET .../payments`.
- P6-F2 tests: 33 view/component tests (summary per participant unpaid/partial/paid/not due, separate agreement badge, dialog prefill, Usar pendiente, validation, backend overpayment numbers, uncertain retry, history/ANULADO, reverse, voided agreement, void warning, collaborator/403/401, offline, focus/Escape/Tab) plus 4 regression tests (DB_VERSION 4, PDF definition identical with paymentSummary, no storage APIs in payment modules). The UI tests were written after the components, so no RED was observed for them; instead two deliberate mutations (drop the overpayment check, show the register button on voided agreements) were applied and made 2 tests fail, then reverted.
- Void warning source: the live `GET .../payments` summary, falling back to a validated `paymentSummary` of the agreement detail; when neither is available the void dialog says it could not check for payments.
- Verification (writer, before handing over to the parent): `npx vitest run` 231 files / 4270 tests passed (baseline on main was 226 files / 4104 tests); `npm run lint` 0 problems; `npx vue-tsc -b` clean; `npm run build` built with the existing chunk-size warning; `git diff --check` clean.
- Not verified here (jsdom only, no browser, no dev server, no real backend): real payments against bazar-api, datetime-local input behavior across browsers, real focus trap/Escape in a browser, layout at 320/390/768/1280, clock-skew 422 handling against a real server, tenant isolation. The parent runs these; Phase 6 stays NOT CLOSED.
- Bug found in real browser integration (two devices): a dialog opened with stale pending kept stale Ya pagado/Pendiente after a server 422 FINANCE_PAYMENT_EXCEEDS_PENDING, and the page kept the Registrar pago buttons after a 409 FINANCE_PAYMENT_AGREEMENT_VOIDED. Fixed in `61a5ed1`: after a definitive rejection that proves the snapshot stale (EXCEEDS_PENDING, AGREEMENT_VOIDED, ALREADY_VOIDED, 404) the store reloads the payments list and bumps `staleRefreshes` so the section re-reads the agreement detail; the error stays visible, the attempt id is discarded, the dialog header follows the refreshed summary and the register dialog closes when the agreement turns voided. Uncertain outcomes (network, 5xx, 408/429, malformed) never refresh and keep the exact attempt. RED observed: 13 new tests failed without the fix; after it the full suite is 231 files / 4289 tests, lint, vue-tsc and build clean.

## Real integration (parent, Chrome, isolated stack with the Phase 6 backend)
Full flows verified: partial and total payments, "Usar pendiente completo" (fills only, never submits), client and server overpayment rejection, payment reversal and corrected payment, two tabs as two devices (201 and 422), payment against an agreement voided elsewhere (server 409), voided agreement notice with history kept, overview unchanged, offline blocked with nothing stored (and API stopped for real: unconfirmed payment, one same-attempt retry, no duplicate), 320/390/768 without overflow, real keyboard focus trap and Escape. The stale-snapshot fix (61a5ed1) was re-verified in the browser. Details and the list of what was only covered by automated suites are in bazar-api odd/tasks/finance-distribution-payments.md.
