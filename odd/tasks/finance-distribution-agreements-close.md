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
- [x] C3 — Full document fingerprint in snapshot PDF. Delegated: source/tests. RED9 failures then98 focused tests GREEN; lint/vue-tsc/build/diff-check pass. Adapter active-only replay bug fixed, voided confirmation truthful. Full stored hash in selectable integrity section verified via actual PDF decoding and raster inspection within A4 margins. Contract/error mapping updated. Commit pending parent.
- [ ] C4 — Rebuild isolated final branches and real API/Chrome scenario. Delegated execution plus parent browser where needed. Record simulation/create/snapshot/history/drift/replay/reversal/replacement/list/folio/API-PDF parity/session/offline/keyboard/responsive/regression evidence, safely document laboratory mutations.
- [ ] C5 — Final backend/frontend suites and closure report. Delegated verification, observed failed/skipped/pending checks explicit. No closure if any real blocking criterion remains.

## Checks

- Backend agreement tests, full `npm test`, full `npm run test:e2e`, lint/build/diff-check.
- Frontend agreement/PDF tests, full Vitest, lint, `npx vue-tsc -b`, build/diff-check.
- Native RDD remains user-owned; each candidate requires provider-issued assessment/continuations and consent where applicable.
- Real browser widths 320/390/768/1280; basic Tab/Shift+Tab/Enter/Escape, visible/returned focus.
- Real active/voided PDF generated from API snapshot and visually compared; long fixture stress can be reused.

## Evidence and next step

- Git state/merge bases checked; existing lab services healthy. Read-only map confirms replay projection and timestamp gaps and missing expense/concurrency/post-counter rollback evidence.
- User authorized normal isolated registration. Verified email-gated registration/member creation requires Resend approval/credential emails; isolated env disables email. No account/scenario mutation occurred, no remote delivery attempted. Evidence: ../deploy/phase55-lab/auth-registration-blocked.md. Need normal cloned login or explicitly authorized isolated bootstrap before real browser C4.
- Next: commit C3, obtain safe lab authentication, rebuild isolated final branches and run C4/C5. Local infrastructure artifacts outside both repositories have no work-unit Git commit; no remote publication authorized.
