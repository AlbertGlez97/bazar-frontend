# Frontend lint, dependency audit and publish

Add ESLint (Vue 3 + TypeScript, flat config) to the cleaned frontend, report `npm audit` without changing versions, and publish the existing local history to `origin/main` after safety checks.

## Authority and boundaries

- Authorized root: `bazar-frontend/`; do not change `bazar-api/`.
- Branch: `chore/remove-personal-finance` (commits `739731a`, `ca698bb`, `8cca68a`). Origin `https://github.com/AlbertGlez97/bazar-frontend.git` is already configured.
- Remote operations (`ls-remote`, `push`) are authorized in the request text, but the credential/session to use was not named: confirm before the first remote call.
- Never run `npm audit fix` or upgrade dependency versions. Audit is report-only until the user confirms.
- Never force-push. If the remote is not empty, stop and report.
- TDD: **on for the lint part** (source: user request, this session). Runner: `npm run lint` is the test (RED = missing script / reported errors, GREEN = clean). Regression runner: Vitest via `npm run test:run`.
- Native review: RDD reports `on (decided by default)` with global/clone unset. Change is style-only; assess via `gentle-ai review assess` if available, otherwise report unavailable. Do not enable or disable the switch.
- Delivery: `ask-on-risk`; forecast well under 400 authored lines (lockfile excluded).

## Tasks

- [x] **T01 — Configure ESLint flat config and `lint` script.** RED first: `npm run lint` fails because the script is missing.
- [x] **T02 — Fix lint findings (style/convention only).** No structural changes; `npm run test:run` and `npm run build` still pass.
- [x] **T03 — `npm audit` report (read-only).** 11 findings, unchanged: 6 moderate, 5 high, 0 critical. See Progress.
- [ ] **T04 — Pre-push verification.** `.gitignore` covers `node_modules`, `dist`, `.env` (not `.env.example`), `coverage/`; branch has the real history; status clean.
- [ ] **T05 — Publish to `origin/main`.** Blocked until credential is confirmed and the remote is verified empty.

## Acceptance and checks

- `npm run lint` exists and exits 0 on the whole repo.
- `npm run test:run`, `npm run build` unchanged in result (13 files / 103 tests baseline).
- `git diff --check` clean; conventional commits, one per work unit, tests/docs alongside.
- Push preserves the existing history (no "first commit" replacing it).

## Progress and evidence

- T03: `npm audit` (lockfile, `npm ci` OK, 652 packages). Direct: `@vitest/coverage-v8`, `vitest`, `exceljs`, `sharp`. Transitive: `@vitest/mocker`, `brace-expansion`, `browserslist`, `fast-uri`, `nanoid`, `postcss`, `uuid`. `--omit=dev`: 5 (3 moderate, 2 high). `exceljs` and `pdfmake` are not imported anywhere in `src/`; `sharp` is used only by `scripts/generate-pwa-icons.mjs`.
- Environment note: `NODE_TLS_REJECT_UNAUTHORIZED=0` is set in the shell (npm warns on every call).
- Git state at start: branch `chore/remove-personal-finance`, status clean, `origin` already configured to the target URL.

- T01: RED observed (`npm error Missing script: "lint"`). Installed devDependencies `eslint@10.11`, `eslint-plugin-vue@10.11`, `@vue/eslint-config-typescript@14.9`, `typescript-eslint@8.70`; lockfile diff vs HEAD: 108 packages added, 0 versions changed or removed. Config uses `withVueTs` (v14.9 API) with `pluginVue.configs['flat/recommended']` and `vueTsConfigs.recommended`; script `"lint": "eslint ."`. First run on the cleaned code (still RED, expected): 23 errors and 411 warnings in 21 of 50 files. 396 are Vue template formatting rules (`max-attributes-per-line` 268, `html-closing-bracket-spacing` 42, `*-element-content-newline` 48, `no-multi-spaces` 14, `attributes-order` 14, `html-self-closing` 10); the rest are 22 `no-explicit-any`, 1 `no-unused-expressions` and 15 `require-default-prop`.

- T01 commit: `9a35172` (`build: add eslint with vue and typescript flat config`). Native risk assessment (`gentle-ai review assess --base-ref 8cca68a --committed-only`): **medium** (`executable_change` on `eslint.config.js`); the native counter reports 1753 lines because it includes the generated lockfile (about 70 authored). Deferred to slice close per the medium-tier rule.
- T02 step 1: `eslint --fix` applied to 18 Vue templates (formatting rules only), commit `f5540ac` (`style: apply eslint autofix to vue templates`). Checks: `npm run test:run` 13 files / 103 tests, `npm run build` OK, `git diff --check` clean.
- T02 step 2: the remaining 38 findings (22 `no-explicit-any` in three test files, 1 `no-unused-expressions` in `AppModal.vue`, 15 `require-default-prop`) were fixed by hand by one delegated writer, without disabling rules or changing config: local interfaces replace `any` in tests, one ternary statement became `if/else`, and omitted optional props got explicit `undefined` defaults (the value they already had). Parent spot checks: `npm run lint` exit 0 (0 errors, 0 warnings), `npm run test:run` 13 files / 103 tests, `npm run test:coverage` exit 0 (96.13% statements/lines, 83.45% branches, 70% functions, thresholds unchanged), writer-reported `npm run build` OK.
- T04 partial: `.gitignore` already ignores `node_modules`, `dist`, `dist-ssr`, `.env`, `.env.*.local`, `coverage/` and keeps `.env.example` tracked (verified with `git check-ignore`); nothing added. Local `main` is at `739731a`, an ancestor of HEAD.
- **Discrepancy found**: the remote-tracking ref `origin/chore/remove-personal-finance` exists locally at `8cca68a`, so that branch was pushed or fetched at some point. The remote is therefore probably not empty; not yet verified because no remote call has been authorized.

## Next step

Close the slice: native review preflight for base `8cca68a` (three commits), then T04 status check and T05 only after the user decides on the non-empty-remote question and credential.

Memory mirror: `odd/frontend-lint-and-publish/tasks`; repository locator: `odd/tasks/frontend-lint-and-publish.md`.
