# Brand: La Marchanta

Give the product its final identity ("La Marchanta") instead of a text swap: design tokens, typography, a typographic logotype with regenerated icons, a voice, a complete landing, and the registration form for the new backend contract (with VeeValidate + Zod). Frontend only; `bazar-api` and `doc/api-contract-for-frontend.md` are untouched.

## Authority and boundaries

- Authorized root: `bazar-frontend/`, branch `main`. Commit locally only; no push.
- TDD: on for behavior changes (source: user request). Runner: Vitest via `npm test -- --run`. RED = failing assertion recorded below.
- Native review: not started (review switch not toggled). Evidence of record is the writer's checks plus the browser passes.
- Delivery: `ask-on-risk`. The feature is far over 400 authored lines in total (heuristic only), split into 8 work-unit commits by concern; no PR was opened.
- Route: delegated direct, one bounded frontend writer (the backend is a parallel writer, not touched).

## Decisions

- **Brand definitions** are in `doc/brand-guidelines.md` (written before touching components): palette with WCAG ratios, typography, logo rules, voice, forms, code map.
- **Palette**: market-inspired, warm neutrals (crema/cafe), terracota `#b8501c` as the action color, maiz `#f0b429` as accent, nopal `#2f6b3f` for success, chile `#b3261e` for errors only, talavera for info only, rosa `#d81b75` decorative only. Semantic `--color-*` tokens over a raw scale in `main.css`; components use only semantic tokens.
- **Typography**: Bricolage Grotesque 700/800 (display: logotype and h1-h3) + Figtree 400-700 (text), loaded from Google Fonts in `index.html` (preconnect, `display=swap`, used weights only; SW already caches Google Fonts). No npm dependency.
- **One source for theme color**: `THEME_COLOR` / `BACKGROUND_COLOR` in `src/config/app.ts` feed `<meta name="theme-color">`, the mask icon (via a `%THEME_COLOR%` placeholder in the existing inline Vite plugin) and the manifest; `brand-tokens.test.ts` asserts they equal `--color-primary` / `--color-bg`.
- **Logo**: `BrandLogo.vue` (isotype = 4-stripe maize/cream awning with scallops over a terracota tile + an M; name in the display face). Icons regenerated from `public/favicon.svg` with Edge via Playwright (generator kept in the scratchpad, not in the repo). Maskable/apple-touch use the safe-zone padding on a dark `#2b1d14` backing so the cream stripes stay visible.
- **Layouts**: new `PublicLayout` (awning, logo, footer) wraps `/`, `/registro-negocio`, `/seleccionar-contexto` (URLs and route names unchanged). `AuthLayout` drops the dark developer-blue theme for warm paper.
- **Landing**: every claim maps to something the API does today; removed "works offline", "reports" and "audit" claims. The simulated contact form (it said "we received your message" and sent nothing) was deleted with its tests. Origin of the name explained without clichés.
- **Voice**: tuteo (the PWA toast had voseo), errors say what happened and what to do, one light Mexican touch per screen. Unauthorized device stays honest: "Este dispositivo no está registrado con nosotros todavía. Contacta a soporte." (no promise of a way to add devices). Sale-success pattern is `saleSuccessMessage()` in `src/config/voice.ts`.
- **Guard tests**: contrast of every documented token pair (`brand-tokens.test.ts`), no hard-coded colors in any `.vue` (`no-hardcoded-colors.test.ts`), placeholder/border/focus a11y. Vitest needed `css: { include: [/assets\/main\.css/] }` to read `main.css` as text (`?raw` returned an empty string otherwise).
- **Registration (scope change: Kickbox dropped)**: contract `{ nombreNegocio, nombre, apellidos, correo, telefono? }`. VeeValidate 4.15.1 + `@vee-validate/zod` 4.15.1 (`toTypedSchema`) + zod 3.25.76. Chosen because vee-validate stable does not support Standard Schema (only the 5.0 beta does; beta not adopted) and the adapter peers on zod ^3.24. Phone: normalize separators then `^(?:(?:\+?52)1?)?[2-9]\d{9}$` (IFT numbering plan, 10 digits since 2019-08-03; sources in the guidelines and the schema comment), cross-checked against `libphonenumber-js` `isValidPhoneNumber(x,'MX')` in a scratch script (18 cases, same verdicts except the legacy `+52 1`, tolerated here). No library added. The value sent is what the person typed, trimmed; blank `telefono` is omitted.
- **Validation modes**: blur first; re-validate on input once a field has an error or after a submit attempt (`defineField` lazy config); submit refused with errors, focus to first invalid field. Server 400 about the correo shows under the field with the brand text (server text is English); everything else shows `VOICE.genericError` / `VOICE.networkError`.
- **VeeValidate + Zod as standard**: yes for NEW forms; existing forms (`LoginView`, `ProductForm`, `DeviceIdentifyForm`) are not migrated unless touched for another reason. Rationale in the guidelines.

## Tasks

- [x] **T1 — Tokens, typography, theme color, component migration.** Commit `d75f90e`.
- [x] **T2 — Logotype, favicon, PWA icons, branded layouts, no-hardcoded-colors guard.** Commit `89a415f`.
- [x] **T3 — Complete landing in the brand voice.** Commit `4a92d8c`.
- [x] **T4 — Voice rewrite of the app texts + `voice.ts`.** Commit `aba92f8`.
- [x] **T5 — Add vee-validate, @vee-validate/zod, zod.** Commit `0ad79b6`.
- [x] **T6 — AppInput `aria-invalid` / `aria-describedby`.** Commit `01ce567`.
- [x] **T7 — Registration form for the new contract.** Commit `36a1bdd`.
- [x] **T8 — Visual passes with Edge, fixtures torn down.** Done (below).
- [x] **T9 — Brand guidelines and this record.** Committed with the last commit.

Route per task: all delegated-direct as one writer (mapping and reading were part of the write). Assessed tier / review outcome per task: not assessed (review switch not toggled).

## Known limits

- The live `POST /business-registration` is intentionally not exercised here (the parent verifies it against the live API); the browser pass intercepted the request.
- `AppLayout` is not responsive below the sidebar breakpoint (pre-existing).
- `AudienceSection` and `LandingStory` copy is untested by real users; the quote and tone are a proposal.
- The PNG icons cannot be verified on real iOS/Android masks here; they were checked visually and by dimensions/color type (192/512 RGBA transparent corners; maskable and apple-touch opaque RGB).
- `sharp` (devDependency) was not used; icons were rendered with Edge.

## Evidence

- RED (T1): first attempt failed for the wrong reason: Vitest returns `''` for `main.css?raw` (`Token --color-text is not defined in main.css`, 61 failures). After `css.include` in `vitest.config.ts`: `no-hardcoded-colors.test.ts` failed 20 files, e.g. `../../components/ui/atoms/AppAvatar.vue hard-codes colors: #2563eb, #7c3aed, #db2777, #dc2626, #d97706, #059669, #0891b2, #4f46e5, #fff`, `AppButton.vue hard-codes colors: #fff, rgba(, ... #ca8a04`, `AppToast.vue ... #ca8a04`.
- RED (T2/T3/T4): after the barrel/tests moved, 14 files failed on the old texts, e.g. `AppLayout.nav ... con el sidebar colapsado ... expected 'M' to be ''` (logo), `AuthLayout ... el logo es un enlace ... .auth-logo__badge`, `auth.store ... expected 'Usuario o contraseña incorrectos'`, `LandingView ... ¿Tienes dudas antes de empezar?`.
- RED (T7): `src/validation/__tests__/business-registration.schema.test.ts` → `Failed to resolve import "@/validation/business-registration.schema"`. Form tests first failed because VeeValidate debounces schema validation (~5 ms): `expected '' to be 'Escribe tu nombre.'` (19 failures) until the tests waited for it (helper `settle`).
- Dev server: editing `vite.config.ts` restarted Vite in the same process; `http://127.0.0.1:5173/` answered 200 right after and served `<title>La Marchanta</title>` and `theme-color` `#b8501c`. It was never stopped or started by the writer.
- Browser passes (Edge via Playwright, real API, temporary account `zz-contract` in context `e2e-contract`): landing, login (+errors), register (+errors, pending, success; POST intercepted), select-context (device, 403, members) and app shell (home, products, collapsed, product modal) at 1280 and 390 px; fonts confirmed loaded (`Bricolage Grotesque 700/800`, `Figtree 400-700`); no horizontal overflow; no uncaught page errors. Issues found and fixed after looking: header date capitalized "De" (now "24 de septiembre de 2026"), collapsed sidebar toggle clipped (header stacks), placeholders below AA (`opacity .7` removed, subtle token), input borders 1.3:1 (now `--color-border-strong` 4.07), hero heading orphan word (`text-wrap: balance`). Fixtures torn down: `rows left in e2e-contract: | 0`.
- Final checks (own exit codes): `npm run build` 0; `npm run lint` 0; `npm test -- --run` 0, 48 files / 500 tests (baseline 43 / 304).

## Next step

Verify the registration submit against the live API (backend contract), and build the sale view using `saleSuccessMessage()`.
