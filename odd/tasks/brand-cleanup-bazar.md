# Brand cleanup: Bazar

Remove the residual branding of the original finance project ("FinanzasApp") and its false claims, centralize the app name, make the logo a link, and fix two footer/security texts. Frontend only; `bazar-api` and `doc/` are untouched.

## Authority and boundaries

- Authorized root: `bazar-frontend/`, branch `main`. Commit locally only; no push.
- TDD: on for the behavior changes (source: user request, this session). Runner: Vitest via `npm test -- --run`. RED = failing assertion recorded below.
- Native review: not started (the review switch was not toggled). Evidence of record is the writer's checks plus the browser smoke.
- Delivery: `ask-on-risk`; well under 400 authored lines (lockfile excluded).
- Route: delegated direct, one bounded frontend writer.

## Decisions

- App name is `Bazar`, defined once in `src/config/app.ts` (`APP_NAME`, plus `APP_DESCRIPTION` for the manifest and meta description). No other constants.
- Build-time files: `index.html` uses `%APP_NAME%` / `%APP_DESCRIPTION%` placeholders replaced by a tiny inline Vite plugin (`transformIndexHtml`) in `vite.config.ts`, which imports the constants (`src/config/app.ts` was added to `tsconfig.node.json` `include`). The manifest uses the constants directly. Placeholders do not affect Vitest (it never loads `index.html`) or the PWA (verified in the built `dist/index.html` and `manifest.webmanifest`). `src/config/__tests__/app.test.ts` reads both files as text (`?raw`) and fails if a literal name comes back or the substitution is removed.
- Manifest description is honest (no finance or E2EE claims); `categories` becomes `business`, `productivity`; workbox cache renamed `bazar-api-cache` (old cache is simply abandoned).
- Package renamed to `bazar-frontend` in `package.json` and the two `name` fields of `package-lock.json` (diff verified to be exactly those two lines).
- Logo links: the auth layout logo goes to `/` (it used to point to `/login`, the page it sits on). The app shell logo goes to `/app`: `router/index.ts` gives `/` `meta.redirectIfAuth`, so a logged-in user opening `/` is bounced to `AppHome` anyway; linking `/app` skips the redirect hop.
- Finance leftovers beyond the brief: the `$` badge in the auth logo and in `public/favicon.svg` became the app initial (`B`); the sidebar logo emoji became the initial when collapsed.
- Login notice: `Sesión protegida con JWT · Contraseña cifrada con BCrypt` becomes `Tus datos de acceso se almacenan de forma segura.` The algorithm is not named: it gives end users nothing and attackers detail, and it was wrong (the backend uses Argon2id). It does not say "conexión segura" because that would imply HTTPS, false in dev.
- Auth layout footer (`Construido con NestJS · Vue 3 · PostgreSQL`) removed with its CSS; padding made symmetric (`24px 16px`) so the card stays centered.

## Tasks

- [x] **T1 — Centralize the app name and drop the FinanzasApp branding.** Commit `9a7e544`.
- [x] **T2 — Make the logos links (auth `/`, shell `/app`), remove the shell emoji.** Commit `209393c`.
- [x] **T3 — Fix the login security text and remove the stack footer.** Commit `960208f`.
- [x] **T4 — Real-browser smoke of both layouts against the running dev server.** Done, temporary fixture account torn down (0 leftover rows).
- [x] **T5 — Feature record.** This file, committed with the last commit.

## Known limits

- The PNG icons (`public/icons/192.png`, `512.png`, `maskable-512.png`, `apple-touch-180.png`) have a baked-in white `$` on blue. They cannot be edited here; they need to be regenerated from a new design (the SVG favicon already shows `B`).
- `src/assets/main.css` keeps two dead finance-era blocks (`.btn-help`, `.btn-export`, with comments about Dashboard/Presupuesto/Deudas and the annual financial report). Not part of this brief; they are unused.
- `src/services/__tests__/api.test.ts` uses `/budgets` as an arbitrary URL in a test fixture; left as is.

## Evidence

- RED (T1): with only `src/config/app.ts` in place, `src/config/__tests__/app.test.ts` and the layout tests failed on: `expected '<!doctype html>…' to contain '<title>%APP_NAME%</title>'`; `expected '<!doctype html>…' not to match /finanzas|e2ee|cifrado/i`; `expected 'import { defineConfig } from …' to contain 'from './src/config/app''`; `… to match /\bname:\s+APP_NAME\b/`; `expected '$FinanzasApp Construido con NestJS · …' to contain 'Bazar'`; `expected 'FinanzasApp' to be 'Bazar'`. 6 failed / 14 passed. Before the file existed: `Failed to resolve import "@/config/app"`.
- RED (T2): 5 failed: `expected '/login' to be '/'` (attribute href and click navigation, auth layout) and the three new `AppLayout.nav` logo tests (no `a.sidebar__brand`).
- RED (T3): 2 failed: `expected 'BBazar Construido con NestJS · Vue 3 …' not to match /NestJS|Vue 3|PostgreSQL|Construido con/` and `expected 'Sesión protegida con JWT · Contraseña…' to be 'Tus datos de acceso se almacenan de f…'`.
- Dev server: editing `vite.config.ts` restarted Vite in the same process; `http://127.0.0.1:5173/` answered 200 continuously and served `<title>Bazar</title>` and the substituted meta tags.
- Final checks (own exit codes): `npm run build` 0 (manifest shows `name`/`short_name` `Bazar`, description honest); `npm run lint` 0; `npm test -- --run` 0, 43 files / 304 tests (baseline 42 / 293).
- Browser smoke (Edge via Playwright, real API, temporary account `zz-contract` in context `e2e-contract`): 14/14 checks. `/login`: tab title `Bazar`, no BCrypt/JWT/NestJS/PostgreSQL, no `footer`, new text present; logo click goes to `/`; after login and context selection the shell logo reads `Bazar`, tab title `Bazar`, no `💰`; logo click from `/app/productos` goes to `/app`; collapsed logo is a link with `aria-label` `Bazar` and shows `B`; no uncaught page errors. Fixtures torn down: `rows left in e2e-contract: 0`.

## Next step

Regenerate the PNG icons (and optionally a real logo) to match the `B` badge; remove the dead `.btn-help` / `.btn-export` CSS in a separate cleanup.
