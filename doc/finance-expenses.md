# Expenses offline contract

Finanzas > Gastos records money spent for the business: operating expenses and inventory purchases, who paid and whether the money came from the business or from a person's own pocket. An expense is a financial fact only. It is not a contribution, it never changes products, stock or purchase cost, it does not alter sales or report totals, and the screen shows no profit, balance, distribution or recommendations.

The API contract is documented in `bazar-api/doc/finance-expenses.md`; this file covers the frontend behavior.

## Durable operations

IndexedDB `la-marchanta` is now version 3. The upgrade is idempotent (each store is created only if missing) and adds `pending-expenses` and `expense-history`, both with keyPath `key`. All five previous stores (`pending-sales`, `catalog-snapshot`, `pending-contributions`, `contribution-history`, `finance-references`) and their data are preserved on every upgrade path (v0/v1/v2 to v3). `finance-references` (the member list, including inactive members) is shared with Contributions.

The same rules as Contributions apply:

- Persist first, then show success. A failed IndexedDB write is a failed registration, the typed data stays in the form and no fake pending row appears. A committed write stays successful if the later list readback fails (a visible warning is shown).
- Records are scoped by account + API base. The frozen originating member, device and UUID v7 are stored with the operation; tokens are never stored. Another account, API or device never sends or sees the operation, and a shared-account member change keeps the original attribution headers.
- Exact acknowledgements are required. The receipt must match id, amount, instant, nature, category, description, payer, funds source, creator, device and account; nature/category pairing, currency (MXN), integer amounts and UUIDs are validated. A malformed or mismatching 2xx stays uncertain and the payload is retried unchanged. History insertion and pending deletion share one transaction, and replaying a creation receipt never drops known reversal metadata.
- Corrupt rows in either store are skipped when reading (never sent, never deleted), so one bad record cannot hide the others.
- Creates are sent before reversals, under `navigator.locks` (`marchanta-expenses:<scope>`) when available. Transient/uncertain failures use bounded exponential backoff (30s to 5 minutes), 401/403 pause for explicit recovery, and other 4xx responses except 408/429 need review. Nothing is silently discarded.
- Shared helpers (`finance-shared.ts`: receipt primitives, backoff, failure classification, scoped keys) are used by both Contributions and Expenses.
- `/api/v1/finance/` is already excluded from generic Workbox caching.

The authenticated shell (`AppLayout`) starts, stops and re-scopes the expenses scheduler independently of the sales and contributions queues.

## Corrections

Original values are immutable. A reversal carries a reason and an optional full replacement expense with its own UUID; it is one server operation, never an independent replacement POST. A pending original can have a dependent reversal queued, and the original must be confirmed first. An expense with a reversal or a queued correction cannot be corrected again. Annulling or correcting is not a cash movement and moves no inventory. The payer of a replacement must be an active member.

## Screen

Restricted to socios in Gestion (route `/app/finanzas/gastos`, `requiresSocio` + `requiresGestion`, lazy view). Finanzas shows an `Aportaciones | Gastos` tab navigation.

- Form: Tipo (Gasto operativo or Compra de inventario), Categoria (the 11 operating categories; an inventory purchase forces Inventario), Importe (integer minor units parsed with the shared money parser, never floats, 1 to 2147483647), Fecha (business day at UTC-6 midnight), Pagado por (active members), Origen del dinero (Negocio or Personal, chosen explicitly) and Descripcion (1 to 280 characters, trimmed).
- List: date, amount, type, category, payer (historical members keep their name), funds origin, state and a shortened description. States: Pendiente, Sincronizado, Requiere revision, En pausa, plus Anulado/Corregido with the reason. Blocked records offer an explicit retry with the original origin.
- Filters: period (shared `ReportRangePicker`, inclusive dates, exclusive next-day end), category, type and payer. They are sent to the API and also applied to the local list.
- Summary (Gastos operativos, Compras de inventario, Pagado con dinero personal, Pagado con fondos del negocio): server figures from `GET /finance/expenses/summary` when online and matching the period. Otherwise local figures from this device's records (annulled and queued-correction expenses excluded), labeled as possibly incomplete, and only when no record in the period needs review or is paused; if any does, no totals are shown.
- Help: two `Finanzas` articles in the help center (what an expense is, operating vs inventory purchase, the funds origin, why personal money is not a contribution, and annul/correct).

Automated component tests are not a substitute for visual browser verification.
