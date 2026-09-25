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
- **Warning**: non-blocking `AppModal` in `UiModeSwitch`, shown only when switching to `gestion` while touch + small screen. Copy in La Marchanta's voice; buttons "Entiendo, quiero seguir" / "Mejor no".
- **Touch targets**: every interactive element in Venta mode and the switch have a min 44x44px target.

## Tasks

- [x] **T1 — `useDeviceCapabilities` composable + tests.**
- [x] **T2 — `uiMode.store` + tests.**
- [ ] **T3 — `ProductCard` `size` + `ProductCatalogGrid` `mode` + view wiring + tests.**
- [ ] **T4 — `UiModeSwitch` molecule + `AppLayout` integration (switch and visible mode indicator) + tests.**
- [ ] **T5 — Brand guidelines (non-blocking warning pattern) + this record.**
- [ ] **T6 — Final checks (build, lint, test) and manual browser pass.**

## Evidence

Commit hashes are recorded in the final record (T6), since a commit cannot contain its own hash.

- **T1**: `src/composables/useDeviceCapabilities.ts` (reactive `isTouchDevice` / `isSmallScreen`, exported `SMALL_SCREEN_MAX_WIDTH`, plus the non-reactive `detectDeviceCapabilities()` and `suggestUiMode()` that the store reuses), `src/types/ui-mode.types.ts` (`UiMode`, `isUiMode`), shared test helper `src/test/mockDevice.ts` (fake `matchMedia` + `maxTouchPoints`, since jsdom has neither). Observed: `npx vitest run src/composables` = 3 files / 30 tests passed; `eslint src` and `vue-tsc -b` clean.
- **T2**: `src/stores/uiMode.store.ts` (`currentMode`, `isVenta`, `setMode`; key `la-marchanta-ui-mode`; try/catch around every localStorage access). Observed: `npx vitest run src/stores/__tests__/uiMode` = 13 tests passed (venta on small touch, gestion on large non-touch, one-signal-only cases, no matchMedia, first-run persisted, saved preference respected and not rewritten, invalid value treated as absent, persists on change, survives store re-creation, throwing localStorage on read/write); `eslint src` and `vue-tsc -b` clean.

## Next step

Writer implements T1–T6 with one commit per task.
