# Work shift reversal UI (post-closure gap)

Gap de UI detectado post-cierre de Fase 3 y corregido antes de Fase 6. This does not reopen Phase 3.

## Objective
Let a socio void ("Anular") or correct ("Corregir") a work shift from Jornadas, using the existing backend contract (`POST /api/v1/finance/work-shifts/:id/reversals`, optional `replacement`). Follow the Expenses reversal pattern, including the offline durable queue (`kind: 'reverse'`). Frontend only; backend changes only if an incompatibility is proven.

## Scope
- Branch `fix/work-shift-reversal-ui` from main (0d7f915), frontend only.
- Out of scope: backend, payments, agreements, simulator, Phase 6, deploy, Cloudflare.

## Backend contract (verified in `bazar-api/doc/finance-work-shifts.md`)
- Socio only. Body: new UUIDv7 `id`, `reason` (nonblank, max 1000), zoned `occurredAt`, `createdByMemberId`, `deviceId`, optional `replacement` (full creation payload, new UUIDv7, all identities distinct).
- 201 first, 200 identical replay, 409 changed content/already reversed/used identity, 404 unknown or foreign original, 403 unauthorized replacement worker (atomic).
- Receipt: reversal + `original` + nullable `replacement`.

## Tasks
- [x] WR1 Types, records, IndexedDB queue support for work shift reversals (mirror expenses)
- [x] WR2 Service + sync + store (void, correct, dependency on pending original, replay)
- [x] WR3 View: Anular / Corregir actions, dialogs, states, permissions, summary refresh (jsdom-tested; real browser pending in WR6)
- [x] WR4 Help articles + docs
- [x] WR5 Automated tests (void, correct, offline, permissions, regression)
- [x] WR6 Real browser validation (cases A, B, C), responsive and accessibility
- [ ] WR7 Integration to main and push

## Route
Delegated direct: one writer (2+ non-trivial files). Parent runs the verification and the real browser tests.

## Progress / evidence
- Commits on `fix/work-shift-reversal-ui` (WR1, WR2): `eacd2f8 feat(finance): queue work shift reversals offline`; (WR3): `9b72a32 feat(finance): add work shift void and correction actions`; (WR4, tracker): the final `docs(finance): ...` commit (see `git log --oneline main..HEAD`). WR5 tests ship inside those commits, next to the behavior.
- Design decisions:
  - IndexedDB stays at v4: `pending-work-shifts` is keyed by `key` and already stores heterogeneous operations, so only the row validation (`wellFormedPending`) learned `kind: 'reverse'` (with `workShiftId`). No store or index change was needed.
  - Same pattern as Expenses: `enqueueWorkShift` requires the original in local history or as a queued creation, refuses a second reversal, and checks recorder/device of the reversal and of its replacement; `syncWorkShifts` sends creates before reversals and a reversal waits while its creation is still pending (`needs_review` if that creation needs review or is paused); `confirmWorkShift` writes original (with `reversal` marker), replacement and the pending deletion in one transaction.
  - The backend replacement DTO is the creation DTO (`note` allowed), so the correction form offers the note.
  - Beyond Expenses: trimmed reason; specific Spanish messages for 403/404/409 on reversals; the queued replacement is shown as a Pendiente row and counted in the local summary; the server-summary note counts queued corrections.
  - Expenses does not block a no-op correction, so neither does Jornadas.
  - `formFromRow` lives in the view because `src/utils` was outside the allowed edit surface for this task.
- Existing tests touched: `work-shift-db.test.ts` (payload narrowing for the new union), `WorkShiftsView.test.ts` (the "no controls yet" assertion now only applies to reversed rows), `help-content.test.ts` (the old "not available yet" expectations). IndexedDB upgrade tests untouched.
- New tests: `work-shift-reversal.test.ts` (queue, dependency, order, replay, scope, uncertain receipts, 403/404/409), `WorkShiftsView.reversal.test.ts` (visibility, permissions, void, correct, states, summary, focus/Escape), store tests in `work-shifts.store.test.ts`, help expectations.
- Verification (this writer, foreground): `npx vitest run` 226 files / 4104 tests passed; `npm run lint` clean; `npx vue-tsc -b` clean; `npm run build` built.
- Not done by this writer: real browser validation (WR6) and integration/push (WR7).

- Real browser validation (parent, Chrome, isolated local stack bazar-dev-local, socio session started by the user): A) created 8 h, empty reason blocked (native required), Escape closed the dialog and returned focus to Anular, void with reason showed Anulada + reason, summary 0, original kept, no buttons on the reversed row. B) created 8 h, corrected to 6 h: original Corregida with reason, replacement active, summary 1 jornada / 6 h. Database confirmed: void without replacement; original reversed with replacement; replacement 360 min active. Responsive: no horizontal overflow and dialog inside viewport at 320/390/768 (same-origin iframes, Escape closes); 320 px dialog scrolls internally with actions visible. C) API container stopped (real network failure; navigator.onLine stayed true, DevTools Offline mode was not toggled): offline void of a synced shift, offline create + correction of a still pending shift; queue survived a reload; after restart the void synced, the create waited for its retry backoff, then create and reversal+replacement synced in order with no duplicates (5 shift rows, 0 pending, summary 1 / 3 h).
- Observations: the success banner after an online void reads "guardada en este dispositivo ... se sincronizará" (same wording pattern as creation; not changed). A collaborator session was not exercised in the browser (covered by jsdom tests; backend enforces 403).
