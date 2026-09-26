# Mode navigation and the mobile sale flow

Branch: `feat/mode-nav-and-mobile-sale-flow` (stacked on `fix/bound-account-skips-member-selector`). No push.

## Objective

1. **Navigation by mode.** Modo Venta shows only "Vender"; Modo Gestión shows Inicio, Productos, Vender and Reportes (socios), with a documented extension point for the sections that are coming.
2. **"Inicio" only in Modo Gestión**, enforced by the route guard and by the default landing of each mode.
3. **Sale screen on phones in two full-screen steps**, plus a grid/list toggle for the catalog.
4. **Remove "cambiar precio"** from the "Tu venta" summary.

## Decisions

### Part 2 — navigation by mode

- `NAV_ITEMS` stays the single, typed registry. "Inicio" and "Productos" now declare `modes: ['gestion']`; "Vender" has no `modes` (both). The header of `layouts/nav-items.ts` documents the extension point: a future section (Comisiones, Deudas) is one more row with `modes: ['gestion']` (and `socioOnly` if it is for socios), added **when its route exists**. Nothing is listed before that: an item without a screen would be a dead link.
- `AppHome` ("Inicio") declares `requiresGestion: true`. The guard sends anyone who lands there in Modo Venta to Vender.
- **One landing per mode**, `router/landing.ts` (`landingFor(mode)`): Venta → `Sale`, Gestión → `AppHome`. It is a pure function with no router or store imports, so the guard and the layout share it without a circular dependency. Every redirect that used to name `AppHome` by hand (already-logged-in visitors, context already ready, `requiresSocio`, `requiresGestion`) now goes through it. `Sale` requires neither role nor mode, so no redirect can loop.
- **Mode switch** (`AppLayout`): a watcher on the mode reacts to the CHANGE only (not to the startup value).
  - To Venta from a screen that requires Gestión (Inicio, Reportes) → Vender.
  - To Gestión from Vender → Inicio (the landing of Gestión).
  - Any other screen (Productos, Ajustes, ...) is not moved. `router.replace`, so no history entry points at a screen that the new mode does not offer.
- **Productos** is hidden from the Venta menu but its route is unchanged (it does not require Gestión): the catalog view already has a Venta rendering and nobody asked to block the URL. Only Inicio was asked to be Gestión-only.
- The role rules and the security fix (the member's role comes from the server binding) are untouched.

### Part 3a — the sale screen in two full-screen steps (narrow screens)

- **Breakpoint: the existing "small screen" one, unchanged.** `SMALL_SCREEN_QUERY` = `(max-width: 899.98px)` (`SMALL_SCREEN_MAX_WIDTH = 900`) from `useDeviceCapabilities`. It makes sense here: phones in portrait (≤ 430 px) and narrow tablets in portrait (~768 px, minus the 64 px collapsed sidebar) do not fit a catalog and a 21-26 rem cart side by side; from 900 px they do, which is what the wide layout already assumed. No second value was introduced: one definition of "narrow" for the whole app. The old layout used a raw CSS media query at 899 px; that is gone. The layout, the bar and the steps are now driven by one JS signal (`isSmallScreen`) and expressed as classes on the root (`sale-view--narrow`, `--checkout`, `--has-bar`).
- **Wide screens are untouched**: catalog + sticky cart side by side, no bar, no back control, no step. A stray `?paso=cobro` does nothing there.
- **Step 1**: catalog + search + scan (unchanged component). The cart collapses into a fixed bottom bar with the piece count and the exact total (`minorToDisplay`) and a **"Cobrar →"** button. **Empty cart → the bar is hidden** (rather than an "Agrega productos para vender" strip): a disabled button is a dead end and the space goes to the catalog. When the bar is shown the page reserves `6.5rem + safe-area-inset-bottom` at the bottom so it never covers the last catalog row.
- **Step 2**: the whole "Tu venta" (lines, total, cash, change, the real Cobrar) fills the content area (fixed overlay that respects the sidebar strip), with **"← Seguir agregando"** on top. `SaleCart` gets a `prominent` prop (presentation only): total 3.75 rem, change 3 rem, cash field 80 px tall with 40 px text, cash chips 56 px, Cobrar 72 px and sticky at the bottom; the lines go below. Total and cash come first.
- **State**: nothing is copied. The cart, the cash text and the catalog filters stay in their stores; going back never resets anything. The catalog stays mounted under Step 2 (so search, category and scroll survive) but is `inert` + `aria-hidden` while the overlay is open.
- **Back button (hardware/browser) → Step 1**: Step 2 lives in the URL as `?paso=cobro`. "Cobrar →" does `router.push({ query })`, so the phone's Back pops it and the screen returns to Step 1 instead of leaving the sale. "Seguir agregando" calls `router.back()` when this Step 2 was opened by our own push, and `router.replace` (drops the query) when the person arrived with `?paso=cobro` already in the URL (reload, link): there is no earlier entry to go back to.
- **Never an empty checkout**: Step 2 is shown only when the cart is not empty. If the last line is removed, "Vaciar" is used, or a new sale starts, a watcher drops `paso` from the URL (`replace`). A reload on `?paso=cobro` with an empty cart lands on Step 1 and cleans the URL.
- **Result flow**: unchanged. The result screen takes the whole screen; "Volver" (error results) returns to the same Step 2 with the cart intact; "Nueva venta" empties the cart and returns to Step 1.
- **Rotation / resize**: portrait → landscape while in Step 2 shows the side-by-side layout with everything intact; back to portrait returns to Step 2 if there is still a sale (the query is still in the URL), otherwise to Step 1.

### Part 3b — grid / list toggle for the sale catalog

- **Where**: inside `SaleCatalogPicker`, so it is in the Step-1 catalog area on phones AND in the catalog column of the wide layout (same component, same toggle). It sits in its own row under the category filter, aligned right, so it never squeezes the search + "Escanear" row on a 360 px phone.
- **Control**: a two-button group (`role="group"`, `aria-label="Vista del catálogo"`), each with an icon (decorative) and visible text — "Cuadrícula" / "Lista" — `aria-pressed` true/false, 44 px minimum targets. The active one is distinguished by fill, border and font weight, never by colour alone. Pressing the active view emits nothing.
- **Persistence**: `useSaleCatalogViewStore` (`stores/saleCatalogView.store.ts`), key **`la-marchanta-sale-catalog-view`** in `localStorage`, values `grid` | `list`. Device-level, like the UI mode. Default `grid` (the view that already existed); nothing is written until the person chooses. An invalid stored value is "no preference"; a throwing `localStorage` (private mode, quota) is swallowed: the view still changes, only persistence is lost.
- **List view**: compact 64 px rows (about eight visible on a phone) — thumbnail (3 rem, decorative image or 📦), name (ellipsis), availability badge, "En tu venta" mark with text, and the exact price (`$` + `minorToDisplay`) on the right. Each row is the SAME button as the card (same base class, accessible name, `aria-disabled` for sold out, click → `select`), so add-to-cart, sold-out and single-piece behaviour are identical. Availability is the simplified "Disponible / Agotado" of the large card (no stock counts).
- The presentational picker only receives `view` and emits `update:view`; the container owns the store.

### Existing tests changed (forced by the new rules)

- `SaleView.test.ts`: the block "barra del carrito en celular" tested the old bottom **sheet** (`sale-view__cart--open`, `open-cart`/`close-cart`, a bar that was always in the DOM and disabled when empty). That design is replaced by the two steps, so the block was replaced by "flujo de dos pasos en pantalla angosta" (wide unchanged, Step 1, Step 2, charging from Step 2, rotation, a11y). `mountSale` gained an optional path so a test can open `?paso=cobro`. Every other SaleView test is untouched and passes.

- `AppLayout.nav.test.ts`: "Modo Venta: Vender va primero" listed Vender, Inicio, Productos; now the Venta menu is only Vender.
- `router.test.ts` (4 cases): a redirect "to the app home" from `/app/reportes`, `/app/ajustes/equipo` and `/app/ajustes/dispositivos` in Modo Venta now lands on Vender (the home of that mode). In Modo Gestión it is still Inicio.
- `nav-items.test.ts`: the Venta expectations changed; new cases added. No other assertion was touched.

## Tasks

- [x] **P2** Navigation by mode, Inicio only in Gestión, landing per mode.
- [x] **P3a** Two full-screen steps on narrow screens.
- [x] **P3b** Grid/list toggle for the catalog.
- [ ] **P4** "Cambiar precio" in the cart summary.

## Evidence

- **P2:** RED first (`router.mode-landing.test.ts` failed on the missing `landing` module; 3 nav cases failed; 3 layout mode-switch cases failed). Then GREEN: full suite 117 files / 2167 tests, `npm run lint` clean, `npm run build` ok.
- **P3a:** RED first (22 of the new SaleView cases failed). Then GREEN: full suite 117 files / 2197 tests, lint clean, build ok (vue-tsc caught one typing slip in a test, fixed). Added: 26 SaleView cases for the two steps, 6 `SaleCart` cases for `prominent`, 2 contract tests for the Step 2 sizes in `touch-targets.test.ts`.
- **P3b:** RED first (the store file could not load; 18 new cases failed across SaleView, the picker and the touch-target contract). Then GREEN: full suite 119 files / 2242 tests, lint clean, build ok. Added: 11 store cases, 19 picker cases (`SaleCatalogPicker.view.test.ts`), 12 SaleView cases, 1 touch-target contract test. No existing test needed changes for this part.
- **Manual phone check still needed (jsdom does not lay out):** the bar never covers the last catalog row; the fixed overlay respects the 64 px sidebar strip and the safe area; the Step 2 total/cash/Cobrar sizes look right on a real phone; hardware Back returns to Step 1; rotating keeps the sale.
