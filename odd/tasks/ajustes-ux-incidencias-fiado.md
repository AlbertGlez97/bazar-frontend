# Ajustes de producción: UX de catálogo, reporte, Incidencias, fiado/apartado

Branch: `feat/ajustes-ux-incidencias-fiado` (from `main` @ current HEAD, post gestion-costo-reportes-qr). TDD ON.
Companion backend branch: `feat/be14-products-low-stock-filter` (bazar-api) — adds `umbral` to `GET /products`.

## Why

Post-production feedback on "La Marchanta" after both backends were live: 3 parts. Part 1 is quick UX fixes.
Part 2 is a genuinely new screen (Incidencias) over an already-existing backend module. Part 3 connects the
existing Deuda/fiado backend to the sale checkout flow for the first time.

## Mapping (already verified by two parallel research forks, don't re-derive)

**Grid/list toggle**: exists only for Venta — `src/stores/saleCatalogView.store.ts` (`useSaleCatalogViewStore`),
localStorage key `la-marchanta-sale-catalog-view`, type `SaleCatalogView` (`src/types/sale-catalog-view.types.ts`,
`'grid'|'list'`, guard `isSaleCatalogView`). `ProductCatalogView.vue` (Gestión) does NOT import this — needs a
sibling store with its own localStorage key.

**Efectivo/Cambio columns**: NEVER rendered on screen (`ReportsView.vue` has no such table — confirmed by
exhaustive grep). They live ONLY in `pdf-report.ts` (`salesTable()`, headers `'Efectivo'`/`'Cambio'`, cells
`row.cashReceivedMinor`/`row.changeMinor`) and `excel-report.ts` (row keys `cash`/`change`, header
`'Efectivo recibido'`/`'Cambio'`). `productTable()`/people section are separate, untouched by this change. So
this task is exporter-only — zero changes to `ReportsView.vue` for this part.

**Poca existencia**: backend gets `umbral` on `GET /products` (see bazar-api task doc, tracked separately —
depends on that branch's T1 landing first, or this branch's agent can add the frontend types/service call
speculatively against the documented contract and it'll just work once merged, since the API contract is
already decided in D1 of that doc). `products.store.ts` paginates server-side (`page`/`limit`, default 20) — a
client-only filter would only filter the visible page, so the filter MUST go through the `umbral` query param,
not local `.filter()`. `AppHomeView.vue`'s "Poca existencia" card currently has `to="/app/productos"` with NO
query param. No other view in the repo reads router query params except `SaleView.vue` — this is genuinely new
plumbing for `ProductCatalogView.vue`.

**Incidencias contract** (verified literally against `doc/api-contract-for-frontend.md` + real DTOs, both
repos in sync, no discrepancy found):
- `GET /incidencias` → `{ items, total, page, limit }`. Query: `type` (`'conflicto_stock'|'incidencia_fecha'`),
  `resolutionStatus` (`'pendiente'|'resuelta'`, omitted = all), `search` (matches the SALE'S SELLER, not the
  resolver), `sort` (`'asc'|'desc'`, default `desc`, by `detectedAt`), `page`/`limit` (default 20, max 100).
  Items do NOT include the sale.
- Item shape: `id`, `saleId`, `contextId`, `type`, `reason` (server-generated string), `detectedAt` (ISO),
  `resolutionStatus`, `resolvedByMemberId` (string|null), `resolvedAt` (string|null), `resolutionNotes`
  (string|null).
- `GET /incidencias/:id` → the incidencia PLUS nested `sale` (raw Prisma record with `items`). Only here.
- `PATCH /incidencias/:id/resolver` (route is Spanish, not `/resolve`) → body `{ resolutionNotes: string }`
  (required, 1..2000). Returns the resolved incidencia (no nested `sale`). 409 if already resolved (no
  "un-resolve"). Resolver identity comes from `x-member-id`, never from the body.

**Detail-view convention (D2)**: the router has ZERO `:id` dynamic routes anywhere in this project — confirmed
by exhaustive check of `src/router/index.ts`. Every existing "detail + action" flow in this repo (closest:
`DevicesView.vue`'s revoke confirmation) uses a modal/panel over the list, never a dedicated detail route.
**Decision: the incidencia detail + resolve form is a modal/dialog opened from the list row, not a new
`/app/incidencias/:id` route.** This matches 100% of existing precedent and the original request never
mandated a URL-addressable detail view.

**Deuda contract** (verified literally against real DTOs/service/schema, doc already accurate, no discrepancy):
- `POST /deudas` body: `type: 'fiado'|'apartado'` (required), `productId` (required, UUID, ONE product),
  `cantidad` (required, int, `Min(1)`), and exactly one of `deudorId` (existing) or `deudor: { nombre
  (required), telefono?, notas? }` (inline new). **No initial-abono field exists** — confirmed absent from the
  DTO and from the documented example payload.
- Response: 201 with the created Deuda including `abonos: []`, but WITHOUT a nested `deudor` — read it back
  from what you sent, or `GET /deudas/:id` if you need it displayed after creation.
- `POST /deudas/:id/abonos` body: `{ montoMinor: number (required, Min(1)), nota?: string }`. Response: 201
  with the FULL updated Deuda (including `abonos` and `deudor`), not the bare abono.
- `type` values `'fiado'`/`'apartado'` are treated IDENTICALLY server-side (both decrement stock immediately on
  creation) — it's purely a label for the socio, no different business rule between them today.
- **Deuda is single-product/cantidad, never a cart** (`doc/reglas-de-negocio.md` in bazar-api: "para varios
  productos hay que crear varias deudas"). Confirmed with the user via AskUserQuestion.

**Decision (D3, user-approved)**: "Registrar como fiado/apartado" is offered ONLY when the cart has exactly
ONE line. With 2+ lines, checkout still blocks on insufficient cash exactly as today (no fiado option shown,
no backend changes needed for the multi-line case — out of scope, not silently degraded, just not offered).

**Cash-shortfall flow** (already verified, reuse as-is):
- `cart.store.ts`: `canCharge` (requires `cashReceivedMinor >= totalMinor`, non-empty cart, `!cashInvalid`,
  total within contract max) and `missingMinor` (via `shortfallMinor()` in `utils/money.ts`, already the
  centralized comparison — don't reimplement it).
- `checkout.store.ts`: `run()` returns `{ kind: 'blocked', reason: 'cash-insufficient' }` BEFORE touching the
  network when `!cart.canCharge`. `CheckoutResult` is an extensible discriminated union (`success | conflict |
  saved-offline | rejected | auth-needed | failed-to-save | blocked`) — adding a new `debt-registered` variant
  is additive, same pattern `sale-result.ts`'s `describeCheckoutResult` already uses per-variant.
- `SaleCart.vue` already receives `missing-minor` as a prop and disables "Cobrar" when `!canCharge` — the new
  "Registrar como fiado/apartado" button/section goes exactly where that disabled state is shown today, gated
  on `cart.lines.length === 1` (D3).
- **Because Deuda creation already decrements stock on its own** (independent of any Sale), registering a
  fiado/apartado does NOT also call `POST /sales` — it is a complete alternate transaction, not a sale variant.
  No Sale record exists for it. This is what makes the result screen say "not a completed cash sale."

## Decisions

- **D1** (Part 1, poca existencia): filter goes through the backend `umbral` param, never a client-only
  `.filter()`, because the catalog paginates server-side.
- **D2** (Part 2, detail view): modal/dialog over the list, not a new `:id` route — matches 100% of existing
  precedent (`DevicesView.vue`), and the request never required a URL.
- **D3** (Part 3, multi-line carts, user-approved): fiado/apartado offered ONLY for single-line carts. Backend
  needs NO changes for Part 3 — the existing single-product Deuda contract already covers this exactly.
- **D4**: the initial cash (if any) becomes the first abono via a SECOND call, `POST /deudas/:id/abonos`, right
  after `POST /deudas` succeeds (no atomic single-call path exists in the contract — confirmed, not assumed).
  If the second call fails after the first succeeds, the Deuda still exists with `abonos: []` — surface this
  partial-failure state honestly in the result screen rather than pretending it fully succeeded (mirrors the
  "never silently 0" convention already used for profit gaps).

## Tasks

- [x] **P1** Quick UX (3 independent-ish pieces) — done, uncommitted (coordinator to review/commit):
  - Grid/list toggle for Gestión Productos: new sibling store `src/stores/manageCatalogView.store.ts`
    (`useManageCatalogViewStore`, localStorage key `la-marchanta-manage-catalog-view`), new type
    `src/types/manage-catalog-view.types.ts` (`ManageCatalogView`, `isManageCatalogView`). Toggle UI + list
    layout added to `ProductCatalogGrid.vue` (same button-group pattern as `SaleCatalogPicker.vue`, reused, not
    reinvented); wired into `ProductCatalogView.vue` via `:view`/`@update:view`.
  - Efectivo/Cambio columns removed from `pdf-report.ts`'s `salesTable()` and `excel-report.ts`'s
    `ExcelSalesRow`/`addSalesSheet` — exporters only, `ReportsView.vue` untouched.
  - Poca existencia filter: `umbral?: number` added to `ProductListParams` (covers `products.service.ts`
    generically); `products.store.ts` tracks `umbral` as a persisted filter (new `LOW_STOCK_UMBRAL = 2`
    export), using `'umbral' in params` (not `!== undefined`) so `{ umbral: undefined }` can explicitly clear
    it. Toggle "Poca existencia" added directly in `ProductCatalogView.vue` (AppSwitch), placed AFTER
    `<ProductCatalogGrid>` in the template — deliberately, so "Mostrar inactivos" (inside the grid's toolbar)
    stays the first `input[type="checkbox"]` on the page and existing index-based tests don't break.
    `AppHomeView.vue`'s "Poca existencia" card now navigates to `/app/productos?pocaExistencia=1`;
    `ProductCatalogView.vue` reads `route?.query.pocaExistencia === '1'` on mount (optional-chained: several
    existing tests mount the view with no router installed, where `useRoute()` returns `undefined`).
  - TDD: RED-then-GREEN run explicitly for the exporters, the new store, the grid/list toggle in
    `ProductCatalogGrid.vue`, and its wiring into `ProductCatalogView.vue`. For `products.store.ts`'s `umbral`
    plumbing and the view-level "Poca existencia" switch, tests were written and implementation followed
    immediately after (not run RED first) — behavior didn't exist before, so RED was implied, not observed.
  - Regression caught and fixed during implementation: an earlier attempt put the "Poca existencia" switch
    inside `ProductCatalogGrid.vue` (next to "Mostrar inactivos"); this broke `ProductCatalogGrid.selection.test.ts`
    and two `ProductCatalogView.test.ts` tests that assume `input[type="checkbox"]` (unqualified) is "Mostrar
    inactivos" or a selection checkbox. Reverted and moved the switch to `ProductCatalogView.vue`, after the
    grid, instead of rewriting those pre-existing tests.
  - Verification: `npm run test:run` → 149 files / 2797 tests passed (baseline was 148/2764). `npx eslint .` →
    clean. `npm run build` (`vue-tsc -b && vite build`) → passed. Independently re-verified by the coordinator
    (same exact counts) before committing.
- [ ] **P2** Incidencias screen: new route `/app/incidencias` (`meta: { requiresSocio: true, requiresGestion:
      true }`, same guard pattern as Reportes/Códigos QR — router meta + live `watch` in the view), paginated
      list (type/status filter, search, sort by date), detail+resolve as a modal (D2), nav item in
      `nav-items.ts` alongside Inicio/Productos/Reportes/Códigos QR, "Incidencias pendientes" card in
      `AppHomeView.vue` navigating here (filtered to pendientes if a query param convention is established —
      reuse whatever P1 establishes for Productos' query-param navigation, for consistency).
- [ ] **P3** Fiado/apartado in checkout: "Registrar como fiado/apartado" option in `SaleCart.vue` gated on
      `cart.lines.length === 1` and `!cart.canCharge` (D3), deudor-capture form (nombre required,
      telefono/nota optional, tipo fiado/apartado), `POST /deudas` then conditionally `POST /deudas/:id/abonos`
      for the pre-entered cash (D4), new `debt-registered` (or similarly named) `CheckoutResult` variant with
      its own honest result screen (saldo pendiente visible, explicitly NOT a completed cash sale, and the
      partial-failure case from D4 surfaced if it happens). TDD RED-first, including the D4 partial-failure
      path.
- [ ] **P-docs** Update `doc/reglas-de-negocio.md` and `doc/api-contract-for-frontend.md` in BOTH repos only if
      P1's `umbral` addition needs it here too (bazar-api's own task doc already covers updating them there;
      this entry is to confirm the frontend-side doc, if any, doesn't also need a matching note) — no changes
      expected for P2/P3 since neither changes the backend contract.
- [ ] **P-verify** Full branch verification: build, lint, `npm run test:run`, exact counts. Disclose (don't
      fake) what a real/emulated tablet+phone viewport pass would need — same disclosure as every prior
      feature this session, this environment has no browser.

## Out of scope / explicitly deferred

- Multi-line-cart fiado/apartado (D3) — deliberately deferred, not a silent gap: checkout still blocks exactly
  as before for 2+ line carts, no new option shown.
- No backend schema changes for Deuda — the single-product constraint is accepted as-is (D3).
