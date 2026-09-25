# UI mode selector (Modo Venta / Modo Gestión)

Infrastructure for a "Modo Venta" / "Modo Gestión" selector: suggestion from device signals, manual switch, persisted preference, non-blocking warning, and a mode-aware layout of the EXISTING product catalog. The real sale screen (cart, payment, change) is out of scope.

## Authority and boundaries

- Authorized root: `bazar-frontend/`, branch `feat/ui-mode-selector` (from `main`). Commit locally only; no push (user will confirm).
- TDD: off (not requested this session); tests are written with each behavior and must pass. Runner: Vitest via `npm run test:run`.
- Native review: not started (review switch not toggled).
- Delivery: `ask-on-risk`; work-unit commits by concern.
- Route: delegated direct, one bounded frontend writer (reading prepared the writes).

## Decisions

- **Breakpoint**: small screen = viewport width < 900px (`(max-width: 899.98px)`), kept in one exported constant. No breakpoint utility exists in the project and none is added; `window.matchMedia` is enough.
- **Touch signal**: `matchMedia('(pointer: coarse)')` OR `navigator.maxTouchPoints > 0`.
- **Suggestion**: `isTouchDevice && isSmallScreen` → `venta`, otherwise `gestion`. Only the first-run default; a stored preference always wins and is never overwritten by the suggestion.
- **Persistence**: Pinia `stores/uiMode.store.ts`, localStorage key `la-marchanta-ui-mode`; the suggestion is stored immediately on first run. Invalid stored values are treated as "no preference".
- **Catalog adaptation**: `ProductCatalogGrid` gets a `mode` prop; the view (container) reads the store and passes it down, so the organism stays presentational and testable. `ProductCard` gets a `size` prop (`default` | `large`) instead of a duplicate component. Venta hides management actions for everyone (including socios), hides the inactive toggle and "+ Nuevo producto", enlarges cards and search. The collaborator rule (`isSocio`) is independent and unchanged.
- **Store init location (decided in T2)**: the store initializes itself when it is created (setup-store body, same pattern as `session.store`), not through a separate `init()` action called from `AppLayout`/`main.ts`. Whoever touches it first (`AppLayout` or the catalog view) already gets the final mode, so there is no mount-order requirement and the catalog can never render before init. The store uses the one-shot `suggestUiMode()` (no open `matchMedia` listeners).
- **Inactive products in Venta (decided in T3)**: the view never requests them. On mount, `includeInactive = isSocio && !isVenta && store.includeInactive`; if the mode flips to `venta` while "Mostrar inactivos" is on, the view turns the filter off and reloads page 1 with active products only. Returning to `gestion` needs no reload; the toggle comes back switched off (the store keeps a single `includeInactive`, so the previous toggle position is not remembered; accepted as a minor trade-off). The grid also hides the toggle and all management actions in `venta` on its own, even if the parent enables them (defense in depth).
- **Venta card content (T3)**: `ProductCard size="large"` shows name, price and a simplified availability badge (Disponible / Agotado, also for `tipo=cantidad`, so the exact stock count is not shown in Venta). No cost/supplier ever appears in either size.
- **Touch sizing (T3)**: `AppInput size="lg"` (already existed, 48px) plus a 56px override for the Venta search; `AppPagination` gained an optional `size: 'md' | 'lg'` prop (`lg` = 44x44 buttons) instead of a deep selector; both backward compatible, gestion visuals unchanged. Guard test `src/config/__tests__/touch-targets.test.ts` asserts the CSS contract (jsdom has no layout).
- **UiModeSwitch placement and API (decided in T4)**: it lives in `components/ui/organisms/` (not molecules) because it contains `AppModal`, and the barrel rules forbid molecules importing organisms. It also does not read the store (the barrel forbids stores in `ui/`; `MemberSelector` is presentational too): it takes `v-model` (`UiMode`) plus `compact` and `tone` props and `AppLayout` binds it to `useUiModeStore()`. Deviation from the brief, which suggested a molecule that reads the store.
- **Switch design**: a `role="group"` of two real `<button type="button">` with `aria-pressed`, visible labels "Venta" / "Gestión" (+ emoji icon, like the nav) and accessible names "Modo Venta" / "Modo Gestión"; each button `min-height/min-width: 44px`. Collapsed sidebar: `compact` = icon-only column of 44x44 buttons, names kept via `aria-label`.
- **Placement in layout**: a `sidebar__mode` block directly under the logo/toggle header row (the header row is fixed at 64px and too tight for a two-button control), not inside that row. The active-mode indicator is an `AppBadge` ("Modo Venta" amber filled / "Modo Gestión" gray) next to the page title in the top header.
- **AppModal**: unchanged. Its `footer` slot already allows the two explicit choices, so no API extension (and no separate commit) was needed. The warning uses `hide-close` (the 28px X would be a small target on the device that shows it); Escape and backdrop click count as "Mejor no". "Mejor no" is the primary button (safe choice highlighted), "Entiendo, quiero seguir" secondary, same size; nothing is blocked.
- **Warning**: non-blocking `AppModal` in `UiModeSwitch`, shown only when switching to `gestion` while touch + small screen. Copy in La Marchanta's voice; buttons "Entiendo, quiero seguir" / "Mejor no".
- **Touch targets**: every interactive element in Venta mode and the switch have a min 44x44px target.

## Tasks

- [x] **T1 — `useDeviceCapabilities` composable + tests.**
- [x] **T2 — `uiMode.store` + tests.**
- [x] **T3 — `ProductCard` `size` + `ProductCatalogGrid` `mode` + view wiring + tests.**
- [x] **T4 — `UiModeSwitch` molecule + `AppLayout` integration (switch and visible mode indicator) + tests.**
- [x] **T5 — Brand guidelines (non-blocking warning pattern) + this record.**
- [ ] **T6 — Final checks (build, lint, test) and manual browser pass.**

## Evidence

Commit hashes are recorded in the final record (T6), since a commit cannot contain its own hash.

- **T1**: `src/composables/useDeviceCapabilities.ts` (reactive `isTouchDevice` / `isSmallScreen`, exported `SMALL_SCREEN_MAX_WIDTH`, plus the non-reactive `detectDeviceCapabilities()` and `suggestUiMode()` that the store reuses), `src/types/ui-mode.types.ts` (`UiMode`, `isUiMode`), shared test helper `src/test/mockDevice.ts` (fake `matchMedia` + `maxTouchPoints`, since jsdom has neither). Observed: `npx vitest run src/composables` = 3 files / 30 tests passed; `eslint src` and `vue-tsc -b` clean.
- **T2**: `src/stores/uiMode.store.ts` (`currentMode`, `isVenta`, `setMode`; key `la-marchanta-ui-mode`; try/catch around every localStorage access). Observed: `npx vitest run src/stores/__tests__/uiMode` = 13 tests passed (venta on small touch, gestion on large non-touch, one-signal-only cases, no matchMedia, first-run persisted, saved preference respected and not rewritten, invalid value treated as absent, persists on change, survives store re-creation, throwing localStorage on read/write); `eslint src` and `vue-tsc -b` clean.
- **T3**: `ProductCard` `size`, `AppPagination` `size`, `ProductCatalogGrid` `mode`, `ProductCatalogView` wiring (`useUiModeStore`, hides "+ Nuevo producto" and inactive handling in venta), tests for card sizes, grid modes, view in both modes x both roles plus live mode switching, `AppPagination` tests, touch-target CSS guard. Observed: full `npx vitest run` = 52 files / 562 tests passed; `eslint .` and `vue-tsc -b` clean.
- **T4**: `UiModeSwitch.vue` (organism, exported from the barrel), `AppLayout` integration (switch + `AppBadge` indicator), `UiModeSwitch.test.ts` (warning on touch+small, confirm proceeds, cancel/Escape change nothing, venta never warns, no warning on large / touch-only / small-only / no matchMedia, same-mode click is a no-op, device re-evaluated at click time, compact names), `AppLayout.mode.test.ts` (switch rendered, indicator per mode, store + persistence, warning flow in the layout, collapsed sidebar), CSS guard extended for the switch, existing AppLayout test mocks extended. Observed: full `npx vitest run` = 54 files / 589 tests passed; `eslint .` exit 0; `vue-tsc -b` clean.
- **T5**: `doc/brand-guidelines.md` gained section 7 "Interacción" (mode selector behavior and catalog differences, the reusable non-blocking warning pattern with copy example, 44x44 touch targets) and the old section 7 code map became section 8 with rows for the store, composable, switch, catalog and the new guard test. Observed: no other file references the renumbered section; no code changed in this commit.

## Next step

Writer implements T1–T6 with one commit per task.
