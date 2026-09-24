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
- [ ] **T02 — Fix lint findings (style/convention only).** No structural changes; `npm run test:run` and `npm run build` still pass.
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

## Next step

T02: run `eslint --fix` for the formatting rules, then fix the remaining findings by hand without disabling rules.

Memory mirror: `odd/frontend-lint-and-publish/tasks`; repository locator: `odd/tasks/frontend-lint-and-publish.md`.
