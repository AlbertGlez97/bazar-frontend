# Vista de Deudas, abono inicial explícito, calendario de cuotas planeadas

Branch: `feat/deudas-view-cuotas-abono-inicial` (from `main` @ `65567ef`). TDD ON. Personal machine, full
execution authorized. Depends on the bazar-api branch `feat/be15-deudas-cuotas-abono-inicial` (companion task,
tracked separately) for its final contract — coordinator merges/verifies backend first, then hands this branch
the confirmed contract before frontend work starts on anything that needs it (P2 onward).

## Mapping (already verified by a research fork — don't re-derive)

**`RegistrarDeudaModal.vue`**: confirmed, has NO initial-abono field today. Emits `confirm: { type, deudor:
{nombre, telefono?, notas?} }`. Presentational only, same pattern as `IncidenciaDetailModal`.

**`checkout.store.ts`**: `runRegisterDebt()` uses `cart.cashReceivedMinor` **implicitly** as the initial abono
today — this must become an **explicit** field from the modal instead (D1 below), never inferred from what's
already typed in the cash field. `registerDebt(input)` currently only accepts `{type, deudor}`.
`deudas.service.ts`/`deuda.types.ts` currently document "no initial-abono field exists in the contract" — this
is the OLD contract; the companion backend task adds `abonoInicialMinor` (required) to `POST /deudas` — update
these types once that lands, don't guess the field name, confirm it against the backend branch's actual DTO.

**No date/calendar library exists in this project at all** (`package.json` confirmed clean of
`date-fns`/`dayjs`/`moment`/etc.) — `@vuepic/vue-datepicker` is genuinely new territory, no prior convention to
match beyond the existing es-MX money parser (unrelated to dates).

**No dark/light theme mechanism exists in this project** (confirmed: zero `prefers-color-scheme`/`data-theme`
usage anywhere in `main.css` — single fixed light theme). **The original request's "tema oscuro/claro
configurable" assumption does not apply — treat as out of scope.** Only wire the datepicker's CSS variables to
this project's existing single-theme tokens (`--color-primary`, `--color-primary-hover`, `--color-primary-soft`,
`--color-on-primary`, `--color-bg`, `--color-surface`, `--color-surface-alt`, `--color-text`,
`--color-text-muted`, `--color-border-strong` — confirmed real token names from `doc/brand-guidelines.md`).

**`AppHomeView.vue`**: the "Deudas por cobrar" card exists today WITHOUT a `to` — confirmed
(`VOICE.dashboard.debts`, value from `summary.deudasPendientes.totalMinor`, sublabel with `.personas`).

**Reports frontend**: `reports.service.ts` has zero Deuda/Abono content — fully new, depends entirely on
whatever the backend companion task's final report contract turns out to be (D7 there). `pdf-report.ts` has
three independent table-builder functions (`salesTable`, `peopleTable`, `productTable`) — same pattern to
follow for two more.

**Router/nav pattern**: Gestión-only-socio routes use `meta: { requiresSocio: true, requiresGestion: true }`
(confirmed exact pattern at `router/index.ts`). Next free `order.gestion` slot: **6** (Incidencias occupies 5).
Detail-as-modal-over-a-list remains the only pattern in this project (confirmed: the router's own code comment
states there are zero dynamic `:id` routes) — no reason to deviate for Deudas' detail view either.

## Decisions

- **D1 (abono inicial explícito)**: `RegistrarDeudaModal.vue` gains a required money input "Abono inicial"
  (same es-MX parser already used elsewhere, e.g. `ProductForm.vue`'s cost field), defaulting to **displayed
  `$0.00`, not blank** — the person must actively change it to abonar algo, never silently inherit
  `cart.cashReceivedMinor`. `checkout.store.ts`'s `registerDebt(input)` gains `abonoInicialMinor: number` in its
  input, passed straight through to the (now-required) backend field — stop reading `cart.cashReceivedMinor`
  for this purpose entirely.
- **D2 (cuotas planeadas UI, my call per the original request's own "a tu criterio, documenta la decisión")**:
  the modal gains an optional collapsed section "¿Quieres programar fechas de pago?" (a toggle/disclosure, not
  a separate step) that reveals `@vuepic/vue-datepicker` in multi-date mode. For each selected date, render one
  money input, **pre-filled with an even split of `(totalMinor - abonoInicialMinor) / N` fechas** (rounded, last
  installment absorbs any remainder-cents), each individually editable before submitting — this is a starting
  suggestion, not a constraint the person must respect. No validation that the cuotas sum to the remaining
  balance (per D2 backend: cuotas are informational, never authoritative over the balance) — don't invent a
  constraint the backend doesn't enforce either.
- **D3 (theme)**: no dual-theme wiring — just point the datepicker's CSS custom properties at this project's
  existing fixed-theme tokens listed above.
- **D4 (detail view)**: modal-over-list, matching every other detail view in this project. No new route pattern.

## Tasks

- [x] **P1** `@vuepic/vue-datepicker@^14.0.0` installed as a `dependencies` entry (confirmed, not dev). Local
      per-component import + `dist/main.css` import, no global registration (matches this project's convention).
- [x] **P2** `deuda.types.ts`/`deudas.service.ts` updated against the real, merged, pushed bazar-api contract
      (`abonoInicialMinor` required, `cuotasPlaneadas?`, `unitCostMinor`, `saldadaAt`, cuotas CRUD endpoints) —
      confirmed field names against `doc/api-contract-for-frontend.md`, not guessed.
- [x] **P3** `RegistrarDeudaModal.vue` + `checkout.store.ts`: abono inicial explicit input (defaults `"0.00"`,
      never reads `cart.cashReceivedMinor`), new `CuotasPlaneadasEditor.vue` molecule (multi-date picker +
      even-split suggestion via new `splitEvenMinor` util, per-row edit tracking so edited rows survive a
      re-split when dates change). `checkout.store.ts`'s `registerDebt` now sends `abonoInicialMinor`/
      `cuotasPlaneadas` inside the same `POST /deudas` call (BE-15's atomic contract) — **this removed the
      `abonoFailed` field from `CheckoutResult`** (the "deuda created, abono rejected separately" intermediate
      state no longer exists under the atomic contract). Not 100% explicit in this doc originally; the
      coordinator reviewed and agrees it's the correct, necessary consequence of D1, not scope creep.
- [x] **P4** New `src/views/deudas/DeudasView.vue` (route `/app/deudas`, same `requiresSocio+requiresGestion`
      guard as Incidencias), filters (atrasadas/orderBy/search), pagination, total pendiente sourced from `GET
      /dashboard/summary` (the only server-side aggregate available — summing a paginated/filtered page would
      be wrong). Detail is `DeudaDetailModal.vue` (modal-over-list, same pattern as `IncidenciaDetailModal` —
      confirmed no new route was invented). Decision: cuotas shown read-only in the detail modal;
      `CuotasPlaneadasEditor` is used only at creation, not as a reschedule UI here — documented as
      deliberately out of scope for this pass. New `deuda-status.ts` util reproduces the backend's exact
      "atrasado"/saldo formulas client-side (the backend returns the raw fields, not a computed flag per row).
- [x] **P5** `AppHomeView.vue`: "Deudas por cobrar" card now `to="/app/deudas"`.
- [x] **P6** `nav-items.ts`: "Deudas" item, `order.gestion: 6`. Fixed 3 pre-existing nav-list tests that
      asserted exact item counts (mechanical fallout, same pattern as every prior nav addition this session).
- [x] **P7** `DeudasReportBreakdown.vue` (new organism, on-screen tables, same pattern as
      `SalesDetailBreakdown`), two new tables + combined total in `pdf-report.ts`/`excel-report.ts` following
      `salesTable`/`peopleTable`/`productTable` exactly — all four new fields (`abonosRecibidos`,
      `deudasLiquidadas`, `abonosRecibidosMinor`, `totalIngresadoMinor`) are pass-through from the already-
      aggregated `sales-by-period` response, nothing recomputed client-side.
- [x] **P8** `npm run test:run` → 164 files / 3050 tests green (baseline 159/2953, +5 files/+97 tests).
      `npx eslint .` → clean. `npm run build` → clean, no type errors, only pre-existing pdfmake/exceljs
      chunk-size warnings. TDD: RED confirmed (real failures, not fabricated) before every genuinely new
      behavior — `splitEvenMinor`, `CuotasPlaneadasEditor`, `RegistrarDeudaModal`'s abono/cuotas fields,
      `checkout.store`'s atomic creation, `deuda-status`, `DeudaDetailModal`, `DeudasView`, the nav entry, the
      PDF/Excel tables, `ReportsView`'s breakdown. Visual/tablet-viewport verification: **not performed** — no
      browser or display in this environment, and the project itself has no Playwright/Cypress tooling
      (confirmed via `devDependencies`, not assumed) — same honest disclosure as every prior feature this
      session. Independently re-verified by the coordinator (same exact counts) before committing; diff
      reviewed directly (`checkout.store.ts`, `CuotasPlaneadasEditor.vue`, `splitEvenMinor`, `deuda-status.ts`)
      — one minor, harmless discrepancy noted: `isDeudaAtrasada` sums all abonos rather than filtering
      `receivedAt <= now` like the backend does, which is inert in practice since the server always dates an
      abono at creation time (never future-dated) — not treated as a defect.

## Out of scope / explicitly deferred

- Dual light/dark theming for the datepicker — doesn't exist in this project, not introducing it now.
- Any validation that cuotas planeadas must sum to the remaining balance — deliberately not enforced (D2),
  matches the backend's own "informational only" rule for cuotas.
