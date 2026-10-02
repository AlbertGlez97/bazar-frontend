# In-app help grounded in shipped workflows

Provide a searchable Spanish help manual inside La Marchanta, available to both roles and modes, with contextual cash guidance that does not interrupt an active sale.

## Authorization and delivery

- Repository: `bazar-frontend`; starting boundary: `a6c6e395b309200e801d47ac3809c4b03a96966a` on clean main.
- Feature branch: `feat/in-app-help`; recovery locator: `odd/tasks/in-app-help.md`; mirror topic: `odd/in-app-help/tasks`.
- Authorized: local help content, page/search, shared entry point, contextual cash disclosure, behavior tests, recovery document, and atomic Conventional Commits.
- Not authorized: push, merge, PR creation, deployment, network/prod access, credentials, permissions or ownership changes, unrelated business behavior.
- TDD: **true**, explicit user request in this session; runner: `npm run test:run`. Each behavior starts with observed RED, followed by GREEN and refactor.
- Artifact language: English technical planning, identifiers, tests and comments. The user explicitly requested **Spanish neutral** for manual text and user-facing UI documentation.
- Delivery strategy: `ask-on-risk`. Forecast **650–900 authored additions plus deletions**, including content, presentation, tests and recovery updates; generated files excluded.
- User selected chain_strategy `feature-branch-chain`: keep feature integration local until all units are ready. Proposed child slices follow the previous slice; no PR creation or main integration is authorized.
- The 400-line per-task heuristic is advisory, not a reason to omit tests, compress prose/code or create artificial abstractions. Record actual work-unit counts and eventual slice boundaries.
- RDD remains user-owned; parent owns native read-only mode/risk decisions. Do not enable review or bypass unavailable checks.

## Evidence and architecture

The parent completed the frontend/business audit and delivered a short summary before authorizing implementation. The manual must describe that audited contract, not imagined features. Keep internal source evidence references separate from reader-facing copy.

Prepared source reads:
- `src/layouts/AppLayout.vue`: shared authenticated shell/header, mode badge and route-title map; help belongs in the shared header, not the mode-specific sidebar menu.
- `src/router/index.ts`: common app parent requires authentication/context; role/mode restrictions are explicit child metadata.
- `src/components/ui/organisms/SaleCart.vue`: native details already used for cart lines; CashInput remains mounted inside checkout.
- `src/components/ui/molecules/CashInput.vue`: denomination counts live locally; a route change unmounts and loses the selection. Inline disclosure must not unmount or re-key CashInput.
- `src/components/ui/molecules/CashDenominationPad.vue`: existing denominations and pad behavior are the source of truth.
- Existing shell, router, CashInput and SaleCart tests provide the integration patterns.

Use a typed static content module and local accent-insensitive search over titles, keywords and steps. Plain text and Vue interpolation avoid `v-html`, Markdown parsing, remote content and new dependencies. Keep stable section IDs for deep links.

Build one help view using semantic headings, nav and native details. Mobile index collapses; desktop index is sticky. Use existing Lucide icons for the shared entry point. Interactive targets are at least 44px with visible focus. A back action returns to the previous meaningful app screen (or the current mode landing fallback), without changing mode. Native details provides cash guidance in place; do not force AppModal, which lacks a focus trap.

## Content contract (audit-derived)

- Access: login/request approval and shared-member context versus bound/inactive accounts; explain mode defaults and role restrictions without promising self-service password reset.
- Sale: product name/category search, grid/list, QR scanning of product UUIDs (not retail barcodes), repeat quantity for quantity products, unique products once, minus minimum 1, Quitar and confirmed Vaciar.
- Cash: Justo; bills 20/50/100/200/500/1000 and coins 1/2/5/10; taps accumulate the pad's own selection, not the manually typed amount. Limpiar selección clears cash only. Decimal point and thousands comma; explain missing cash/change and unknown/offline pending outcomes without guaranteeing server acceptance.
- Products: socio create/edit/deactivate/reactivate, photos JPEG/PNG/WebP up to 5MB, convert HEIC first. Type/stock read-only after creation; no restock or quantity creation with zero initial stock.
- QR: socio dedicated page; selected-product labels in Products for any role in Management; PDF preview, 72 labels per A4 sheet, 100% print scale and available calibration controls.
- Debts: socio contract even though the offer UI is not role-gated; one cart line. Fiado delivered versus apartado reserved, explicit initial payment 0 rather than inheriting cash, optional schedule only before creation. Later calendar read-only; offline creation queue tied to original account/device, later payment online/direct. Active/pending list; full payoff through a full payment, not a Liquidar/cancel/edit action.
- Incidents: system-detected stock/date conflicts, filters, notes/resolution; resolution is not a refund or stock adjustment.
- Reports: cash sales plus debt payments, dates/people/products, incomplete purchase-cost profit warning; export availability requires cash-sale count greater than 0.
- Settings: socio team add/commission only; device create/code/email/revoke/reissue and current-session disconnection; password length 10–128; conditional PWA install.
- Exclude unsupported stock adjustments, shrinkage, internal reservation flows, post-sale reversal, history route, debt cancel/edit/schedule edit, team edit, general profile and password-reset features.

## Work units and acceptance

- [x] **H1 — Define audited help content and local search**
  - New planned module: `src/config/help-content.ts`; colocated `src/config/__tests__/help-content.test.ts src/utils/__tests__/help-search.test.ts`.
  - Supporting planned files: `src/types/help.types.ts`, `src/utils/help-search.ts`. Typed sections contain stable IDs, Spanish titles, keywords, steps and explicit cautions/role boundaries; keep cash subsection reusable.
  - Search is deterministic, trims input, ignores accents/case, covers titles/keywords/steps and returns all sections for empty input.
  - Test stable unique IDs, complete audited topic coverage, accent-insensitive matching and critical limitations (offline outcome, cash-pad selection, debt role/initial payment, immutable stock).
  - RED → GREEN → refactor. Commit: `feat(help): define audited manual content and local search`.
  - Rollback boundary: static content/search module and its tests; no existing operational behavior changes.
  - Runtime boundary: N/A for static pure content/search; browser rendering belongs to H2/H3.
  - Forecast: 280–360 authored lines. Evidence/commit/count: pending.

- [x] **H2 — Expose searchable accessible help in both modes**
  - New planned view/tests: `src/views/help/HelpView.vue`, `src/views/help/__tests__/HelpView.test.ts`.
  - Update `src/router/index.ts`, `src/layouts/AppLayout.vue`; planned focused route and header tests in `src/router/__tests__/router.help.test.ts` and `src/layouts/__tests__/AppLayout.help.test.ts`.
  - Route `/app/ayuda`, name `Help`, inherits auth/context only; no socio or Management requirement.
  - Shared header link labeled Ayuda with existing Lucide icon; title map displays Ayuda. Sidebar exclusivity remains unchanged.
  - Local search, empty-result guidance, readable ordered steps/cautions, semantic headings/nav, mobile native-details index, desktop sticky index, deep-link anchors and back/fallback navigation.
  - Tests both roles/modes, logged-out/incomplete/inactive context guard behavior, search visibility, direct section links, back/fallback and accessible controls.
  - RED → GREEN → refactor. Commit: `feat(help): add accessible searchable in-app manual`.
  - Rollback boundary: help view, route and header entry point with integration tests; retain H1 as standalone content.
  - Forecast: 300–420 authored lines. Evidence/commit/count: pending.

- [ ] **H3 — Reuse cash guidance without losing sale state and close verification**
  - Update `src/components/ui/organisms/SaleCart.vue` and `src/components/ui/organisms/__tests__/SaleCart.test.ts`; extend `src/components/ui/molecules/__tests__/CashInput.test.ts` only if required to prove the nested interaction.
  - Inline native details beside cash entry reuses the H1 cash guidance. Opening/closing does not navigate, change cash/cart state, unmount CashInput or reset denomination counts.
  - Test type/manual cash, multiple denomination taps, open/close, subsequent tap accumulation, unchanged cart and clear-selection semantics.
  - Verify responsive browser layout, keyboard navigation/focus, both role/mode entry points, search/accent matching, deep links/back and cash state preservation using local synthetic data without API/credentials.
  - Exact final commands: `npm run build`; `npm run lint`; `npm run test:run`. Record all failed, skipped/unavailable and pending checks honestly.
  - RED → GREEN → refactor. Commit: `feat(help): explain cash entry without interrupting checkout`.
  - Rollback boundary: cash disclosure and associated state-preservation tests; H1/H2 remain usable.
  - Forecast: 70–120 authored lines plus final evidence updates. Evidence/commit/count: pending.

## Focused checks (planned paths, not yet created)

- H1: `npm run test:run -- src/config/__tests__/help-content.test.ts src/utils/__tests__/help-search.test.ts`.
- H2: `npm run test:run -- src/views/help/__tests__/HelpView.test.ts src/router/__tests__/router.help.test.ts src/layouts/__tests__/AppLayout.help.test.ts src/layouts/__tests__/nav-mode-exclusivity.test.ts`.
- H3: `npm run test:run -- src/components/ui/organisms/__tests__/SaleCart.test.ts src/components/ui/molecules/__tests__/CashInput.test.ts src/views/help/__tests__/HelpView.test.ts`.
- Final: `npm run build`, `npm run lint`, `npm run test:run`.
- Native risk/review and independent verification remain parent-owned; functional checks do not manufacture review approval.

## Progress and next step

- Existing source and supplied audit evidence reviewed; branch and recovery document created.
- No source/test writes, implementation commits or PR operations yet.
- Parent read file and full mirror, user selected feature-branch-chain, and parent authorized complete local implementation.
- Next: H1 RED tests and content/search implementation. One coherent slicing pass: H1a selling/access/cash content and search, H1b administrative manual extension, H2 page/router/header, H3 inline cash guidance. Keep all local commits on the feature branch; report any cohesive slice that exceeds 400 without compressing code or omitting proof.
- Preserve the same feature identity and merge observed evidence into this document/mirror after each completed work unit.


## Observed work-unit evidence

- H1a: RED both new suites fail on missing content/search modules; GREEN exact H1 command 2 files / 5 tests PASS. Seven detailed access/sale/cash/offline articles and accent-insensitive token search. Rollback only new modules/tests. Runtime N/A (pure static content/search). Commit: 89f60966ea63306e8b5f56838c43be7a18ffbc1f; slice 1 count 286 authored additions.
- Proposed chain: tracker feat/in-app-help; slice 1 H1a, slice 2 H1b admin content, slice 3 H2 help page/route/header, slice 4 H3 cash guidance and final proof. Each later slice depends on the previous; no PRs or child branches created.

- H1b: RED missing administrative coverage (1/6 failed); GREEN exact H1 command 2 files / 6 tests PASS. Added 14 detailed administrative/FAQ articles with verified evidence locators. Total 21 articles; all source paths exist. No runtime boundary beyond static content/search. Commit: 398893f1004dcccb19429901a244287e079aedfa; slice 2 count 208 authored additions plus deletions.

- H1c audit correction: RED 1/7 missing required-cost/report-table/queue-guidance/cash-example/FAQ constraints; GREEN exact H1 command 7 tests PASS. Verified ProductForm required new cost, Reports tables, SyncStatusIndicator Ver/Entendido, print/calibration labels, separate photo-upload failure and optional creation-only quota controls. Added structured FAQ (not numbered unrelated tasks). Keep correction as its own content slice.
- H2 implementation RED completed: missing view/route/header; cold first router import timeout disclosed. Header fixture PWA-only stub fixed, clean missing-header RED observed. Functional GREEN 43 tests; final formatted view proof pending FAQ rendering. Proposed H2 split: standalone view+view tests, then shared route/header and guard/integration tests.

- H2a: RED missing HelpView; FAQ-specific RED 1/14 after structured content. GREEN view 14/14 and expanded H2 44/44; normalized Vue markup before checks. Initial vue-tsc found a get().exists() test-type error, corrected to attributes; subsequent type check passes. Standalone semantic view/search/index/hash focus/safe return with tests, no operational links or external history-back. Browser runtime pending local fixture. Commit: this slice; hash in next update/mirror.

- H2b: expanded focused command GREEN 4 files / 44 tests PASS; new route inherits authentication/context without role/mode gates, common header Ayuda entry persists when sidebar collapses, sidebar exclusivity intact. Real help hash scroll bypasses generic router top reset; no change to existing mode watcher. Browser proof pending.
- Recorded slice identities: H1c a8f6b20ed26f4a08136e4c439d05eb79db1cad84 (65 authored lines); H2a b3f0d8e23e523dc6838cfd209e6bd61054761a76 (316 authored lines). H2b commit identity in next update/mirror.
