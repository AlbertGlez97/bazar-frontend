# Finanzas frontend: architecture and status through Phase 6

Entry point for the Finanzas screens. Per-feature details live in the linked documents. The backend contract lives in `../bazar-api/doc/finance-architecture.md`.

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Aportaciones | CLOSED |
| 2 | Gastos | CLOSED |
| 3 | Jornadas | CLOSED. Gap de UI detectado post-cierre de Fase 3 y corregido antes de Fase 6: Anular y Corregir jornadas (ver `finance-work-shifts.md`). Esto no reabre la Fase 3. |
| 4 | Resumen operativo + Reservas | CLOSED |
| 5 | Simulador | CLOSED |
| 5.5 | Acuerdos + PDF | CLOSED |
| 6 | Pagos reales de acuerdos (inside the agreement detail, online only) | CLOSED |

Future improvements, not blocking: attach or retain a signed or scanned PDF, and payment receipts.

## Routes and tabs

Finanzas lives in Gestión, so it is socio-only and recommended on a laptop (phones work, with the existing Gestión warning). The tabs are defined in `src/views/finance/finance-tabs.ts` and the routes in `src/router/index.ts`.

| Tab | Route | View | Store | Service |
| --- | --- | --- | --- | --- |
| Resumen | `/app/finanzas/resumen` | `OverviewView` | `finance-overview.store` | `finance-overview.service` |
| Aportaciones | `/app/finanzas` | `ContributionsView` | `contributions.store` | `contributions.service`, `-sync`, `-db` |
| Gastos | `/app/finanzas/gastos` | `ExpensesView` | `expenses.store` | `expenses.service`, `expense-sync`, `expense-db` |
| Jornadas | `/app/finanzas/jornadas` | `WorkShiftsView` | `work-shifts.store` | `work-shifts.service`, `work-shift-sync`, `work-shift-db` |
| Reservas | `/app/finanzas/reservas` | `ReservesView` | `finance-reserves.store` | `finance-reserves.service` |
| Simulador | `/app/finanzas/simulador` | `SimulatorView` | `finance-distribution.store` | `finance-distribution.service` |
| Acuerdos | `/app/finanzas/acuerdos` and `/app/finanzas/acuerdos/:id` | `AgreementsView`, `AgreementDetailView` (with the Pagos section: `AgreementPayments`, `AgreementPaymentForm`, `AgreementPaymentReverseForm`) | `finance-agreements.store`, `finance-payments.store` | `finance-agreements.service`, `finance-payments.service`, `agreement-pdf` |

Payments have no tab of their own: they live in the Pagos section of the agreement detail.

## Offline versus online

| Module | Behavior |
| --- | --- |
| Aportaciones | Offline durable: persist to IndexedDB first, then sync idempotently by client UUIDv7 |
| Gastos | Offline durable, same pattern |
| Jornadas | Offline durable, same pattern, including queued annulments and corrections (`kind: reverse`), like Gastos |
| Resumen | Online only; shows server-confirmed data and does not include local pending records |
| Reservas | Online only; uncertain create or cancel keeps its identity for an exact retry |
| Simulador | Ephemeral and online; nothing is persisted and results are never stored |
| Acuerdos | Persisted in the backend, online only; no offline queue and no automatic sends |
| Pagos de acuerdos | Persisted in the backend, online only. Registering or reversing offline shows "Necesitas conexión para registrar un pago." (or the reversal equivalent); nothing is sent, queued or stored, and totals are never computed optimistically |

## IndexedDB

Database `la-marchanta`, version 4 (unchanged by the work shift reversal UI: `pending-work-shifts` already holds `kind: reverse` records) (`DB_VERSION` in `src/services/local-db.ts`). Stores added per phase: contributions v2 (`pending-contributions`, `contribution-history`, `finance-references`), expenses v3 (`pending-expenses`, `expense-history`), work shifts v4 (`pending-work-shifts`, `work-shift-history`). Phases 4, 5, 5.5 and 6 added no stores (payments never touch IndexedDB or localStorage). See `finance-contributions.md`, `finance-expenses.md` and `finance-work-shifts.md`.

## Session and ownership

Reserves, overview, simulator, agreements and payments keep their state in memory only. `auth.store.ts` `resetPhase4()` clears it on logout or when the account, API, member, device or token changes, and late replies from a previous session are ignored. Offline records keep the account, API, member and device origin of the session that created them and replay under that origin, never under a new session.

## Simulator and agreements

The Simulador asks the backend to calculate a distribution and displays it; the backend contract is `../bazar-api/doc/finance-distribution-simulator.md`. Confirming a result creates an immutable agreement through `finance-agreements.service` and requires a title and explicit confirmation. Drift between the simulation and the backend blocks confirmation. Voiding requires a reason, and a replacement is created from a new simulation. Details are in `finance-distribution-agreements.md`, with the closing evidence in `finance-distribution-agreements-close.md`.

## Payments (Phase 6)

A payment records that money was really paid, outside the system, to one frozen participant of an agreement. La Marchanta does not move money: it shows what was agreed, what was paid and what is pending, and "agreed" is never "paid". Payments are immutable and only reversible (anular); a mistake is fixed by reversing and registering the right payment. They are socio-only, online only, and use their own memory-only `finance-payments.store`, registered in `resetPhase4()`. Payments do not touch Resumen, Aportaciones, Gastos, Jornadas, Reservas, the Simulador, or the agreement PDF. See `finance-distribution-agreements.md` (Payments) and `../bazar-api/doc/finance-distribution-payments.md`.

## PDF

`agreement-pdf.ts` builds an A4 document with pdfmake, loaded on demand. It is generated only when the user asks and always from freshly read authoritative detail. The download is a temporary Blob; the PDF is not persisted in the frontend or the backend. It carries the folio, frozen participants and amounts, the snapshot fingerprint as an integrity code, and blank signature spaces. It is not a digital signature or a legal contract.

## Help

In-app articles (`src/config/help-content.ts`, category Finanzas) cover Gastos, Jornadas, Resumen, Reservas and Simulador, including how to create an agreement and how to register, annul and understand payments of an agreement.

## Known limitations

- Agreements, payments and the simulator are not available offline.
- The payments list is unpaginated by design; it grows with corrections (annul, then register again).
- After a server rejection that proves the local snapshot is stale (overpayment, voided agreement or payment), the screen reloads the agreement and payments from the server; uncertain failures keep the exact attempt for a manual retry.

## What does not exist

Withdrawals, executed distributions, payment methods, payment receipts or PDFs, bank or cash reconciliation, an offline queue for payments, atomic replacement of a payment, digital signature, and stored signed or scanned PDFs.
