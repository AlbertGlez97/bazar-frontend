# Mode navigation and aligned product grids

Make changing application mode a one-step navigation action, and keep product grid prices and availability aligned despite different product-name lengths.

## Scope and authorization

- Repository: `bazar-frontend`; feature branch: `fix/mode-navigation-and-grid-alignment`.
- Authorized: local frontend behavior, regression tests, recovery document, and one atomic Conventional Commit per part.
- Not authorized: push, merge, PR creation, remote/prod access, credentials, ownership/configuration changes.
- Preserve existing Spanish UI. Technical documentation and new technical comments use English.
- TDD: **true**, explicitly requested by the user; runner: `npm run test:run`. Observe RED before source changes, then GREEN and refactor.
- Delivery strategy: `ask-on-risk`; forecast: approximately 250–350 authored additions plus deletions across both work units, including this document. Monitor actual counts; request a chain decision before crossing roughly 400 authored changed lines.
- RDD: native output says off, but mode-status exits 1 due to unsafe Git ownership. Do not change ownership/configuration or invoke review without parent direction.

## Diagnosis and UX decision

The previous navigation change is already merged: commit `3f56f9bf93dc6648268803efdc0a0094489593e4`, with reflog evidence `e7d1c5f`. It was not lost or left unmerged. The current AppLayout watcher intentionally moves only from routes marked `requiresGestion` to Sale, or from Sale to AppHome. Products and Settings are deliberately excluded; the existing AppLayout mode-landing tests explicitly assert that they stay put.

Replace that conditional behavior with navigation to `landingFor(newMode)` on every actual mode change. Keep the watcher non-immediate, and preserve the switch's active-mode no-op and small-touch-screen confirmation.

Keep the single **Vender** sidebar link: its active state provides orientation, and it remains a useful return destination from Settings. The mode switch itself navigates immediately, so the link never requires a second click to complete a mode change.

Grid stretching must extend through SaleCatalogPicker's `li > button > ProductCard` wrappers, not only the outer grid. ProductCard already uses column flex; its body does not consume remaining space and its price has no automatic top margin.

## Tasks and acceptance

- [x] **T1 — Navigate immediately when the mode changes**
  - Add RED regressions using the actual UiModeSwitch and a memory router.
  - From Inicio, Productos, Reportes, Códigos QR, Incidencias, and Deudas, switching to Venta reaches Sale at `/app/venta`.
  - Switching from Venta to Gestión reaches AppHome at `/app`, including when currently in Settings.
  - Header title, mode badge, switch state, and sidebar active state match the settled route/mode.
  - Repeated clicks on the active mode do nothing; mounting does not redirect.
  - Retain Vender for orientation and returning from Settings; document its rationale.
  - GREEN focused regressions, then refactor; atomic commit: `fix(navigation): land on the selected mode immediately`.
  - Rollback boundary: AppLayout mode watcher and its focused navigation regressions; unrelated shell and grid behavior remain intact.
  - Evidence: RED 6/18 focused mode-landing failures; GREEN all 65 shell/switch regressions. Full T1 command: router initial /app test intermittently times out at 5000 ms (also fails supplemental --maxWorkers=1); no suppressed failures. Runtime browser check pending. Commit: this work unit, hash to be recorded in T2.

- [ ] **T2 — Align grid cards without changing list presentation**
  - Add RED structural/style regressions for management and sale grid variants.
  - Grid rows stretch cards to equal height; sale cell/button/card wrapper chain participates.
  - Grid card names clamp to two lines with overflow hidden/ellipsis.
  - Flex column body grows; price and availability stay anchored at the bottom.
  - Test short `ram ddr5` and a long ASUS motherboard name together.
  - List presentation, selection, availability, actions, and click behavior remain unchanged.
  - GREEN focused regressions, then refactor; atomic commit: `fix(catalog): align grid card prices and availability`.
  - Rollback boundary: grid-only CSS in ProductCard, ProductCatalogGrid, SaleCatalogPicker and associated alignment regressions.
  - Evidence: pending; commit: pending.

## Verification plan

| Scope | Exact command / scenario | Result |
| --- | --- | --- |
| T1 focused | `npm run test:run -- src/layouts/__tests__/AppLayout.mode-landing.test.ts src/layouts/__tests__/AppLayout.mode.test.ts src/layouts/__tests__/nav-mode-exclusivity.test.ts src/components/ui/organisms/__tests__/UiModeSwitch.test.ts src/router/__tests__/router.mode-landing.test.ts` | Pending RED/GREEN |
| T2 focused | `npm run test:run -- src/components/ui/organisms/__tests__/ProductCard.test.ts src/components/ui/organisms/__tests__/ProductCatalogGrid.test.ts src/components/ui/organisms/__tests__/SaleCatalogPicker.view.test.ts src/components/ui/organisms/__tests__/ProductCard.selection.test.ts src/components/ui/organisms/__tests__/ProductCatalogGrid.selection.test.ts` | Pending RED/GREEN |
| Final build | `npm run build` | Pending |
| Final lint | `npm run lint` | Pending |
| Final test suite | `npm run test:run` | Pending |
| Runtime | Local browser, desktop/tablet widths: all six routes → Venta → Gestión; compare short/long-name card bottom, price/badge baseline and two-line clamp in management/sale grids; check lists unchanged | Pending availability; no production login |

Browser layout proof is separate from jsdom structural checks, which cannot establish rendered heights. Report any unavailable visual check explicitly instead of claiming it passed.

## Progress and next step

- T1 implemented and focused shell/switch regressions pass (65/65); existing router import timeout remains reported.
- Parent read back both artifacts and authorized T1/T2 implementation.
- Mirror locator: `odd/tasks/mode-navigation-and-grid-alignment.md`; topic: `odd/mode-navigation-and-grid-alignment/tasks`.
- Running authored changed-line count: pending first work-unit commit.
- Next: T2 RED style regressions, then grid layout implementation and GREEN checks.

