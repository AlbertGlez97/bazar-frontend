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

### Existing tests changed (forced by the new rules)

- `AppLayout.nav.test.ts`: "Modo Venta: Vender va primero" listed Vender, Inicio, Productos; now the Venta menu is only Vender.
- `router.test.ts` (4 cases): a redirect "to the app home" from `/app/reportes`, `/app/ajustes/equipo` and `/app/ajustes/dispositivos` in Modo Venta now lands on Vender (the home of that mode). In Modo Gestión it is still Inicio.
- `nav-items.test.ts`: the Venta expectations changed; new cases added. No other assertion was touched.

## Tasks

- [x] **P2** Navigation by mode, Inicio only in Gestión, landing per mode.
- [ ] **P3a** Two full-screen steps on narrow screens.
- [ ] **P3b** Grid/list toggle for the catalog.
- [ ] **P4** "Cambiar precio" in the cart summary.

## Evidence

- **P2:** RED first (`router.mode-landing.test.ts` failed on the missing `landing` module; 3 nav cases failed; 3 layout mode-switch cases failed). Then GREEN: full suite 117 files / 2167 tests, `npm run lint` clean, `npm run build` ok.
