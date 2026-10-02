# Isolate persisted session context by account and API

Prevent an authenticated account from inheriting another account/environment's device or selected person. Preserve same-owner offline use and queued records, with narrow recovery when the server rejects the current selection.

## Authorization and recovery

- Repository: `bazar-frontend`; starting clean main boundary `96e29865983b4fdfdc2c68d6dcc54174076ea56d`.
- Branch: `fix/session-context-ownership`; file locator: `odd/tasks/session-context-ownership.md`; intended mirror: `odd/session-context-ownership/tasks`.
- Authorized locally: session/auth/API ownership boundary, minimal identity helper, queue-origin parsing reuse if needed, router/SelectContext/voice changes necessary for recovery, colocated tests and minimal existing fixture adaptations, atomic Conventional Commits.
- Not authorized: backend/database/business-rule changes, IndexedDB migrations or clearing, dependencies, push/merge/PR/deployment, remote access, credentials, real-account login, ownership/configuration changes or review activation. Preserve other contributors' edits.
- TDD: **true**, explicit current user instruction; runner `npm run test:run`. Observe RED before each implementation behavior, then GREEN/refactor; never invent proof.
- English technical artifacts; existing user-facing Spanish extended in neutral Spanish.
- Engram mirror **pending**: authoritative attribution identity unavailable and agent-attributed mutations restricted. Retain the full local document; do not claim synchronized recovery.
- Parent reads this actual file before source/test writes. Current authorization stage creates branch/document only.

## Verified cause and minimal design

`session.store.ts` eagerly restores unowned `device_context` from localStorage and `member_context` from sessionStorage. Logout clears only the person. `auth.store.ts` offline `account_binding` uses username ownership and its in-flight response has no account-generation check. Axios adds restored context even to JWT-only authentication/identification calls. A changed account/environment can therefore inherit stale selection before routes decide access.

Verified backend contract, read-only: `/auth/me` returns username/memberId/member, no accountId/contextId; JWT sub is account identity. ContextGuard returns the same `Selection is not authorized for this context` for invalid ownership, inactive member, unauthorized device or token mismatch. Do not infer which condition failed.

Use conservative owner `{ accountId: JWT.sub, apiBase }`, not a fabricated tenant ID. A small dependency-free helper avoids session/API import cycles and can share existing queue-origin JWT parsing. Persist validated owner metadata with device/member/binding records. Before hydrating or emitting selection headers, establish current identity and compare ownership. Legacy unowned records are not adopted into a new owner; clear only context selections and ask for confirmation. Same owner reload/offline retains compatible context; logout still requires person reconfirmation.

Capture account/token generation for binding responses/cache writes. Bound accounts use only the server-bound member, while shared accounts select a person. Recovery reacts only to the exact verified ContextGuard 403 body and a still-current captured account/selection; unrelated 403s and delayed/foreign queued responses do nothing. No mutation replay, repeated redirect, or retry loop. Refresh binding once so bound recovery cannot expose the shared selector.

## Acceptance: ten cases

1. Same account/API reload restores owned device/token and current-tab member, not arbitrary unowned storage.
2. Successful login to another account clears old selection before `/auth/me` or operational requests emit stale context headers.
3. Same account on another API base cannot hydrate old device/member/binding cache.
4. Legacy, corrupt, missing-owner or invalid-current-identity data fails closed into context confirmation without silently acquiring ownership.
5. Logout/401 clears person and binding credentials/cache; owned device remains usable only by the matching next account/API. No pending records are deleted.
6. Bound active account overwrites forged/stale member; inactive/mismatched binding stays blocked; shared account offers only its valid context selector.
7. Offline same-owner restore uses only an owner-matched coherent binding cache and keeps queued data/device state; mismatched/legacy cache is not trusted.
8. Delayed `/auth/me` response/error/cache write from an old generation cannot change the new account's binding, selection or credentials.
9. Only exact `Selection is not authorized for this context` 403 from the current captured owner/selection triggers one context recovery; unrelated permission/password/identify errors, stale responses and foreign queued selections do not reset current state.
10. Explicit queued member/device headers remain authoritative and another device's token is never appended; JWT-only endpoints emit no selected-context headers. Recovery preserves local queued operations and uses clear Spanish guidance without claiming a verified tenant/revocation cause.

## Constraints and compatibility

- Different accounts in the same business deliberately require device reidentification: current contract cannot prove tenant equality. An activated one-time device may need a socio to reissue its code.
- Legacy unowned offline sessions cannot be migrated safely by guessing. Owned same-account offline use remains supported.
- Existing cash queue and catalog snapshot are globally unowned. Debt records already include account/device/API origin. This change does not promise complete cross-account cash/catalog isolation; do not expand into queue/database redesign or delete records.
- JWT parsing establishes a non-secret persistence-routing identity, not signature verification or server authorization. Missing/malformed identity must not fall back to username equality.
- Many existing tests use opaque fake tokens or unowned records. Adapt fixtures only where necessary to the new real-shaped synthetic JWT/owned contract; do not weaken security to preserve obsolete assertions.
- Parent owns independent verification/native risk assessment. Functional checks do not manufacture review approval. Synthetic local browser proof may use actual components with memory router/stores, never production authentication.

## Work units

- [x] **S1 - Persist an account/API ownership boundary**
  - Minimal identity helper and session persistence normalization/hydration; reuse queue-origin parsing only where coherent.
  - RED owner-match/mismatch, no-identity, legacy/corrupt records, same-owner reload/logout and API change; GREEN targeted session/identity/origin tests.
  - Keep tests and necessary fixture adaptations with behavior. Rollback: owner helper and session persistence boundary; no queued/database records touched.
  - Runtime: store/header integration tests; browser confirmation deferred until full recovery integration.
  - Forecast: 200-300 authored additions/deletions; identity/evidence/count pending.

- [x] **S2 - Reconcile authentication and guard asynchronous binding**
  - Ownership reconciliation before binding fetch; owner-matched binding cache; generation-safe fetch/cache/error application; active bound/shared/inactive behavior.
  - RED account switch/race/offline-cache tests before implementation, then GREEN auth/router integration tests. Minimal existing fixture updates documented.
  - Rollback: auth lifecycle/cache changes and tests, retaining S1 standalone boundary.
  - Runtime: real router/auth synthetic tests; no real account/network credentials.
  - Forecast: 200-300 authored additions/deletions; identity/evidence/count pending.

- [ ] **S3 - Recover exact context rejection without stale headers or loops**
  - JWT-only header exclusion, captured selection/owner matching, exact-body 403 recovery, controlled bound refresh, necessary router/SelectContext/voice changes.
  - Three Spanish guidance cases: changed account/environment, legacy/unowned selection and server-rejected current selection. Do not claim a proven different business or revoked device.
  - RED exact/unrelated/stale/foreign-queue 403 and header regressions, then GREEN; preserve explicit queued attribution and local records.
  - Verify full regression suite and isolated actual-component browser route/voice behavior if feasible. Report unavailable proof honestly.
  - Rollback: narrow context recovery/header/voice changes and associated tests, keeping S1/S2 ownership behavior.
  - Forecast: 200-300 authored additions/deletions; identity/evidence/count pending.

## Verification

- S1: `npm run test:run -- src/stores/__tests__/session.store.test.ts src/services/__tests__/queue-origin.test.ts` plus new helper test path once created and recorded.
- S2: `npm run test:run -- src/stores/__tests__/auth.store.test.ts src/stores/__tests__/auth.store.binding.test.ts src/router/__tests__/router.binding.test.ts src/router/__tests__/router.test.ts`.
- S3: `npm run test:run -- src/services/__tests__/api.test.ts src/views/__tests__/SelectContextView.test.ts src/stores/__tests__/auth.store.binding.test.ts src/router/__tests__/router.binding.test.ts`.
- Offline preservation: `npm run test:run -- src/stores/__tests__/sales-queue.store.test.ts src/services/__tests__/sales-sync.test.ts src/services/__tests__/local-db.test.ts`.
- Final source normalization precedes checks: `npx vue-tsc -b`; `npm run build`; `npm run lint`; `npm run test:run`; `git diff --check`.
- Run required commands in foreground, bounded polling; report actual failures/warnings/timeouts, not suppressed success. Full suite/build takes a few minutes locally.

## Delivery forecast and next step

- Delivery strategy: `ask-on-risk`; cached user chain strategy: `feature-branch-chain` (integrate the completed feature only at the end; no current merge/PR authorization).
- Forecast: **600-900 authored additions plus deletions**, excluding generated files; keep actual running work-unit counts.
- Initial coherent proposed slices: S1 persistence ownership -> S2 auth lifecycle -> S3 exact recovery. Each includes tests/docs and depends on the previous. If fixture breadth makes a coherent slice larger, report the honest count rather than compressing code/prose or omitting tests. The roughly 400-line task heuristic is advisory, not a hard acceptance cap.
- All work-unit commits stay on this feature branch; no external PRs or child branches created. Record focused/runtime proof, rollback boundary and commit identity after each unit.
- Current stage: read-only diagnosis approved; branch and local recovery document created only. **Await parent actual-file readback and authorization before any source/test write or commit.** Mirror pending under identity restriction.

## S1 observed evidence

- RED: new ownership suite 4/5 failed (unowned/foreign selection and no-identity exposure). GREEN: session/store/ownership/origin 3 files / 34 tests PASS after refactor. Existing session fixtures now declare synthetic account/expiry and separate device/member owner markers, preserving existing payload contracts and owned legacy-shape normalization.
- Owner sidecars preserve raw device/member shapes while independently rejecting bad selections. No-token/expired identity hides device in memory but retains owned localStorage. Logout hides device; matching next identity restores it. API base trims whitespace/trailing slashes without inferring origin equivalence. Queue-origin reuses the same non-secret identity parser.
- Intermediate focused checks found misplaced normalization write and unused eager reads; corrected before GREEN. Scoped ESLint normalized sources. No IndexedDB/backend/business changes. Runtime boundary: actual store integration tests; browser deferred S3. Engram mirror pending. S1 commit identity recorded by next unit update/report.

## S2 observed evidence

- S1 committed `cd167351ea5dafc82b36a5f7e5dc5245a334bbfd`, 243 authored additions/deletions.
- RED: binding ownership/race suite 3/4 failed (unowned same-username cache, delayed old success, delayed old401). GREEN: expanded auth/session/router command 6 files / 149 tests PASS. Typecheck PASS.
- Binding cache requires account/API owner as well as display username; successful coherent responses include non-secret owner. Captured token/generation prevents stale binding success/error/cache writes from changing a newer login. Login reconciles owner before binding fetch. Logout hides retained owned device in memory; fixed and tested the old logout memory-exposure assumption.
- Existing auth/router fixtures use synthetic JWT subjects; matching cache assertions include owner; unowned shared selection is intentionally discarded rather than adopted. Intermediate fixture/type errors were corrected, not suppressed. Runtime: actual independent memory routers and auth/session stores with synthetic service responses; physical/production proof not claimed. Mirror pending. S2 identity follows in next update/report.
