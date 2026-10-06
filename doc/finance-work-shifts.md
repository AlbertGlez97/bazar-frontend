# Work shifts (Jornadas) offline contract

Finanzas > Jornadas records real work: which member worked on which calendar day and, when known, for how long. A work shift is never a sale, a payment, a salary, a commission or a distribution. The screen shows no money, percentages or "what you get".

The API contract lives in `bazar-api` (`src/finance/work-shift*.ts`, `odd/tasks/finance-work-shifts.md`); this file covers the frontend behavior. Corrections (annul or replace) are NOT implemented: the reversal endpoint and receipt shapes are not part of this slice.

## Durable operations

IndexedDB `la-marchanta` is now version 4. The upgrade is idempotent (each store is created only if missing) and adds `pending-work-shifts` and `work-shift-history`, both with keyPath `key`. All seven previous stores and their data are preserved on every upgrade path (v0 to v3 to v4). `finance-references` (the member list, including inactive members) is shared with Contributions and Expenses.

The Expenses rules apply unchanged:

- Persist first, then show success. A failed IndexedDB write is a failed registration and the typed data stays in the form.
- Records are scoped by account + API base; the originating member, device and UUID v7 are frozen with the operation. Another account, API or device never sees or sends it.
- Only `kind: create` is queued. Re-enqueueing the same UUID with the same content is an idempotent replay; different content, or an already confirmed UUID, is refused.
- Exact acknowledgements: the receipt must match id, member, work date, minutes, note, recorder, device and account, and must carry `warnings`. A malformed or mismatching 2xx stays uncertain and the payload is retried unchanged. History insertion and pending deletion share one transaction.
- Corrupt rows are skipped, never sent or deleted. Sync uses `navigator.locks` (`marchanta-work-shifts:<scope>`), bounded exponential backoff (30 s to 5 minutes), 401/403 pause for an explicit retry and other 4xx (except 408/429) need review.
- `AppLayout` starts, stops and re-scopes the work shifts scheduler together with the sales, contributions and expenses queues.

## Data rules

- `workDate` is a calendar date `YYYY-MM-DD` with no time zone. It is never converted from or to an instant; list and summary use `from` inclusive and `to` exclusive (`to` = the day after the last day shown). The form refuses a future date (UI guard only; the API does not).
- `minutes` is a positive integer or `null` (unknown). Hours and Minutes are two whole-number inputs; both empty means unknown (`null`, never 0). Minutes are `hours * 60 + minutes` with integers only; the minutes field is 0 to 59, the total is at least 1 and at most 2147483647. Decimals, negatives and non-numeric text are rejected.
- `note` is optional, trimmed, at most 1000 characters; empty is `null`.
- The `MULTIPLE_SHIFTS_SAME_DAY` warning is shown only when it comes from the stored creation receipt. List items never carry it, so merging a list never drops or recomputes it.
- The list item exposes `reversal` (read-only). A shift with a reversal is shown as Anulada (no replacement) or Corregida (with replacement) and is excluded from the local summary, as the server excludes it from the server summary.

## Screen

Restricted to socios in Gestion (route `/app/finanzas/jornadas`, `requiresSocio` + `requiresGestion`, lazy view). Finanzas shows an `Aportaciones | Gastos | Jornadas` tab navigation.

- Form: Quien trabajo (active members), Fecha, Duracion (two integer fields, optional) and Nota (optional).
- List: one card per shift (works on phones, no wide table) with member, date, duration (`8 h`, `8 h 30 min`, `45 min` or `Duracion no registrada`), note, sync state (Pendiente, Sincronizada, Requiere revision, En pausa) and Anulada/Corregida when the list says so. Blocked records offer an explicit retry with the original origin.
- Filters: period (shared `ReportRangePicker`) and member, sent to the API and applied to the local list.
- Summary: per member `N jornadas · X registradas · Z sin duracion`, with totals. Server figures from `GET /finance/work-shifts/summary` when online and matching the period and member; otherwise local figures from this device's records, labeled as possibly incomplete, and none when a record in the period needs review or is paused. Hours add only recorded durations; shifts without duration are counted apart and never assumed.
- Help: two `Finanzas` articles (what a shift is and how to register it; a short FAQ: shift without hours, shift vs sale, a shift is not a payment, correcting is not available yet).

Automated component tests are not a substitute for visual browser verification.
