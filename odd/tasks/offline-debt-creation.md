# Offline debt creation

Create fiado/apartado from checkout without internet using the existing durable sales queue. Initial payment and installment schedule remain one atomic debt creation payload; later payments intentionally remain connection-required.

## Authorization and dependency
- Frontend only: local implementation, TDD, atomic Conventional Commits; no push, merge, or remote PR creation.
- Backend PR 1 is merged and pushed: main/origin main `cd170b8070afcd888f951066cfa4087ba0668927`; original feature branch retained.
- Frontend base: `c5806499ade38d4a9d7074482913bd9a30499f73`; branch: `feat/offline-debt-creation`.
- Backend contract: `../bazar-api/odd/debt-creation-api.md`. Client UUID id and unchanged input replay original creation result; different input/account/tenant/member/device returns 409 without duplicate inventory/payment effects.
- Scope: checkout debt creation, shared queue/sync/counters, debt-specific result and tests/documentation. No backend edits or offline later-payment support.

## Problem and design
- Before this change, checkout sent direct POST /deudas, unlike cash checkout.
- Extend IndexedDB `pending-sales` with a discriminated debt record. Missing discriminator means legacy cash; preserve DB name/version, pending records, ordering, retry scheduler and locks.
- Debt body freezes client UUID v7, debtor/product/quantity/type, initial payment and optional ordered installments. Preserve id on unchanged retry, double click and ambiguous HTTP outcome.
- Queue origin metadata freezes account id, member id, device id and API origin/base context; never persist credentials. Send frozen member/device headers using current credentials only for matching origin.
- JWT contains account `sub` only; frontend Member/auth-me omit tenant id. Account identity is obtainable without storing JWT, but tenant reassignment of the same account is NOT observable offline. Backend tenant-scoped authorization/fingerprint remains authoritative; no new API fields will be invented.
- First-create tenant confinement does not rely on replay fingerprint: backend `src/auth/context.guard.ts:72-85` requires frozen member/device in the authenticated tenant; `src/auth/socio.guard.ts:33-44` invokes this before controller; `src/deudas/deudas.service.ts:145-172` revalidates account/member/device in that tenant inside the creation transaction before any write. An account moved alone cannot create using original-tenant member/device. Coordinated administrative reassignment of all those identities is not observable to this client.
- Recheck origin/auth eligibility before each sequential send, including after awaits/session change. Foreign-account/device debts stay pending, not sent under another session.
- Debt 400/409 is a visible `needs_review` record. Network/5xx/auth/unexpected response preserves identical pending record and shared retry behavior. Successful matching debt response removes only that id.
- Durable queue save precedes exactly-once local inventory decrement. Same attempt cannot decrement twice; avoid applying an async result to a changed account/device catalog.
- Server recalculates price at synchronization: locally shown total/saldo is an estimate; lower current total can reject an initial payment as excessive. Initial payment timestamps remain server synchronization-time.
- Existing snapshot is global/unscoped. Do not pretend it provides tenant identity; account/device isolation for new debt attempts and stock writes is mandatory. Broader historical cash/catalog isolation is not silently redesigned.
- Result shows saved/synchronize-later confirmation in existing Spanish UI tone, plus debt total/saldo/initial payment; never cash change. Pending indicator counts debt and cash.
- Later payments remain online by explicit scope decision: they need separate retry identity and balance conflict policy, not an untracked forgotten task.

## Acceptance and TDD
- TDD: ACTIVE; source: explicit user session instruction. Runner: `npm run test:run` (Vitest).
- Observe focused RED before each behavior implementation, then GREEN and refactor/check. Record actual commands/results, not inferred proof.
- Offline fiado and apartado save immutable complete creation payload; storage failure is not success and leaves inventory/cart intact.
- Reconnection automatically synchronizes through existing scheduler; retry uses same id/body/headers, successful replay cannot duplicate local inventory effects.
- Frozen metadata survives reload; account/device changes cannot send debt or mutate wrong catalog; no credentials in IndexedDB.
- Legacy cash records synchronize unchanged; mixed queue remains sequential under existing locks.
- Stock/business/id-payload conflicts remain reviewable and counters include pending debts.
- UI displays debt-specific saved result, saldo and initial payment; no cash-change labels.
- Backend duplicate/concurrency behavior already verified in PR 1; frontend verifies stable client id across ambiguous retry.

## Tasks
- [x] ODD-1: Extend durable queue, creation service and shared sync to debt records with backwards compatibility, origin guards, definitive review handling and focused tests.
- [x] ODD-2: Connect checkout frozen debt attempts and debt-specific offline result/UI; verify stock persistence order, double click, replay, account change, counters and reconnect integration.
- [x] ODD-3: Run complete frontend build/lint/tests and independent verification; document observed results, limitations and atomic commit identities before delivery.

## Verification commands
- ODD-1 focused: `npm run test:run -- src/services/__tests__/local-db.test.ts src/services/__tests__/sales-queue.test.ts src/services/__tests__/sales-sync.test.ts src/services/__tests__/deudas.service.test.ts src/stores/__tests__/sales-queue.store.test.ts`
- ODD-2 focused: `npm run test:run -- src/stores/__tests__/checkout.store.debt.test.ts src/stores/__tests__/checkout.store.test.ts src/views/sales/__tests__/sale-result.test.ts src/components/ui/organisms/__tests__/SaleResult.debt-registered.test.ts src/services/__tests__/sales-sync-scheduler.test.ts` plus new debt integration test paths when created.
- Full: `npm run build`; `npm run lint`; `npm run test:run`.
- Runtime harness: real IndexedDB abstraction through fake-indexeddb, shared scheduler online event and HTTP boundary mocks; optional browser network-offline simulation if available. No physical WiFi disruption.
- RDD mode: unknown because native status failed on unsafe repository ownership; do not enable, change ownership/config, or start review. Functional verification plus independent verifier fallback.
- Parent spot check and independent verification required before claiming completion.

## Delivery boundary and rollback
- Strategy: `exception-ok`; chain: `stacked-to-main` (user selected).
- PR order: backend idempotency [merged and pushed] -> frontend offline debt creation [local; delivery pending explicit authorization].
- Frontend `size:exception` explicitly approved by the user for the reported 697 authored changed lines (622 excluding the 75-line tracker). Backend approval is separate.
- One honest slicing pass identified infrastructure and checkout/UI, but the requested cohesive PR 2 keeps its behavior, tests and documentation together. No code golf or evidence omission.
- Rollback: revert the frontend feature work unit to restore connection-required checkout debt creation and the previous cash-only queue. Preserve/export unsynchronized debt records before reverting; old cash code cannot synchronize them. Backend idempotency remains independently useful.
- Commit boundary: one cohesive implementation work unit, followed only by a documentation evidence commit recording its observed identity.
- Mirror: topic `odd/offline-debt-creation/tasks`, repository locator `odd/tasks/offline-debt-creation.md`. Full mirror readback remains pending because the connected reader resolves the multi-repository root ambiguously; preserve local recovery state.

## Observed progress and proof
- ODD-1 implementation verified; committed in `0d7aa650dc039d35bf8c3a2947b0bdafb22bcbe0`. RED: new shared queue suite 8 failed before production changes. GREEN: exact focused suite plus offline-debt/queue-origin/API tests, 113 passed.
- ODD-2 implementation verified; committed in `0d7aa650dc039d35bf8c3a2947b0bdafb22bcbe0`. RED: checkout suite 9 failed before behavior; real modal debt-storage retry test 1 failed (cash retry bug). GREEN: focused checkout/result/scheduler suites 92 passed; complete SaleView 105 passed during full run.
- Durable IndexedDB/reopen, cached stock, frozen abono/installments, shared sequential queue, original selection headers, ambiguous HTTP replay, online-event auto-sync, scope changes, review retention and mixed counters covered.
- Complete deterministic proof: npm run test:run -- --maxWorkers=1 => 169 files, 3118 tests passed, zero skipped; 322.75 seconds. Default full command was also run: latest attempt 3114 passed / 3 failed, all unchanged router cold-import 5000ms timeouts. No router/timeout/config edits to hide this limitation.
- Final npm run build and npm run lint passed; build warns about existing toast mixed imports and large chunks. Final git diff --check passed. No source-mutating normalizer ran after final verification.
- Physical WiFi/browser manual test not performed; automated real modal plus shared scheduler/HTTP-boundary reconnect simulation passed.
- Frontend size:exception is approved; the shared queue and checkout/UI are delivered as one cohesive PR 2.
- ODD-3 functional and independent checks verified; size:exception approved. All task outcomes are recorded in feature commit `0d7aa650dc039d35bf8c3a2947b0bdafb22bcbe0`; its observed worktree was clean.

- Independent verification: `npm.cmd run lint` and diff-check passed; `npm.cmd run build -- --configLoader runner` passed typecheck/Vite/PWA; 14 relevant suites with `--configLoader runner --maxWorkers=1` passed 310 tests, zero skipped. Default build/tests were blocked before execution by managed-runtime esbuild ancestor-directory access denial. No permissions, configuration or test timeouts changed.
- Fresh finalization spot check: `npm.cmd run test:run -- --configLoader runner --maxWorkers=1 src/services/__tests__/offline-debt.test.ts src/services/__tests__/queue-origin.test.ts` passed 2 files / 11 tests, zero skipped; `git diff --check` passed.
- No confirmed candidate-caused defect found. The unchanged global catalog snapshot helper has no origin recheck inside its asynchronous write; this shared-base limitation was not reproduced as a new blocker.
- Physical WiFi/browser manual verification remains unperformed; automated IndexedDB/modal/scheduler/HTTP-boundary scenarios provide the observed runtime proof.

## Next step
Feature commit: `0d7aa650dc039d35bf8c3a2947b0bdafb22bcbe0` - `feat(deudas): support offline debt creation in shared sales queue`. It contains all verified behavior, tests and this tracking document (697 authored changed lines; 622 without tracking). A subsequent docs-only evidence commit records this identity; its hash is reported separately to avoid self-reference. Await explicit delivery authorization; keep the feature branch. No push, merge or remote PR creation authorized.