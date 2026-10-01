# Date/time corrections

## Objective and scope
Reduce legitimate-sale clock-skew noise and represent planned installments as calendar days, never instants. User authorized both corrections after investigation. No remote access, database recreation, migration application, deployment, push, PR, or merge.

## Decisions and constraints
- Future sales: strict greater than five minutes; equality accepted. Past: strict greater than two days, unchanged.
- Installments: PostgreSQL DATE with API YYYY-MM-DD. Reject invalid calendar dates. Convert historical timestamps using their UTC calendar day, preserving the existing editor encoding.
- Overdue: installment day strictly before today in the established UTC-06:00 business timezone; today's installments are not overdue. Abonos remain instants.
- TDD ON: explicit current user instruction. Runner: npm.cmd run test:run (vitest run). Observe focused RED, GREEN, then refactor.
- Atomic work-unit commits on fix/date-time-corrections. RDD: unknown (read-only mode status failed); never enable or repair.
- Forecast: approximately 250 authored changed lines. Delivery strategy ask-on-risk; no PR planning or remote delivery authorized.

## Tasks and acceptance
- [x] T3: Configure actual v14 picker as date-only; serialize/display calendar days without timezone shift; overdue only before the business day.
- [x] V: Required build, lint, and full tests observed; report failures/skips honestly.

## Verification
Required: npm.cmd run build; npm.cmd run lint; npm.cmd run test:run. Actual VueDatePicker menu test must assert no time UI.
Runtime harness: functional service/component tests. Rollback boundary: each behavioral commit and its tests/docs independently; DATE conversion is intentionally lossy and cannot restore historical hours.

## Progress
T3 verified. RED: overdue and calendar display failed; real picker rendered open-time-picker-btn before fix. GREEN: 37 focused tests passed; repeated under Asia/Tokyo and UTC (37 passed each). Full build and lint passed; 167 test files / 3096 tests passed. Sandbox build/tests failed at esbuild directory permissions and were rerun successfully with approval. Existing build warnings: toast mixed import, large chunks. T3 commit: 9599372f2834996950afddd798961af6577bba7e. Engram mirror saved; readback synchronization pending.

## Next step
Await explicit user authorization naming the database recreation destination, operation, and credential/session before any recreation or remote access. Backend migration and database-backed e2e remain pending; no push or deployment.

Independent verification complete: real datepicker, quota display, and overdue regression tests, 37 passed (exit 0); clean worktree confirmed. Native assessment: medium, 110 authored lines; RDD unknown; no review started. Engram full mirror updated; readback remains pending because the parent workspace has ambiguous project identity.
