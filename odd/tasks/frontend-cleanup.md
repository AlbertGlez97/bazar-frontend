# Reusable frontend baseline

Remove the personal-finance domain and E2EE while preserving the reusable Vue UI and infrastructure. This is cleanup only, not integration with the bazar API.

## Authority and boundaries

- Authorized root: `bazar-frontend/`; do not change `bazar-api/`.
- Baseline: `739731a` (`main`). Working branch: `chore/remove-personal-finance`.
- Origin is configured; no push, fetch, pull request, or merge is authorized.
- Delivery: `exception-ok`. The user explicitly approved `size:exception` for one coherent deletion-heavy unit on 2026-09-24. Forecast: approximately 73 removed files / 21,369 removed source lines, plus shell/test adjustments. Do not split or compress code artificially.
- TDD: **off for this task**, explicitly approved by the user. Use post-change functional verification; test runner: Vitest via `npm run test:run`.
- Native review state: **unknown/unavailable**. The installed command rejected `review mode status`; do not infer approval or enable reviews. Use writer verification plus independent verification.

## Scope

Remove E2EE/BIP39, finance budget/debt/MSI/savings/dashboard modules, calculators and domain types, landing, financial guide and their tests. Remove the finance-only Excel report implementation but retain `exceljs`, `pdfmake`, and their required tooling. Remove register/recovery flows rather than keep fictitious features. Remove `/users/me` and financial profile rules; retain the legacy login contract for later adaptation.

Preserve generic UI, `toast.store.ts`, PWA installation, `assets/main.css`, Axios base, strict TypeScript, Vitest configuration, and the directory organization. Keep layout/login branding and visual structure; remove only obsolete feature links, crypto content, and duplicate toast mounting. Do not alter backend contracts, rebrand, or add catalog/sales behavior.

## Decisions

- Delete `AppHelpDrawer`: it is coupled to the deleted guide content.
- Keep generic `AppTooltip`; remove only its guide-specific link/prop/styles.
- Keep one global `AppToast` in `App.vue`.
- Route `/` and unknown URLs to `/login` without a session or `/app` with a session. `/app` is only a minimal private shell; no dashboard or fake functionality.
- Restore the local token/user session without calling the old profile endpoint. Test corrupt/missing storage and login/logout navigation; do not claim server-side session validation or bazar-login compatibility.

## Work unit

- [ ] **T01 — Remove the finance domain and deliver a verified reusable shell.** Delete the authorized modules/dependencies, adjust shell/auth/routing and affected tests, install dependencies, verify, and create a Conventional Commit with code/tests/docs together.

### Acceptance and checks

- Deleted features have no remaining imports/routes/exports; BIP39 is absent from manifest and lockfile.
- Generic components/styles/API/PWA install configuration remain intact except explicitly authorized coupling removal.
- Logged-out, restored-session, login, logout, and unknown-route behavior are tested without redirect loops or old profile/crypto calls.
- `npm install` completes; no unrelated dependency upgrades or forced audit fixes.
- `npm run dev -- --host 127.0.0.1` starts, serves the app, and loads retained Vue modules without compilation errors; stop only the verification server afterward.
- `npm run build` succeeds (TypeScript + Vite).
- `npm run test:run` succeeds, with retained test count recorded.
- `npm run test:coverage` checks the existing CI threshold without weakening configuration.
- Run `npm run lint` only if the script exists; otherwise report **not configured**, not passed.
- Independent verifier checks scope and reruns relevant checks; parent spot-checks one reported command.
- `git diff --check` is clean. No push.

## Progress and evidence

- Original state committed as `739731a`; implementation and independent verification complete, local commit pending. Removed 73 files (finance views/stores/services/types/calculators/tests, E2EE, landing/guide/register/recovery and finance-only Excel utility).
- Install: command-scoped TLS=1 npm install succeeded. Initial sandbox install failed EPERM and left incomplete node_modules; exact-lockfile npm ci repaired it after one transient EBUSY retry. No retained dependency versions changed: removed only BIP39 and exclusive transitives @scure/base and @noble/hashes.
- npm run build: PASS, vue-tsc and Vite/PWA output generated. Added src/pwa-env.d.ts for missing existing virtual module declarations and explicit vi/afterEach test imports; strict configuration unchanged.
- npm run test:run: PASS, 13 files / 103 tests. Includes local-session invalid/missing storage, login/logout, root/unknown/private route behavior. No old profile request or crypto dependency.
- npm run test:coverage: PASS, statements/lines 95.28%, branches 84.09%, functions 71.79%; configured statements/branches 80% thresholds unchanged. Existing coverage configuration also includes generated dist files; not changed.
- npm run dev -- --host 127.0.0.1: PASS, Vite ready at port 5173 in 617 ms. HTTP 200 for /, /login, /app, main.ts, App.vue, router, both layouts, LoginView, AppHomeView and auth.store; no transform errors. Verification server stopped using its own PTY Ctrl-C; port no longer responds. This is module-transform smoke verification, not browser E2E or real backend login.
- Lint: NOT CONFIGURED; no lint script exists, so not run.
- git diff --check: PASS. Twenty-five protected source/config files compared byte-for-byte with baseline and unchanged. Dangling import/route scan clean; only historical finance comments remain in explicitly preserved main.css.
- Warnings: npm reports 11 vulnerabilities (6 moderate, 5 high), dependency deprecations and policy-blocked install scripts for esbuild/sharp/vue-demi. No audit fixes or policy changes. Vite warns toast.store is both statically and dynamically imported; build succeeds. Initial sandbox esbuild access-denied failures resolved through approved escalated verification.
- User-visible legacy login/branding and PWA configuration intentionally remain; bazar API integration is not implemented.
- Independent verification: PASS, scope met and no candidate-caused blocker found. Repeated `npm run test:run` and `npm run test:coverage`: 13 files / 103 tests; 95.46% statements/lines, 85.38% branches, 75.67% functions. Coverage includes generated dist under the unchanged configuration, so these are not isolated source coverage percentages.
- Parent spot check: `npm run build` PASS (TypeScript, Vite, and PWA generation). Initial sandbox access denial was resolved by running the same command with approved escalation and TLS=1; no source changes were required.
- Native review assessment: UNAVAILABLE. `gentle-ai review assess --cwd <frontend> --json` returned unknown command `review`. No review switch was enabled, no approval claimed; writer checks and independent verification are the evidence of record.
- Follow-up outside cleanup scope: browsers denying the localStorage API itself can still fail session initialization; this behavior already existed before cleanup. Auth integration should harden denied-storage handling. Existing tests cover malformed/missing stored content.
- Cleanup commit: pending. Staged authored change count (excluding generated package-lock.json): 303 additions + 23,003 deletions = 23,306 lines across the cohesive unit; 73 deleted files, 19 modified files, and 4 added files including this record. Covered by the approved size exception.
- Rollback boundary: revert the cleanup work-unit commit to restore the original frontend; backend is unrelated and unchanged.
- Memory mirror: `odd/frontend-cleanup/tasks`; repository locator: `odd/tasks/frontend-cleanup.md`.

## Next step

Create the authorized local cleanup commit, record its identity, and hand off the preserved shell for a separate bazar-auth/catalog/ventas task. Do not push.
