# Coins in the cash pad, Codigos QR screen, mandatory cost, profit reports, Gestion home

Branch: `feat/gestion-costo-reportes-qr` (from `main` @ merge of `feat/qr-labels`). Not pushed.

TDD: ON (source: explicit user request, same session rule as the previous frontend features). RED must be
observed and recorded before each behavior. Runner: `npm run test:run` (Vitest, jsdom). Machine: personal —
full execution authorized.

## Objective (5 parts, per the user's brief)

1. Add coins ($1/$2/$5/$10) to the existing combinable cash-denomination pad.
2. A new "Codigos QR" screen in Gestion (socio-only): search-based product picker with a print list (copy
   counters), reusing the existing label-sheet PDF logic instead of the catalog checkbox selection.
3. Make purchase cost mandatory on new products in `ProductForm`, with a friendly invitation to capture it
   when editing a legacy product that never had one.
4. Reports view: per-product/per-person breakdown with real (never-estimated) profit, exported in the
   existing PDF/Excel.
5. Replace the Gestion home's "under construction" placeholder with `GET /dashboard/summary` cards.

## Prerequisite done first

`feat/qr-labels` (client QR generation + the calibrated 6x12 label-sheet PDF renderer) was merged into `main`
via a merge commit — Part 2 reuses its pure geometry (`utils/label-sheet-plan.ts`) and jsPDF renderer
(`services/qr-label-sheet.ts`, `stores/label-calibration.store.ts`, `utils/product-qr.ts`) as-is. The
checkbox-based catalog selection it also added (`ProductSelectionBar`, `ProductCard` checkboxes,
`LabelPrintDialog`, `ProductCatalogGrid` selection props) is **not** reused — Part 2 replaces that whole
interaction with a dedicated search + print-list screen, per the user's explicit instruction. 140 files /
2646 tests green on `main` after the merge, lint clean, build ok.

The backend contract this frontend work depends on (`purchaseCostMinor` mandatory/immutable-once-set,
`GET /reports/sales-detail`, `GET /dashboard/summary`) is complete and documented in
`doc/api-contract-for-frontend.md`, on the bazar-api branch `feat/be13-cost-reports-dashboard` — **not merged
to bazar-api's main and not pushed**. Frontend TDD work here mocks the API (existing convention in this
repo), so it doesn't need the backend running; manual end-to-end verification against a live backend is a
disclosed follow-up, same as prior features this session.

## Mapping (evidence gathered before any code)

- **`ProductForm.vue`**: `purchaseCostMinor` already exists as an optional field (label "Costo de compra
  (MXN, opcional)"), parsed with the same `parseMoneyText` (`utils/money.ts`) as `unitPriceMinor`. No field
  in this codebase already has the "optional at first, can't be cleared once set" hybrid rule — this is a new
  pattern, not a copy of an existing one. `VOICE.apiErrors.product.purchaseCost` currently says "...o déjalo
  vacío", which stops being true on create.
- **`ReportsView.vue`**: fetches only `sales-by-period` + `sales-by-member` (`Promise.all`) — never
  `sales-detail`, which has **no frontend service or types yet** (`reports.service.ts` only exposes the two
  existing calls). `SalesReportSummary.vue` is presentational (props in, nothing out) with a total "hero" and
  a per-person table — no per-product table, no profit column. The `AppAlert type="warning"` pattern for
  "something doesn't fully add up" already exists twice (`consistency.ok === false`, `truncated`) — direct
  template for the "partial profit" warning.
- **`pdf-report.ts`/`excel-report.ts`**: both follow one pattern per section (`salesTable()`/`peopleTable()`
  for the PDF, `addSalesSheet()`/`addPeopleSheet()`/`addSummarySheet()` for Excel) built from the single
  `SalesReport` model in `utils/sales-report.ts`. A new table/sheet is additive — the existing two don't
  reference the new fields, so they can't break. `reportFileName()` (`utils/report-files.ts`) already
  produces a clear dated filename; no change needed there.
- **Route guard pattern** (`router/index.ts`): `meta: { requiresSocio: true, requiresGestion: true }`, read by
  `router.beforeEach`, redirects to the person's own mode landing (never a dead end) — `ReportsView.vue` also
  re-checks the same pair with its own `watch` in case the mode/role changes while the view is open. Replicate
  both exactly for `codigos-qr`.
- **No "Gestión requiere internet" component exists anywhere in this codebase** — confirmed by an exhaustive
  search. What exists instead is a *reactive* pattern already used by the one other Gestión-only, data-heavy
  screen (`ReportsView.vue`): attempt the fetch, catch a network error specifically (`isNetworkError()`,
  `VOICE.networkError`), show `AppAlert type="error"` + retry. Treated as the "already defined" aviso the
  brief refers to — see D5 below for why a new proactive gate isn't built instead.
- **`nav-items.ts`**: declarative row `{ to, label, icon, exact, modes, socioOnly, order }`, Reports is
  `modes: ['gestion'], socioOnly: true` — same shape for a new "Códigos QR" row.
- **`AppHomeView.vue`**: today is 8 lines, no script, static "en construcción" text. **No `StatCard`/
  `MetricCard` atom exists** — needs to be built. Closest visual precedent: `SalesReportSummary.vue`'s
  `.sales-report-summary__hero` (large number, `--font-display`, `--color-primary-soft` background).
- **`feat/qr-labels` (now in `main`)**: `LabelInput = { id: string; name: string }` — **no copies field**.
  `generateQrLabelSheet`/`planLabelSheet` dedupe the *QR PNG raster* by id but never collapse labels, so "N
  copies of a product" means **repeating its `{id, name}` entry N times** in the input array — exactly what
  Part 2 needs, no renderer change required. `LabelPrintDialog.vue` already takes a flat `labelCount` +
  calibration + busy/error and emits `update:calibration`/`reset`/`preview`/`download` — it has no
  selection UI baked in, so it's reusable as-is for Part 2's calibration/generate step.
  `useLabelPrinting()` already wraps `generateQrLabelSheet` + `saveBlob`/preview. `product-selection.store.ts`
  (checkbox catalog selection) is explicitly **not** reused, per the merge commit's own decision, superseded
  by Part 2's search-based picker.
- **`voice.ts`**: `VOICE.labels` already has every string Part 2 needs for printing (selection, calibration,
  help, blocked-preview). `VOICE.reports` is the template for the loading/empty/error strings Part 5 needs
  under a new `VOICE.dashboard` block — no existing dashboard/home copy to reuse verbatim.

## Decisions

### Part 1: coins (D1)
- Denominations: `COINS = [1, 2, 5, 10]`, alongside the existing `BILLS = [20, 50, 100, 200, 500, 1000]`.
  Same accumulate-on-tap mechanic, same underlying `denominationCounts` map in `CashInput.vue` (a coin's
  numeric value never collides with a bill's, so the existing single `Record<number, number>` needs no
  structural change — only `CashDenominationPad.vue`'s rendering and the money math already generalize).
- Shape: coins are circles (`border-radius: 50%`, explicit equal `width`/`height` so they're actually round,
  not just padded text), bills stay the rounded rectangles they already are.
- Color: **no new color tokens invented.** Real MXN coins ($1/$2/$5) are plain silver/nickel — a flat
  `var(--color-surface-alt)` fill with a `var(--color-border-strong)` ring and the number as the only
  identifier (same "number is the identifier" principle already used for bills) is honest to how they
  actually look and needs zero new tokens or contrast re-verification. The $10 coin is genuinely bimetallic
  in real life (gold center, silver ring) — represented with a two-stop `radial-gradient` built from
  **existing** tokens (`var(--maiz-400)` center, `var(--cafe-600)` ring), never a hardcoded hex, so
  `no-hardcoded-colors.test.ts` needs no changes.
- Grouping: the pad renders two labeled sections, visible headings "Billetes" and "Monedas" (the user asked
  for these explicitly, not just a visual split) — `<h3>`/`<span>` group labels, not just CSS columns, so
  they're in the accessibility tree too.
- Touch target: coins sized `3rem` (48px, same as the `--lg` size already used elsewhere in this app for
  emphasis) rather than the bills' `2.75rem` (44px) — comfortably fits two-digit "$10" inside a circle
  without cramping, still clears the 44px WCAG floor with margin.
- Grammar: `aria-label` uses the correct gender per kind — "Billete de $X, agregado N veces" (already
  existing) vs. "Moneda de $X, agregada N veces" (new) — `moneda` is feminine, `agregada` not `agregado`.
- Sync mechanism: unchanged. The existing `lastEmittedByPad` + single-watcher rule in `CashInput.vue` already
  works for any denomination value, coins included — no new sync code.

### Part 2: Codigos QR screen (D2)
- New view `src/views/products/CodigosQrView.vue` (or under a dedicated folder, project's call at
  implementation time), route `/app/codigos-qr`, `meta: { requiresSocio: true, requiresGestion: true }`
  exactly like Reports, plus the same `watch`-based re-check inside the view. Nav row in `nav-items.ts`:
  `{ to: '/app/codigos-qr', label: 'Códigos QR', icon: '🏷️', modes: ['gestion'], socioOnly: true, order: {...} }`.
- **Search picker** (new molecule/organism): debounced text input, calls `ProductsService.listProducts({
  search, limit: 10, page: 1, includeInactive: false })` (same service already used elsewhere), shows compact
  result rows with an "Agregar" action — never a long checkbox list, satisfying the brief directly.
- **Print list**: local component state, `Map<productId, { id, name, copies }>` (not a Pinia store — same
  "transient, not persisted on purpose" call already made for the old catalog selection). Adding a product
  already in the list increments `copies` instead of duplicating the row. Stepper `+`/`-`, minimum 1 (at 1,
  `-` removes the row instead of going to 0). "Quitar" action removes a row outright regardless of count.
- **Summary**: `totalLabels = sum(copies)`, `totalSheets = sheetCount(totalLabels)` (reuse the existing
  `label-sheet-plan.ts` export, don't recompute `Math.ceil` by hand).
- **PDF generation**: build the flat `LabelInput[]` by repeating each list entry's `{id, name}` `copies`
  times, hand it to the existing `useLabelPrinting()` composable (`download`/`preview`) — no changes to
  `qr-label-sheet.ts`/`label-sheet-plan.ts` needed. Reuse `LabelPrintDialog.vue` as-is for the
  calibration/offset controls and the generate/preview/download actions, passing `labelCount: totalLabels`.
- **Connectivity**: reactive pattern (see Mapping) — attempt the product search/list actions normally; on a
  network error, `AppAlert type="error"` with `VOICE.networkError` + retry, same shape `ReportsView.vue`
  already uses. No new proactive "offline gate" component, since none exists elsewhere in the app and Gestión
  overall has no precedent for one — introducing a first-of-its-kind gate here would be a bigger, riskier
  addition than the brief's one line asked for, when the reactive pattern already covers the real failure
  mode (a request that can't complete).

### Part 3: mandatory cost in ProductForm (D3)
- **Create**: `purchaseCostMinor` becomes required, validated in real time with the same `parseMoneyText`
  already used for price. Unlike price (frontend UX rule: must be `> 0`, a sellable item needs a positive
  price), cost accepts `>= 0` (matches the backend's own `@Min(0)` — a cost of exactly 0 is plausible, e.g. a
  donated or found item), so it is *not* a literal copy of the price rule, just the same parsing plumbing.
  Empty or ambiguous text blocks submission with a clear inline error.
- **Edit, legacy product (`product.purchaseCostMinor === null`)**: field stays optional, saving without it
  keeps working exactly as today. Add one friendly note near the field — "Con esto calculamos tu ganancia en
  los reportes." — inviting capture without blocking anything.
- **Edit, product that already has a cost**: the field behaves like price already does — required, can be
  corrected to a new value, but the UI never lets it go blank (mirrors the backend's own
  "cannot be cleared once set" rule proactively, instead of only reacting to its 400 after the fact). If the
  400 is somehow still hit (a stale form, a race), show a dedicated message via a new
  `VOICE.apiErrors.product.purchaseCostLocked` string rather than the generic "no es válido" one.
- Drop the "...o déjalo vacío" clause from the existing `purchaseCost` error message (no longer universally
  true) and split it into a create-mode message and an edit-mode message.

### Part 4: reports with detail and profit (D4)
- New `ReportsService.getSalesDetail(query)` calling `GET /reports/sales-detail`, plus its response types in
  `types/report.types.ts` (`SalesDetailRow`, `SalesDetailTotals`), mirroring the documented shape exactly
  (`gananciaMinor`/`costoMinor` nullable, `gananciaDisponible` boolean, `totals.lineasSinCosto`).
- Because the endpoint paginates (max `limit: 100`) but a report export needs the *whole* period, add a small
  collector (same spirit as the existing `sales-report-collector.ts` for `GET /sales`) that pages through
  `sales-detail` until it has every row, capped at a sane number of pages (consistent with this codebase's
  existing 100-page/10,000-row safety cap elsewhere) — never an unbounded loop.
- `ReportsView.vue` adds this collector call alongside the existing `Promise.all`, feeding a new breakdown
  section: per-product-and-person table (`productName`, `memberName`, `units`, `ingresoMinor`, `gananciaMinor`
  or a "no disponible" dash when `gananciaDisponible` is false — never a `0`). Above it, the partial-profit
  warning (same `AppAlert type="warning"` pattern as the existing consistency/truncated warnings) whenever
  `totals.lineasSinCosto > 0`: **"Ganancia calculada solo sobre las ventas con costo registrado — N venta(s)
  sin costo capturado no se incluyen en el total."**, using `lineasSinCosto` directly (the API doesn't expose
  a comparable "total lines" count to phrase it as "X of Y", so the message states the honest gap instead of
  a fraction that isn't computable from what the endpoint returns).
- **No cash-received/change columns anywhere in this new material** (the brief's own explicit constraint;
  the existing sales table already omits them too — nothing to remove there).
- PDF: one more table via the same `salesTable()`/`peopleTable()` pattern (`productTable()`), plus the
  partial-profit note as its own text block, in `pdf-report.ts`. Excel: one more sheet ("Por producto") via
  the same `addXSheet()` pattern in `excel-report.ts`. Both additive — the two existing tables/sheets don't
  reference the new fields and are re-verified unchanged.

### Part 5: Gestión home (D5)
- New reusable atom `AppStatCard.vue` (or similar name decided at implementation time) — big number,
  optional trend/sub-label, optional link — since none exists; styled after `SalesReportSummary.vue`'s hero
  block for visual consistency rather than inventing a new look.
- New `DashboardService.getSummary(query)` for `GET /dashboard/summary`, response types in
  `types/report.types.ts` or a new `dashboard.types.ts`.
- `AppHomeView.vue` gains real logic: fetch on mount (only when `uiMode === 'gestion'` and the person is a
  socio — Gestión-only, same as Reports/Codigos QR), loading (`AppSkeleton`), empty, and error states in
  La Marchanta's voice (new `VOICE.dashboard` block, modeled on `VOICE.reports`'s shape).
- Cards: ventas hoy (with the vs.-ayer comparison), ganancia hoy (with the partial note when
  `lineasSinCostoHoy > 0`, same wording style as D4), incidencias pendientes, deudas por cobrar (monto +
  personas), productos con poca existencia (short list). Only **Productos** and **Reportes** cards link
  anywhere (both routes already exist); incidencias and deudas show their number with no link, since those
  screens don't exist yet — never a link to a 404.
- Connectivity: same reactive network-error pattern as Part 2/D2 (no proactive gate).

## Checklist

- [x] **P0** Merge `feat/qr-labels` into `main` (prerequisite for Part 2). Verified 140/2646, lint clean,
      build ok.
- [x] **P1** Coins in the cash pad (D1). TDD: RED observed (15 failed / 49 passed against unmodified code),
      then GREEN (64/64). Bonus fix found along the way: the reused white badge text was unreadable on the
      light silver coins — added a scoped color override, same AA-verified `--color-text` pair used
      elsewhere, no new tokens. 140 files / 2656 tests green (+10), lint clean, build ok.
- [ ] **P2** Codigos QR screen — route, nav item, search+print-list, calibration, PDF generation, offline
      guard, route protection. TDD: RED first for sheet-count math (72→1, 73→2), copies repeating/positioning
      correctly, and a colaborador never reaching the route.
- [x] **P3** `ProductForm`: mandatory cost on create (accepts `0`, unlike price's `> 0` rule), friendly
      capture-invitation on legacy edit ("Con esto calculamos tu ganancia en los reportes."), and a set cost
      can't be blanked in edit mode (mirrors `unitPriceMinor`'s existing pattern) — both the proactive
      frontend block and the backend's 400 reuse the same `purchaseCostLocked` message. TDD: RED observed for
      all 5 behaviors. Fixed fallout: 2 catalog-view test files had create-flow fixtures missing the
      now-required cost. 140 files / 2662 tests green (+6), lint clean, build ok.
- [x] **P4** Reports view: new `SalesDetailBreakdown.vue` organism (per-product/person table), never-estimated
      profit (`gananciaCellText` prints "No disponible", never `$0.00`, when `gananciaDisponible` is false),
      partial-profit `AppAlert` warning using `lineasSinCosto` directly. New `sales-detail-collector.ts`
      pages the whole period (100-page/10k-row cap, same order of magnitude as the existing `GET /sales`
      collector), fetched eagerly alongside the two existing report calls and reused as-is for PDF (new
      `productTable()`) and Excel (new "Por producto" sheet). `SalesReport.detail` is optional — every
      pre-existing report test stayed green unchanged, confirming the two existing tables/sheets never
      reference the new fields. A real type bug (`vue-tsc` caught a missing `ingresoMinor`) was found and
      fixed during the build check. TDD: RED observed file-by-file across service/collector/model/PDF/Excel/
      view. 145 files / 2726 tests green (+48), lint clean, build ok.
- [x] **P5** Gestion home: `GET /dashboard/summary` cards (new `dashboard.service.ts`, new `AppStatCard`
      atom), loading/error states, links only to Reportes (ventas) and Productos (poca existencia) — ganancia/
      incidencias/deudas are plain, unlinked cards, verified by an explicit test on `wrapper.findAll('a')`.
      Route guard decision: `/app` keeps only `requiresGestion` (it's the Gestión landing for colaboradores
      too, per `nav-items.ts`); the socio check for the dashboard data lives inside the view itself
      (`canSeeDashboard`), never redirects, shows a friendly "solo socios" note instead — adding
      `requiresSocio` to the route would loop a colaborador's own landing page. TDD: RED observed (6/7 failing
      against the unmodified static view). 143 files / 2678 tests green (+16), lint clean, build ok.
- [ ] **P6** Verify: build, lint, `test:run` full suite. Disclose (don't fake) what a real/emulated tablet +
      phone viewport pass would need, since this environment has no browser.

## Acceptance criteria

Tapping a coin multiple times accumulates correctly and combines with bills in the same total; the pad shows
"Billetes"/"Monedas" as visible group labels. Codigos QR: only socios in Gestion can reach it; searching finds
products without a long checkbox list; the print list holds one entry per product with an editable copy count;
the generated PDF matches the existing calibrated 6x12 layout with the right product names and no price; a
colaborador gets redirected/blocked like every other Gestion-only route. ProductForm rejects a new product
without a cost, never blocks saving an edit to a legacy cost-less product, and never lets a set cost be
cleared. Reports show real profit where known and an honest gap where not, with the same rule distinction
(per-row vs. totals) the backend already documents. The Gestion home shows real dashboard numbers with proper
loading/empty/error states and no dead links to screens that don't exist yet (Incidencias, Deudas).
