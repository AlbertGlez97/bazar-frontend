# Product-save errors, Vender in Gestión, sidebar footer

Branch: `fix/product-errors-nav-and-sidebar-footer` (from `main` @ e7d1c5f). No push.
Three bugs found on a real phone. Each has its own commit. Root causes below are backed by evidence; what only a phone can confirm is listed at the end.

## Bug 1 — "No pudimos guardar el producto. Intenta de nuevo."

### Evidence (real backend, isolated probe business, cleaned up afterwards)
- `POST /api/v1/products` with the exact JSON `ProductForm` builds (`unica`: `{name,tipo,unitPriceMinor}`; `cantidad`: `+initialStock`; full: `+category,purchaseCostMinor,supplier,notes`) -> **201** for a socio.
- Same request as a colaborador (shared login choosing a colaborador member, or a bound colaborador account) -> **403** `Only socios may access this resource`.
- 400 only for malformed data: non-integer price, empty-string `category`, unknown property. Price 0 and `purchaseCostMinor: null` are accepted.
- **Stale device id** (a device id that no longer exists in the database): `GET /products` (AuthGuard only) -> **200** with an empty list; `POST /products` (SocioGuard -> ContextGuard) -> **403** `Selection is not authorized for this context`.
- The backend log shows no 5xx around the attempts (Nest does not log 4xx). The dev database held no real product at all.

### Root cause
Two layers, both confirmed:
1. **The UI swallowed the reason.** `ProductCatalogView` had bare `catch { toast.error('No pudimos guardar el producto. Intenta de nuevo.') }` in create, update, deactivate, reactivate and the list/search/page loaders. Status and body were discarded, so a 403 and a 400 looked identical.
2. **Most likely trigger (matches the symptom "the catalog loads empty, creating fails"): a stale stored device.** `session.store.ts:88` defines `isDeviceIdentified = !!deviceId`, and logout deliberately keeps the device (`clearOnLogout` only clears the person). After the dev database was wiped and re-seeded, the phone still held the old `device_context`, so the identification form was skipped and every ContextGuard route answered 403 `Selection is not authorized for this context`. `GET /products` only needs AuthGuard, so the list kept working. This was the "revoked or reissued device has no recovery path" follow-up recorded earlier.
The colaborador hypothesis is weak: the catalog already hides "Nuevo producto" and the card actions for non-socios (`isSocio && !isVenta`, `:show-actions="isSocio"`); that behavior existed and is tested.

### What changed
- `src/utils/api-error.ts`: `describeApiError` (kind, status, message, detail) and `describeFailure(action, error)`. 403 "Only socios" and 403 "Selection is not authorized" have their own copy; 400 class-validator messages are mapped to friendly Spanish for known fields and the first raw message is shown for unknown ones (capped, never HTML); 404, 409 (server message when plain text), 5xx and network have their own copy. The HTTP code is appended for support: `(código 403)`. Never exposes tokens, headers or request bodies. An error that is neither network nor HTTP keeps the historical text (`… Intenta de nuevo.`) with no code.
- `ProductCatalogView`: every action reports the real reason. On `context-lost` a persistent warning appears with a button "Volver a identificar este dispositivo" that clears the stored device and person and goes to `SelectContext`. **Nothing is cleared automatically** (queued offline sales keep their own device id).
- Read-only note for non-socios in Modo Gestión: "Solo los socios pueden cambiar el catálogo." (the hidden actions already existed).
- Copy lives in `VOICE.apiErrors` (`src/config/voice.ts`).

### Decisions
- Recovery is user-initiated: a generic 403 handler in the Axios interceptor was NOT added (a 403 also means "colaborador on a socio-only endpoint"). Only the catalog view offers the recovery today; other ContextGuard screens would need the same treatment (follow-up).
- Read-only catalog for non-socios reuses `session.member.role`, the same source as the nav and the route guards.

## Bug 2 — "Vender" shown in Modo Gestión

### Root cause
`src/layouts/nav-items.ts`: the "Vender" row was declared **without `modes`**, and the filter treats a missing `modes` as "all modes" (`!item.modes || item.modes.includes(mode)`). It was introduced by `6b38799` (sale screen, 2026-09-25) with `order: { venta: 1, gestion: 3 }`, and the previous Part 2 commit (`3f56f9b`) removed Inicio/Productos from Venta but kept "Vender" common on purpose (its tests even asserted "Vender siempre está a la vista, en cualquier modo"). There is ONE place that builds the menu (`AppLayout.vue`, `navItems` computed -> `getNavItems`); no mobile bottom bar or drawer variant exists, so the source fix covers every layout.

### Fix (at the source, not visual)
- "Vender" now declares `modes: ['venta']`. Every row must declare `modes` (a test fails if one is missing: omitting it is exactly how this slipped in).
- Modo Gestión: Inicio, Productos, Reportes (socio only). Modo Venta: only Vender.
- Route policy unchanged: `/app/venta` stays reachable by URL in Gestión; switching Venta -> Gestión while on Vender already lands on Inicio (existing watch in `AppLayout`).

### Existing tests changed (they pinned the wrong behavior)
`nav-items.test.ts`, `AppLayout.nav.test.ts` (Gestión menu, "Vender siempre a la vista", link count x2, active link in /app/venta now under Modo Venta), `AppLayout.mode-landing.test.ts` (Gestión menus), `AppLayout.test.ts` (`navItems`). New: `nav-mode-exclusivity.test.ts` (registry contract, both modes, socio/colaborador, mode switch, sidebar collapsed/expanded).

## Bug 3 — sidebar footer disappears when expanded

### Root cause (from code and history; the final confirmation needs a phone)
`src/layouts/AppLayout.vue` `.sidebar { height: 100vh; overflow: hidden }` (line ~305, from the baseline `739731a`) plus the phone overlay `@media (max-width: 767px) .app-layout:not(.app-layout--collapsed) .sidebar { position: fixed; top: 0 }` introduced by **`42cceab`** ("start the sidebar collapsed on phones and overlay it when expanded"). On a mobile browser `100vh` is the height with the address bar HIDDEN, taller than what is visible. A `position: fixed` sidebar of that height has its bottom edge below the visible screen, and because the sidebar is `overflow: hidden` and fixed there is no way to scroll to it. The footer (profile, gear, sign out) is the last item of the column, so it is what disappears. Expanded is the only state that is `fixed`; the collapsed strip is `sticky` in the grid and the page scroll hides the address bar, which is why collapsed looked fine.
Ruled out with evidence: the DOM is already right (footer is a sibling AFTER `.sidebar__nav`, nav is the scroll owner), `--app-sidebar-offset` only feeds the sale bars (`SaleView.vue:382,402`), and their z-index (30/40) is below the overlay (60), so stacking is not the cause. The recent sale-screen and nav commits did not change `.sidebar` height/overflow.

### Fix
- `.sidebar`: `height: 100vh` kept only as a fallback, then `height: 100dvh` (visible viewport).
- Phone overlay: `top: 0; bottom: 0; height: auto` (anchored to the visible viewport, no fixed height).
- `.sidebar__nav`: `min-height: 0` (only the nav shrinks/scrolls); header, mode switch, install and footer are `flex-shrink: 0`.
- Footer (expanded and collapsed/stacked) adds `env(safe-area-inset-bottom)` padding.
- `@media (max-height: 480px)` (phone in landscape): the "Instalar app" block is hidden so mode switch, nav and footer fit.
- Sale bars and `--app-sidebar-offset` untouched.

### Tests
`AppLayout.sidebar-footer.test.ts`: DOM structure (footer sibling after the nav, present expanded and collapsed, both modes, accessible names) and a CSS contract read from the SFC source (`?raw`), because jsdom does no layout: dvh with vh fallback, overlay anchored top+bottom, nav owns the scroll with `min-height: 0`, non-shrinking siblings, safe-area padding, the landscape rule, only `.sidebar` clips, sale bars stay under z-index 60, offset unchanged. RED first: 11 contract tests failed, the 5 structure tests already passed (the structure was right; the sizing was the bug). No headless browser is available in the repo tooling, so no real layout run.

## Checklist
- [x] Bug 1 util + view + tests (`881d194`)
- [x] Bug 2 (`d6b6322`)
- [x] Bug 3

## Evidence
- Bug 1: `api-error.test.ts` (38 cases) and `ProductCatalogView.errors.test.ts` (22 cases) RED first (module missing / 18 failing), then GREEN.

## Needs a phone to confirm
- That the toast on the failing phone shows "(código 403)" and the "no reconocido" text (proves the stale-device diagnosis on that phone), and that the "Volver a identificar este dispositivo" button leads to the identification screen.
