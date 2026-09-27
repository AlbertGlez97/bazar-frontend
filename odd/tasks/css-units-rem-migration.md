# CSS units audit: px → rem where it should scale

Branch: `feat/css-units-rem-migration` (from `main` @ 19d93cc). Not pushed.

TDD: OFF (source: resolved by the assistant, no new behavior — pure 1:1 unit conversion of already-tested
values, same precedent as `frontend-cleanup`/`ui-mode-selector`). Verification: functional (build/lint/test)
at the close of each task, plus a manual accessibility zoom check. Runner: `npm run test:run` (Vitest, jsdom).

## Objective

Font sizes and spacing are hard-coded in `px` throughout the app, so nothing scales when a person increases
their system/browser text size (accessibility). Convert what should scale to `rem`, keep what should stay
physically fixed in `px` (hairline borders, decorative details, viewport-width media query breakpoints,
`BrandLogo`'s `size` prop API), and document the convention so new views don't reintroduce the same problem.
This is a prerequisite for the cash-denomination-selector feature (built on top of these tokens) and for the
already-reported cramped Paso 2 / sidebar-footer layout issues.

## Scope (evidence from a full-repo audit, 328 `px` occurrences across 65 files)

- **A) Typography** — `main.css` `--font-size-*` tokens (6 values) + standalone literals in components that
  don't use the token (`LoginView`, `AppModal`, `AppCard`, `AppLayout` nav icons, `UiModeSwitch`, `SettingsView`).
  Exception: `AppInput`/`AppSelect`/`AppTextarea`'s `font-size: 16px` is an iOS Safari anti-zoom requirement,
  not a design token — left untouched (converting it to `rem` could reintroduce the iOS zoom bug if the user
  shrinks their system font).
- **B) Spacing** — `main.css` `--spacing-*` tokens (6 values) + 4 magic-number paddings in `main.css` itself
  that don't use the existing token (`.btn`, `.input`, `.badge`, `.alert`) + literals in the same "outer
  layer" components as A, plus `InstallAppButton`, `AppTooltip`, `AppToast`, `AppAlert`, `AppPagination`,
  `AppKebabMenu`.
- **C) Layout dimensions** — `--sidebar-width`, `--sidebar-width-collapsed`, `--header-height`, modal/toast
  `max-width`, `ProductQrCard`'s QR box: all confirmed **fixed-panel dimensions, not viewport-relative** — go
  to `rem`, never `vw`/`%` (a sidebar or a QR code must not shrink with viewport width).
- **D) Icons/small UI (radius, spinners, avatars, btn-action)** — out of scope: not required by the task
  (only font-size and spacing were asked to become relative), left as `px` design decisions.
- **E) Borders/shadows/hairlines (1-3px)** — out of scope by design, stay `px` (~130-140 of the 328).
- **F) `100vh` without a `100dvh` fallback** — `AppLayout.vue` (`.app-layout`, `.app-main`), `PublicLayout.vue`,
  `AuthLayout.vue`, `SaleView.vue:341` (`calc(100vh …)`). The sidebar already has the correct fallback
  (`AppLayout.vue:309-310`, `height: 100vh; height: 100dvh;`) — replicate that exact pattern.
- **Out of scope, explicitly**: viewport media query breakpoints (`max-width`/`max-height` in `px`, e.g.
  `AppLayout.vue:444` `@media (max-height: 480px)` — converting it breaks
  `AppLayout.sidebar-footer.test.ts:172`, and breakpoints are a responsive-design threshold, not a
  typography/spacing token); `--radius-*` and other D-category decorative sizing; `BrandLogo`'s `size` prop
  (public API, `${size}px`, would break `BrandLogo.test.ts:33` and is a contract change, not a unit fix).
- **44×44px touch targets (WCAG 2.5.5)**: `src/config/__tests__/touch-targets.test.ts` already accepts both
  `px` and `rem` (converts `rem × 16` before comparing) — migrating these to `rem` is safe and never shrinks
  the physical target below 44px; if anything it grows with system font size, which is the desired direction.

## Rem mapping (px ÷ 16, same visual result at default zoom — no design-scale change)

`--spacing-xs/sm/md/lg/xl/2xl` → `0.25/0.5/1/1.5/2/3rem`. `--font-size-xs/sm/md/lg/xl/2xl` →
`0.75/0.875/1/1.25/1.5/2rem`. `--sidebar-width` → `15rem`, `--sidebar-width-collapsed`/`--header-height` →
`4rem`. `html { font-size: 16px }` stays as the anchor (never converted).

## Checklist

- [x] **U1** `main.css`: convert `--spacing-*`/`--font-size-*` tokens to rem; fix the 4 magic-number paddings
      (`.btn`, `.input`, `.badge`, `.alert`) to use the spacing tokens; convert `--sidebar-width`,
      `--sidebar-width-collapsed`, `--header-height` to rem. Route: direct inline (1 mechanical, understood file).
      Commit `27d58ac`. 124 files / 2357 tests green, lint clean, build ok.
- [x] **U2** Touch targets: convert every `min-width`/`min-height`/`height: 44px|48px|56px|40px` interactive
      control across the flagged files to rem (safe per `touch-targets.test.ts`). Route: delegated writer
      (2+ files). Commit `0b932f1`, 21 files. Writer cross-checked against `touch-targets.test.ts` itself
      (ground truth), found and fixed one file missing from the initial audit (`SaleResult.vue`), and left
      `TeamMemberList.vue`'s row height for U3 (not an interactive control under WCAG 2.5.5). Same 2357 tests
      green, lint clean, build ok.
- [x] **U3** Outer-layer components without tokens: route standalone font-size/spacing literals through
      `var(--font-size-*)`/`var(--spacing-*)` where a matching value exists, else a direct rem literal
      (`LoginView`, `AuthLayout`, `AppModal`, `AppCard`, `AppKebabMenu`, `AppToast`, `AppAlert`,
      `AppPagination`, `InstallAppButton`, `AppTooltip`, `SettingsView`, `AppLayout` nav-icon font-sizes,
      `UiModeSwitch`), plus C-category dimensions (modal/toast/tooltip max-width, kebab menu min-width, auth
      card, `TeamMemberList` row height) and the `InstallAppButton` install-modal `max-width` the writer
      flagged as ambiguous (resolved: convert, same as the other C-category widths). `ProductQrCard.vue`
      does not exist on `main` (it only exists on the unmerged `feat/qr-labels` branch) — left as a followup
      for whenever that branch merges, not blocking here. Route: delegated writer. Commit `0252fee`, 15 files
      + 1 follow-up edit. Same 2357 tests green, lint clean, build ok.
- [x] **U4** `100vh` → `100vh; 100dvh` fallback in the 5 remaining spots (F). Route: bundled with U3's writer
      (same "outer layer" files, `AppLayout`/`PublicLayout`/`AuthLayout`/`SaleView`). Bundled in commit
      `0252fee`.
- [x] **U5** Document the convention in `doc/brand-guidelines.md` (when rem, when px is fine, why the iOS
      16px input exception exists, why breakpoints stay px). Route: direct inline.
- [x] **U6** Verify: full-repo `eslint .` clean, `npm run test:run` 124 files / 2357 tests green (same total
      as before this feature touched anything — no test needed changing), `npm run build`
      (`vue-tsc -b && vite build`) exits 0, PWA precache regenerated (64 entries) with no new warnings beyond
      the pre-existing large-chunk notice (`pdfmake`/`exceljs`/`vfs_fonts`, unrelated). **Not performed, disclosed
      honestly**: the manual checks the task asked for (resizing a real/emulated 375-414px viewport, and
      simulating a larger system/browser text size to confirm the layout scales without breaking) — this
      environment has no browser to drive. These need a person to open the app in a real browser
      (DevTools device toolbar + the browser's font-size/zoom setting) before this is considered visually
      confirmed, not just unit-test-green.

## Acceptance criteria

No visual change at default zoom (1:1 px→rem mapping). `touch-targets.test.ts` and every other existing test
green without modification (or, if a test hard-codes a px value that must change, that change is documented
here with why). No `vw`/`vh`/`%` introduced for panel/content dimensions (C). Breakpoints, `--radius-*`, and
`BrandLogo`'s prop untouched.
