# Correct Atomic Design boundaries without changing behavior

Preserve the existing Vue UI while correcting component classification and separating application orchestration from presentation. This is authorized local ODD implementation, not SDD or a redesign.

## Objective and evidence

The audit found `src/components/ui/{atoms,molecules,organisms}`, three routing layouts, and sixteen views acting as Pages. There is no dedicated template layer. Folder names alone do not establish conceptual compliance.

Keep the `ui` namespace, existing views/routes, basic controls, focused molecules, services, stores, types, utilities, and composables. Do not rename `views` to `pages` or create sixteen pass-through templates. Classify by responsibility and composition, not line count or framework features such as Teleport.

Confirmed problems include compound controls in atoms; whole forms/lists in molecules; generic card/modal/menu primitives in organisms; internal imports through their own public barrel; an exported installment draft type inside a Vue file; toast store access in a molecule; API orchestration in debt/incident organisms; business rules inside ProductForm and SaleCart; and application orchestration mixed with structural AppLayout markup.

## Authorization and constraints

- User authorized evident, behavior-preserving corrections and explicitly selected strict TDD (`Dale`).
- Artifact prose and new identifiers default to English. Preserve existing Spanish UI copy exactly.
- Preserve rendered DOM, CSS classes/scoped styles, routes, exports, interactions, accessibility, and externally consumed props/events. Internal page-to-organism contracts may change only with all callers and tests migrated in the same unit.
- No backend changes, new features, dependency upgrades, invented components, remote operations, push, PR creation, or merge into main.
- Never revert unrelated work. Initial worktree was clean on `main` at `f0d0c58899403f3e3bfd916f4f22d5cea47cce89`.
- Integration branch: `feat/atomic-design`. Delivery: `auto-chain`, strategy `feature-branch-chain`, explicitly chosen by the user as the recommendation.
- No `size:exception` has been approved. The 400-line per-task figure is advisory for local work; future PRs exceeding 400 authored additions plus deletions require an explicit exception or a coherent split.
- T1 source relocation and boundary tests passed writer checks; later tasks remain pending.

## Acceptance criteria

- Atoms have no upward dependencies or business/application orchestration; molecules have no organism/template/page dependencies.
- UI internals use direct downward/peer imports rather than their own public export barrel; public named exports remain available.
- Compound fields are molecules; complete domain sections/forms/lists are organisms; generic UI containers are not classified as whole application sections.
- UI presentation does not import stores or HTTP services. Model/type definitions stay outside SFCs.
- Debt/incident async lifecycle and concurrency/error behavior are owned by composables coordinated by Pages, not hidden behind a renamed service-connected visual wrapper.
- Product validation and debt eligibility rules are independently testable outside visual SFCs without changing current edge cases.
- AppTemplate describes actual shell anatomy through props/slots/events without accessing route state, stores, services, or real application data itself. AppLayout remains the routing/application adapter.
- Existing functional suites and applicable new regression checks pass, with failed/unavailable/skipped checks reported honestly.

## Tasks and local slice boundaries

Each row is one coherent work-unit commit/slice with tests and documentation included. Create each child branch from its predecessor; first child targets the integration branch. The parent branch is the intended future PR base, not permission to create a PR. Record actual commits and counts below before closing tasks.

| ID | Child branch suffix | Outcome and rollback boundary | Forecast authored +/- |
|---|---|---|---|
| T1 | `01-controls` | Move AppInput, AppSelect, AppTextarea, AppImageUpload, QuantityStepper and composed AppStatCard into molecules; update every import and their tests; add classification/dependency regression coverage. Rollback only this classification/import unit. | 200-400 with rename detection |
| T2 | `02-sections` | Move BusinessRegistrationForm, ChangePasswordForm, DeviceCreateForm, DeviceIdentifyForm, MemberCreateForm, ProductForm, DeviceList, TeamMemberList and ProductCard into organisms; update imports/tests. Rollback this section classification unit. | 180-350 with rename detection |
| T3 | `03-boundaries` | Move AppCard/AppModal/AppKebabMenu to molecules; remove internal public-barrel cycles; move CuotaDraft to existing debt types; correct barrel guidance and architecture contract tests. Rollback generic-container/import/type boundary changes together. | 160-320 with rename detection |
| T4 | `04-toast` | Make AppToast receive data and emit dismissal; connect its store in App.vue, keeping accessible live-region/teleport behavior. Rollback toast presentation/host wiring and tests. | 100-220 |
| T5 | `05-product-rules` | Extract ProductForm validation/payload rules into a focused external module with behavior tests; keep interaction/form state in the organism. Rollback product rule extraction and its integration tests. | 260-420 |
| T6 | `06-debt-eligibility` | Move SaleCart debt eligibility outside the visual SFC; preserve single-line, missing-cash, invalid-cash and submitting guards. Rollback eligibility extraction and matching tests. | 90-180 |
| T7 | `07-incident-detail` | Extract incident detail/load/resolve orchestration into a composable used by IncidenciasView; present via props/events, preserving retries, duplicate-submit guards and stale-result behavior. Rollback composable, organism and Page wiring as a unit. | 320-520 |
| T8 | `08-debt-detail` | Extract debt/product loading and payment orchestration into a composable used by DeudasView; preserve payment validation, retry, refresh and lifecycle behavior. Rollback composable, organism and Page wiring as a unit. | 380-620 |
| T9 | `09-shell-template` | Extract genuine presentational AppTemplate from AppLayout; leave routing/auth/session/offline synchronization in adapter; preserve mobile collapse, mode navigation, sidebar/footer, sync controls and styles. Rollback template plus adapter/tests as one shell unit. | 700-1100 |
| T10 | `10-verification` | Close architecture documentation/regression coverage, run independent final checks and browser scenarios, and record actual evidence. Rollback only final audit/test/docs changes. | 100-220 |

- [x] T1: Compound controls classified and writer-checked; parent independent verification pending.
- [ ] T2: Complete sections classified and checked.
- [ ] T3: Generic containers, imports and shared type boundaries corrected.
- [ ] T4: Toast store connection moved to application host.
- [ ] T5: Product domain rules separated and checked.
- [ ] T6: Sale debt eligibility separated and checked.
- [ ] T7: Incident detail presentation/orchestration separated and checked.
- [ ] T8: Debt detail presentation/orchestration separated and checked.
- [ ] T9: Structural shell template separated and checked.
- [ ] T10: Final functional, structural and independent verification recorded.

Forecast: approximately 2,490-4,350 authored additions plus deletions, excluding generated output. Unchanged file relocations use Git rename detection; any rewritten/moved lines are counted honestly in actual evidence. This is one bounded slicing pass, not a promise that every future PR is below 400. T5/T7/T8/T9 can exceed that budget because their callers and regression tests must remain coherent; do not omit tests, compress source, or repeatedly re-slice to force a number. Local work can proceed; no oversized PR may be created without an explicit exception. Recommend an exception for a cohesive shell extraction if its actual diff remains over budget.

Chain: `main -> feat/atomic-design -> feat/atomic-design-01-controls -> ... -> feat/atomic-design-10-verification`. Child 02 targets child 01, and so on. Integration into the local tracker may occur only after completed work units are verified; main remains untouched.

## Verification protocol

TDD is **on**, source: explicit current-session user approval. Runner: `npm.cmd run test:run` (Vitest, confirmed in package.json). RED -> GREEN -> REFACTOR is required for each behavior/boundary extraction; preserve baseline behavior tests and introduce failing tests for the intended new boundary before implementation. A test that merely reproduces an unrelated baseline failure is not RED evidence.

Baseline before source implementation, each command separately with observed exit/results:

1. `npm.cmd run test:run`
2. `npm.cmd run lint`
3. `npm.cmd run build`

Focused checks (existing directories verified; new test files are planned):

- T1-T3: `npm.cmd run test:run -- src/components` plus planned `npm.cmd run test:run -- src/architecture/__tests__/atomic-design.test.ts`.
- T4: `npm.cmd run test:run -- src/components src/__tests__/App.toast.test.ts` (App.toast test planned).
- T5: `npm.cmd run test:run -- src/components src/utils/__tests__/product-form.test.ts` (utility test planned).
- T6: `npm.cmd run test:run -- src/components src/views/sales src/utils/__tests__/sale-debt-eligibility.test.ts` (utility test planned).
- T7: `npm.cmd run test:run -- src/components src/views/incidencias src/composables/__tests__/useIncidenciaDetail.test.ts` (composable test planned).
- T8: `npm.cmd run test:run -- src/components src/views/deudas src/composables/__tests__/useDeudaDetail.test.ts` (composable test planned).
- T9: `npm.cmd run test:run -- src/layouts src/templates/__tests__/AppTemplate.test.ts` (template test planned).
- After each unit: `npm.cmd run lint` and `npm.cmd run build`; record focused RED/GREEN output, not only final totals.
- Final T10: `npm.cmd run test:run`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:coverage` and independent verifier readback/checks.
- Count/check each candidate: `git diff --check`; `git diff --numstat --find-renames <previous-boundary> HEAD` after its commit. **Standing convention (corrected 2026-09-30): the squashed `git diff --numstat --find-renames <task-parent-base> HEAD` result is the official authored-line metric for every task, never a sum of each commit's own diffstat.** The two can diverge when a self-referential progress doc is created mid-branch and edited again in a later commit on the same task: the later edit's lines are already "new to the branch" in the squashed view, so they add no extra churn there even though they appeared as their own additions/deletions in that commit's standalone diffstat. Apply this consistently from T1 forward.

Browser runtime checks, when an available authorized local browser session can be used: mobile/desktop shell collapse and navigation; toast dismissal; product create/edit validation; incident load/retry/resolve; debt load/retry/payment; sale debt-option eligibility. Preserve screenshots/results if available, otherwise explicitly record unavailable access and do not fabricate a visual pass. Automated Vue integration tests remain required regardless.

RDD status is **unknown**: parent observed `.git` ownership failures for read-only status both sandboxed and escalated. Do not repair permissions, change Git trust configuration, enable/disable RDD or start native review automatically. Parent owns status/assessment routing and any required human handoff. Unassessable delegated changes require an independent verifier in addition to writer checks. No review approval is implied by task completion.

## Progress and recovery

- Initial base: `f0d0c58899403f3e3bfd916f4f22d5cea47cce89`.
- Integration branch created; current child branch is `feat/atomic-design-01-controls`.
- Completed implementation tasks: T1 (writer checks; parent-independently verified 2026-09-30). Work-unit commit: `8f50d613bca3e0b803fac9083045e9a6660f90e4` (`refactor(ui): classify compound controls as molecules`), 203 additions + 35 deletions = 238 authored changed lines, including the initial feature document; nine renames detected. Corrected 2026-09-30: T1's authored-line figure is **238**, not the previously recorded 242. `git diff --numstat --find-renames f0d0c58899403f3e3bfd916f4f22d5cea47cce89 HEAD` (the squashed command the Verification protocol specifies) gives 238, which undercounts relative to summing each commit's own diffstat (238 + 4 = 242) specifically because the progress doc itself (`odd/tasks/atomic-design.md`) was created mid-branch in commit `8f50d61` and edited again by follow-up commit `48cf38c`: that second edit's +2/-2 lines were already "new to the branch" in the squashed view, so they add no extra churn there even though they counted as their own diffstat in that commit alone. The squashed base->HEAD command is the official metric from here forward, not the per-commit sum; no generated files committed.
- Baseline `npm.cmd run test:run`: 164 test files / 3,050 tests passed. Baseline lint: exit 0. Baseline build: exit 0 after an approved escalated retry. Sandbox test/build attempts could not read ancestor directories while loading Vitest/Vite configuration; elevated retries passed without configuration changes. Build already warns about the toast static/dynamic import and chunks over 500 kB.
- T1 RED `npm.cmd run test:run -- src/architecture/__tests__/atomic-design.test.ts`: 12 failed / 1 passed, exit 1, because the six compound controls were still atoms.
- T1 GREEN `npm.cmd run test:run -- src/components src/architecture/__tests__/atomic-design.test.ts`: 61 files / 797 tests passed, exit 0. Repeated after classification-comment/export cleanup: same 61 files / 797 passed, exit 0.
- T1 `npm.cmd run lint`: exit 0. `git diff --check`: exit 0.
- T1 initial `npm.cmd run build` failed, exit 2: test helper `String.replaceAll` was unavailable under the project's TypeScript target (`TS2550`). Corrected with global regex replacement, without changing target configuration. Final focused repeat: 61 files / 797 tests passed, exit 0; final lint exit 0 and build exit 0. Baseline bundle warnings remain unchanged.
- T1 runtime evidence: component mounting/event regression suite passed; browser visual validation not performed in this unit and remains pending final verification. Rollback boundary is the six relocations, their import/test updates, barrel grouping and new architecture test; no unrelated changes included.
- Coverage and independent verification: pending. RDD outcome: unavailable/unknown, no review invoked.
- Engram mirror: parent saved planning document as observation 183 under `odd/atomic-design/tasks`; full readback was blocked by ambiguous MCP project context. Current progress mirror update and full readback remain pending parent action; locator `odd/tasks/atomic-design.md`.
- Evidence per completed task must include commit ID, exact commands/results, authored line count, runtime scenario/outcome or explicit unavailability, rollback boundary, assessed risk and RDD outcome (or unavailable).
- Next step: parent updates mirror and independently verifies committed T1 against initial base `f0d0c58899403f3e3bfd916f4f22d5cea47cce89`. Do not start T2 yet.
