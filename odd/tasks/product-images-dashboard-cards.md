# Contained product images and responsive dashboard cards

Improve catalog image containment and the management dashboard presentation without changing business data, permissions, or API contracts.

## Scope and constraints

- Authorized: shared ProductCard presentation, CSS regression contracts, dashboard card/grid presentation and their tests.
- Preserve product actions, selection, availability, dashboard labels, links, notes, permissions, summary loading and comparison calculations.
- Use existing brand tokens from `doc/brand-guidelines.md`; retain Spanish UI copy.
- Local frontend only. No production access, remote execution, push, pull request or API changes.
- TDD: **on**, explicitly requested by the user. Runner: `npm.cmd run test:run`. Observe RED before source changes, then GREEN and refactor.
- Feature branch: `fix/product-images-dashboard-cards`; initial boundary: `7d21c73`.
- Delivery strategy: `ask-on-risk`. Forecast: approximately 200-350 authored additions plus deletions, excluding generated files. Reassess actual totals before commits; ask before exceeding the delivery budget.
- One atomic Conventional Commit per part, tests and related documentation together, no AI attribution.

## Findings

- Grid sizes are `default` (Products) and `large` (Sale); rows use `list`.
- `ProductCatalogGrid.vue` and `SaleCatalogPicker.vue` both render the same ProductCard.
- Aspect ratio, image width/height, `object-fit: cover` and card-level clipping are already shared; only list sets a fixed thumbnail width/height. The premise that all containment is list-only is not supported by the code.
- Shared media has no clipping or minimum-size reset. Validate intrinsic-image sizing in a browser before claiming the exact failure mechanism or fix.
- Dashboard currently caps content at 60rem and uses 14rem auto-fill columns. AppStatCard is used only by AppHomeView; existing Lucide icons and semantic tokens are available.

## Tasks

- [x] **T1 — Contain extreme product images in both catalogs.** Add failing CSS contracts for the shared grid/default and large media protection, retain list coverage, then repair the shared media using the existing aspect-ratio/object-fit/clipping recipe. Audit every ProductCard consumer. Observe focused GREEN and verify Products grid/list and Sale grid/list with the same extreme-image fixture where local browser tooling permits.
  - Acceptance: image cannot expand media/card/layout; default square, large 4:3 and fixed list thumbnails remain intact; no catalog behavior changes.
  - Checks: `npm.cmd run test:run -- src/config/__tests__/image-containment.test.ts src/components/ui/organisms/__tests__/ProductCard.test.ts src/components/ui/organisms/__tests__/ProductCatalogGrid.test.ts src/components/ui/organisms/__tests__/SaleCatalogPicker.test.ts src/components/ui/organisms/__tests__/SaleCatalogPicker.view.test.ts`.
  - TDD RED: focused image-containment command observed 1 failing new shared-media contract (`max-width` undefined) and 8 passing tests before source changes. Initial sandbox attempt could not read Vitest config; escalated retry produced the genuine assertion failure.
  - TDD GREEN: exact five-file focused command above passed 5 files / 93 tests after shared-media clipping, max-width and min-height reset; default/large aspect ratios and fixed list dimensions preserved.
  - Visual: parent CUA inspected screenshots and measured the same synthetic 120x12000 SVG in actual ProductCatalogGrid/SaleCatalogPicker. Baseline: both grids failed (195.8x19583.8 media); both lists passed (44x44). After fix, all four passed wide (Products 195.8x195.8; Sale 195.8x146.9; lists 44x44) and narrow 390px iframe (Products 340x340; Sale 340x255; lists 44x44). The user's original production image was not supplied; this is synthetic extreme-image proof, not that exact asset.
  - Rollback: ProductCard media CSS and its image-containment regression tests only; does not remove dashboard work.
  - Independent T1 verifier: PASS 93 tests / 5 files; lint exit 0 (two temporary harness warnings only). Parent spot check: image contract 9 passed. Native risk assessment unavailable; no native approval claimed. Commit identity: `ff92d8d23d94c6a4b19c460def79b5ea6f4a0731` (65 additions, 1 deletion including initial feature document).

- [x] **T2 — Make management summary cards responsive and distinctive.** Add failing tests for decorative per-metric icons and responsive grid/card contracts, then improve width use, surfaces, hierarchy and metric identity with existing tokens. Keep mobile single-column stacking. Omit new trend semantics if they would require altering business logic.
  - Acceptance: five metrics use available wide-screen space; narrow screens remain vertically stacked without overflow; icons are decorative; exact existing labels, links, notes and values survive.
  - Checks: `npm.cmd run test:run -- src/components/ui/molecules/__tests__/AppStatCard.test.ts src/views/__tests__/AppHomeView.test.ts src/config/__tests__/dashboard-presentation.test.ts src/config/__tests__/brand-tokens.test.ts src/config/__tests__/no-hardcoded-colors.test.ts`.
  - Visual: parent CUA inspected real AppHomeView with a local mocked summary, no backend calls. PASS at iframe1438px: 5 columns (268x230 cards); 1098px: 3 columns (345px cards); 389px: 1 column (342px cards). No content overflow; existing values, notes and link labels present. Synthetic summary, not production data.
  - Rollback: AppStatCard/AppHomeView presentation and corresponding tests only; summary service/types/stores/computations remain untouched.
  - TDD RED: exact five-file command observed 4 new failures (optional icon wrapper, five distinct icons, responsive width, card shrink/depth contracts) and 142 passing tests before source changes.
  - TDD GREEN: exact focused command passed 146 tests / 5 files. Values, routes, permissions, error/loading behavior and profit notes remain covered by existing tests.
  - Independent T2 verifier: PASS 146 tests / 5 files; lint exit 0 with no warnings; build exit 0 with advisories only. No blocking concerns; data/computations unchanged. Parent spot check: dashboard-presentation 2 passed. Native assessment unavailable; no native approval claimed. Code/proof commit: `8194f63df1a7c891655161ccbd5e1b87213ccb59`; amended once with documentation-only closure. The resulting final identity is recorded in parent memory/delivery, avoiding a self-referencing hash.

## Final checks

- [x] `npm.cmd run lint` — exit 0, no warnings after source normalization and temporary harness cleanup.
- [x] `npm.cmd run build` — exit 0; Vite advises about existing large export chunks and static/dynamic imports of toast.store.
- [x] `npm.cmd run test:run` — exit 0, 167 files / 3094 tests passed on normalized delivered source. Existing test-router missing-route warnings remain non-failing.
- [x] Record authored counts and commit evidence: T1 66 changed lines; T2 160 changed lines including documentation closure; running work-unit count 226. Branch net diff: 208 authored additions plus deletions. No generated files delivered; within initial delivery forecast. T1 final identity and T2 code/proof identity recorded above; amended T2 final identity belongs in parent memory/delivery.
- [ ] Engram mirror full readback pending: parent saved observation #189, but project ambiguity prevents retrieval. Local doc readback confirmed; update mirror after each observed task outcome when available.

## Progress and next step

Both tasks independently verified and committed with RED/GREEN and local synthetic visual proof. Final lint/build/full suite passed on normalized delivered bytes (167 files, 3094 tests). Own temporary harness files removed and own Vite session stopped after visual proof. No push is authorized. Original production image validation remains a manual follow-up because that asset was not supplied; Engram full mirror readback remains pending as documented above.
