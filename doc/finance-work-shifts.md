# Work shifts (Jornadas) offline contract

Finanzas > Jornadas records real work: which member worked on which calendar day and, when known, for how long. A work shift is never a sale, a payment, a salary, a commission or a distribution. The screen shows no money, percentages or "what you get".

The API contract lives in `bazar-api` (`src/finance/work-shift*.ts`, `odd/tasks/finance-work-shifts.md`); this file covers the frontend behavior. Annulling ("Anular") and correcting ("Corregir") a shift use `POST /finance/work-shifts/:id/reversals`, with the same offline durable queue as Gastos (`kind: reverse`). Gap de UI detectado post-cierre de Fase 3 y corregido antes de Fase 6.

## Durable operations

IndexedDB `la-marchanta` is now version 4. The upgrade is idempotent (each store is created only if missing) and adds `pending-work-shifts` and `work-shift-history`, both with keyPath `key`. All seven previous stores and their data are preserved on every upgrade path (v0 to v3 to v4). `finance-references` (the member list, including inactive members) is shared with Contributions and Expenses.

The Expenses rules apply unchanged:

- Persist first, then show success. A failed IndexedDB write is a failed registration and the typed data stays in the form.
- Records are scoped by account + API base; the originating member, device and UUID v7 are frozen with the operation. Another account, API or device never sees or sends it.
- Two kinds are queued: `create` and `reverse` (see "Annulment and correction"). Re-enqueueing the same UUID with the same content is an idempotent replay; different content, or an already confirmed UUID, is refused.
- Exact acknowledgements: the receipt must match id, member, work date, minutes, note, recorder, device and account, and must carry `warnings`. A malformed or mismatching 2xx stays uncertain and the payload is retried unchanged. History insertion and pending deletion share one transaction.
- Corrupt rows are skipped, never sent or deleted. Sync uses `navigator.locks` (`marchanta-work-shifts:<scope>`), bounded exponential backoff (30 s to 5 minutes), 401/403 pause for an explicit retry and other 4xx (except 408/429) need review.
- `AppLayout` starts, stops and re-scopes the work shifts scheduler together with the sales, contributions and expenses queues.

## Data rules

- `workDate` is a calendar date `YYYY-MM-DD` with no time zone. It is never converted from or to an instant; list and summary use `from` inclusive and `to` exclusive (`to` = the day after the last day shown). The form accepts any valid calendar date, including a future one (the API imposes no such rule).
- `minutes` is a positive integer or `null` (unknown). Hours and Minutes are two whole-number inputs; both empty means unknown (`null`, never 0). Minutes are `hours * 60 + minutes` with integers only; the minutes field is 0 to 59, the total is at least 1 and at most 2147483647. Decimals, negatives and non-numeric text are rejected.
- `note` is optional, trimmed, at most 1000 characters; empty is `null`.
- The `MULTIPLE_SHIFTS_SAME_DAY` warning is shown only when it comes from the stored creation receipt. List items never carry it, so merging a list never drops or recomputes it.
- The list item exposes `reversal` (id, replacement id and, from the list, the reason). A shift with a reversal is shown as Anulada (no replacement) or Corregida (with replacement) with its Motivo, and is excluded from the local summary, as the server excludes it from the server summary.

## Annulment and correction

A shift is never edited or deleted. A socio annuls it (reversal without replacement) or corrects it (reversal with a replacement shift) from the list; collaborators never reach the screen and the backend answers 403 to them anyway.

- Body: `{ id, reason, occurredAt, createdByMemberId, deviceId, replacement? }`. `id` and the replacement `id` are fresh UUID v7 values, all different from the original. `reason` is trimmed, nonblank, at most 1000 characters. `occurredAt` is an instant with zone (`toISOString()`). `replacement` is a full creation payload (`memberId`, `workDate`, `minutes`, `note`, recorder, device); the backend DTO for the replacement is the creation DTO, so the note is editable in the correction form. Minutes follow the creation rules (empty = `null`, never 0).
- Eligibility (`canAct`): the row is not reversed (Anulada/Corregida), has no queued reversal, is not itself the queued replacement of a correction, and is either confirmed or a still-`pending` queued creation. A creation that needs review or is paused offers no action.
- Durable queue: `enqueueWorkShift` stores `{ kind: 'reverse', workShiftId, payload }` in the existing `pending-work-shifts` store (keyPath `key`, scoped by account + API base). The IndexedDB version stays at 4: the store shape already holds it, only the row validation accepts the new kind. The original must be in the local history or be a queued creation; a second reversal for the same shift is refused; the recorder and device of the reversal and of its replacement must match the origin.
- Order and dependency: sync sends every `create` before any `reverse`. A reversal whose original is not yet confirmed locally waits; if that creation needs review or is paused, the reversal moves to `needs_review` and is never sent.
- Exact acknowledgement: the reversal receipt must match reversal id, original id, reason, recorder, device, account, instant and context; the `original` must match the stored shift; a replacement must match the queued payload (and be absent for an annulment). Anything else stays uncertain and the same payload is retried. A 200 replay is accepted like a 201. Confirmation writes the original (with its `reversal` marker), the replacement and the deletion of the pending record in one transaction.
- Failures: 403 pauses (not authorized, for example an inactive replacement worker; nothing was saved), 404 and 409 need review (original unknown, already reversed, or content changed), each with a specific Spanish message on the row, plus Reintentar corrección. Network and 5xx failures retry with the same ids.
- Summary and list: while a reversal is queued the original is out of the local summary and the queued replacement is counted; the server note says how many records are not included yet. After a sync that confirmed work, the store re-reads local history and the summary for the period on screen, so no reload is needed. There is no status filter in the UI: voided, corrected and active records are all listed.
- States: Pendiente, Sincronizada, En pausa, Requiere revisión, Anulada, Corregida. Queued reversals show "Anulación/Corrección pendiente" or "requiere revisión" on the original, and the replacement shows as a Pendiente row until confirmed.
- Dialog: reuses `AppModal` with `manage-focus` (focus trap, Escape closes, focus returns to the trigger button, `role="alert"` for errors).

## Screen

Restricted to socios in Gestion (route `/app/finanzas/jornadas`, `requiresSocio` + `requiresGestion`, lazy view). Finanzas shows an `Aportaciones | Gastos | Jornadas` tab navigation.

- Form: Quien trabajo (active members), Fecha, Duracion (two integer fields, optional) and Nota (optional).
- List: one card per shift (works on phones, no wide table) with member, date, duration (`8 h`, `8 h 30 min`, `45 min` or `Duracion no registrada`), note, sync state (Pendiente, Sincronizada, Requiere revision, En pausa) and Anulada/Corregida when the list says so. Rows that are not reversed offer Corregir and Anular to socios. Blocked records offer an explicit retry with the original origin.
- Filters: period (shared `ReportRangePicker`) and member, sent to the API and applied to the local list.
- Summary: per member `N jornadas · X registradas · Z sin duracion`, with totals. Server figures from `GET /finance/work-shifts/summary` when online and matching the period and member; otherwise local figures from this device's records, labeled as possibly incomplete, and none when a record in the period needs review or is paused. Hours add only recorded durations; shifts without duration are counted apart and never assumed.
- Help: two `Finanzas` articles (what a shift is and how to register it; a short FAQ: shift without hours, shift vs sale, a shift is not a payment, how to void and correct, why a shift is not edited, what happens to the original, offline behavior and who can do it).

Automated component tests are not a substitute for visual browser verification.
