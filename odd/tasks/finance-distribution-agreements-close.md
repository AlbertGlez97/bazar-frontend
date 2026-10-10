# Phase 5.5 integrated closure

Verify real API/browser distribution agreements and snapshot PDFs. Close only after observed integrated criteria and final automated checks pass; no Phase 6.

## Authorization and boundaries

- Backend branch `feat/finance-distribution-agreements` starts at `71ee47f`, base simulator `0eb798f`; frontend same branch starts at `265c5fd`, base simulator `b04fba4`.
- Preserve frontend pre-existing overview/reserves fixture/type edits and temporary QA artifacts. Backend starts clean.
- No push, merge, rebase, squash, public deploy, Cloudflare changes, payments, digital signatures or unrelated features.
- Use separate local Docker project/loopback ports 8081/3101/new volumes and copied lab database; do not rebuild existing tunnel-connected stack or remove existing volumes.
- Empty migration verification uses an explicitly isolated temporary database and `prisma migrate deploy`, not SQL-only evidence.
- Product decision: create replay reflects current derived voided/reversal/replacement state, without changing stored snapshot/hash.
- Reversal timestamps must be at least original occurredAt and no later than server-authoritative permitted time. No shared future tolerance was found; use an explicit conservative server-time upper bound unless current evidence establishes a different policy.
- Contributions affect capital reporting, not operating availability; test fingerprint semantics, never force false drift.
- PDF must contain full snapshotFingerprint as record integrity identifier, never digital signature/legal authenticity.
- Existing delivery choice: future stacked-to-main; no PR creation. Forecast 500–1,200 authored source/test/doc lines excluding disposable QA tooling; native risk determines review.
- Engram mirror pending because host registration blocks mutation; do not invent a session identity.

## Tasks

- [x] C1 — Isolated local stack, cloned lab and empty Prisma migration proof. Delegated: infrastructure preparation/execution. Empty `bazar_phase55_empty` and cloned `bazar_phase55_lab`: 26 migrations deployed, four ENABLE+FORCE RLS agreement tables/policies, 36 CHECKs/10 FKs/13 indexes/three immutable triggers; runtime nonprivileged and no-tenant/cross-tenant probes passed. Isolated services healthy on loopback8081/3101, bundle literal `/api/v1`, nginx proxy verified. Existing stack/volumes unchanged. Evidence: `../deploy/phase55-lab/evidence.md`. Authentication to cloned accounts pending; known seed credentials returned401, no reset/bypass.
- [x] C2 — Backend minimum replay/live-state and reversal chronology corrections, plus real e2e gaps. Delegated: source/tests. Commit `822855d`; RED3 unit/3 product e2e regressions observed, GREEN103 focused unit and50 e2e; build/lint/diff-check pass, parent reran28 service tests. Live replay preserves snapshot/hash/folio. New reversal requires original occurredAt <= reversal occurredAt <= backend receivedAt; exact replay precedes chronology checks, structured422 FINANCE_AGREEMENT_REVERSAL_TIME_INVALID. Real PostgreSQL expense drift/contribution exclusion/concurrent201-409 and201-200/folio duplicate rejection/downstream transaction rollback proved. Native medium390lines under_budget, boundary remains71ee47f.
- [x] C3 — Full document fingerprint in snapshot PDF. Delegated: source/tests. Commit `fac3b06`; RED9 failures then98 focused tests GREEN; lint/vue-tsc/build/diff-check pass, parent reran25 adapter tests. Adapter active-only replay bug fixed, voided confirmation truthful. Full stored hash in selectable integrity section verified via actual PDF decoding and raster inspection within A4 margins. Contract/error mapping updated. Native medium159lines under_budget, base265c5fd; temporary artifacts excluded using native inventory.
- [ ] C4 — Rebuild isolated final branches and real API/Chrome scenario. Real Chrome normal login/device/socio, simulation600000->270000/330000, creation/history/detail/immutable names and amounts/drift/recalculation/void/substitution passed. Real HTTP replay200/conflict409/postvoidvoided, chronology422/concurrent201-409/tenant404-403/listcursor/folio00001-00005 passed; expense drift and contribution exclusion observed. Real widths320/390/768/1280 and basic keyboard/focus plus six regression sections passed. Actual snapshot active/voided PDFs rendered and visually compared. BLOCKED: real Chrome Offline control unavailable; UI download capture timed out and Downloads URL security-denied, so actual UI-downloaded bytes not proved. No unsafe workaround or synthetic substitute. Evidence ../deploy/phase55-lab/integrated-evidence.md.
- [x] C5 — Final backend/frontend suites and closure report. Delegated verification: backend unit40files/701tests passed; backend e2e34files/913tests and frontend224files/4043tests passed with explicit invocation --testTimeout=30000, no persistent timeout changes. Default concurrent suites failed backend2/front7 tests; password timeout and router ~9s initial load diagnostics documented, original bounded output missing some frontend failure headlines. Backend/frontend lint/build, vue-tsc, diff checks pass. Closure report records NO CLOSED due two C4 proof blockers. Evidence ../deploy/phase55-lab/final-automated-evidence.md; retain exact failures and adjusted command evidence.

## Checks

- Backend agreement tests, full `npm test`, full `npm run test:e2e`, lint/build/diff-check.
- Frontend agreement/PDF tests, full Vitest, lint, `npx vue-tsc -b`, build/diff-check.
- Native RDD remains user-owned; each candidate requires provider-issued assessment/continuations and consent where applicable.
- Real browser widths 320/390/768/1280; basic Tab/Shift+Tab/Enter/Escape, visible/returned focus.
- Real active/voided PDF generated from API snapshot and visually compared; long fixture stress can be reused.

## Evidence and next step

- Git state/merge bases checked; existing lab services healthy. Read-only map confirms replay projection and timestamp gaps and missing expense/concurrency/post-counter rollback evidence.
- User authorized normal isolated registration. Verified email-gated registration/member creation requires Resend approval/credential emails; isolated env disables email. No account/scenario mutation occurred, no remote delivery attempted. Evidence: ../deploy/phase55-lab/auth-registration-blocked.md. Need normal cloned login or explicitly authorized isolated bootstrap before real browser C4.
- User explicitly authorized isolated auth bootstrap (not normal registration); actual Argon2id accounts/two contexts/three socios prepared only in cloned DB. Normal API login/device activation then real operational product/sale/shifts created; no auth bypass during integration. Final isolated backend822855d/frontendfac3b06 healthy. Original stack/volumes/Cloudflare unchanged.
- Real lab final data: five agreements (two active/three voided), seven shifts, one operating expense and one capital contribution; original names restored. Additional browser device was created through normal authorized socio API after account switch required a fresh identifier. Private credentials/evidence outside both Git worktrees, never committed.
- Next: obtain supported real browser Offline control and actual UI-download bytes inspection, then complete C4 and re-evaluate closure. Phase5.5 NOT CLOSED. No Phase6/payments. Local infrastructure artifacts outside both repositories have no work-unit Git commit; no remote publication authorized.
