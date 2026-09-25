# Reports with PDF / Excel export (Modo Gestión, socios only)

Reports view for socios: date range (default "hoy"), total sold and per-person breakdown, plus "Descargar PDF" (pdfmake) and "Descargar Excel" (exceljs). Contract of record: `doc/api-contract-for-frontend.md` §1.4, §1.5, §1.9, §6 (`GET /sales`) and §9 (Reports).

## Authority and boundaries

- Authorized root: `bazar-frontend/`, branch `feat/sales-and-reports` (continues after the sales screen work). Commit locally only; no push (user will confirm).
- TDD: ON (source: user request). Runner: `npm run test:run`. RED must be observed and recorded.
- Native review: unavailable in this clone (`.git` ownership error from `gentle-ai`). Ordinary functional checks only.
- Route: delegated direct, one bounded writer (B).

## Facts verified against the contract (drive the design)

- `GET /reports/sales-by-period?from&to` -> `{ from, to, totalSoldMinor, saleCount }`; `GET /reports/sales-by-member?from&to` -> `{ from, to, items: [{ memberId, memberName, role, totalSoldMinor }] }`. Both socio-only, both require `from` AND `to`, not paginated, only `completada` sales, anchored to `receivedAt`. `from`/`to` accept `YYYY-MM-DD` (business day, fixed UTC-6, inclusive) or a full ISO instant; the response returns them normalized to UTC. `from > to` answers 200 with zeros (no validation) — the UI must prevent it.
- The reports are AGGREGATES. A per-sale table needs `GET /sales`, which is socio-only, paginated (`limit` max 100, `sort=desc` by `receivedAt`) and has **NO date filter** (only `status`, `search` by seller name, `sort`, `page`, `limit`). Decision: fetch `GET /sales?status=completada&sort=desc&limit=100` page by page and stop as soon as a page reaches sales older than the normalized `from`; keep rows with `from <= receivedAt <= to` (the same anchor the reports use). A safety cap on pages (with a clear message when hit) avoids runaway downloads.
- A sale has `memberId` only (no name) and its items have `productId` only: seller names come from the `sales-by-member` items (every seller with a completed sale in the period appears there); item names are not needed (the export shows an article count = sum of quantities).
- There is NO payment-method field (the backend only supports cash), so the "forma de pago" column from the brief does not apply; the export carries cash received and change instead.
- Business day is UTC-6 fixed. "Hoy", "Ayer", "Esta semana" (business week is Sunday–Saturday per the commissions contract; for the reports a Monday-first week is NOT assumed: use Sunday–Saturday to match the backend) and "Este mes" must be computed in business time, not in the device's time zone. Dates in the exports are shown in business time (UTC-6).
- `pdfmake@0.3.x` and `exceljs@4.x` are already dependencies but not used yet; both are heavy: they must be loaded lazily (dynamic `import()` only when the person presses a download button), and their effect on the service-worker precache must be checked (`vite.config.ts` workbox `globPatterns`) and kept out of the precache if large.

## Decisions

- **Route**: `/app/reportes` (name `Reports`), `meta` for socio-only and Gestión-only enforced in the router guard: colaborador -> `/app`; Modo Venta -> `/app`; while on the page, switching to Modo Venta redirects out. Nav item "Reportes" only for socios in Modo Gestión (extend `src/layouts/nav-items.ts`).
- **Range**: presets (Hoy default, Ayer, Esta semana, Este mes) + two date inputs; invalid range (`from > to`) is refused in the UI with brand copy.
- **Consistency**: the totals printed in the files come from the detail rows; if they differ from the report's `totalSoldMinor`/`saleCount` (e.g. sales arrived while downloading), the UI shows a gentle note and suggests regenerating; nothing is silently wrong.
- **Files**: `ventas-la-marchanta-YYYY-MM-DD.pdf|xlsx` for a single day and `ventas-la-marchanta-YYYY-MM-DD_a_YYYY-MM-DD.pdf|xlsx` for a range.
- **Excel**: real numbers (pesos, `"$"#,##0.00` format) and real dates so it can be analyzed with formulas; a totals row with a SUM formula; sheet "Ventas" (one row per sale: fecha, persona, artículos, total, efectivo recibido, cambio) and sheet "Por persona". Seller names are written as plain strings (never as formulas: check for `=`/`+`/`-`/`@` leading characters).
- **PDF**: brand header (business name + range + generation date), table of sales, per-person summary, total at the end; brand colors from the guidelines tokens where practical; the mark as SVG only if it is cheap in pdfmake.
- **Testing**: the data builders (`buildSalesReport`, `buildPdfDefinition`, `buildWorkbook`) are pure and tested without rendering binaries; one round-trip test writes the workbook to a buffer and reads it back if it works under Vitest.

### Decisions taken while implementing (writer B)

- **Range**: "Esta semana" = Sunday of the current week -> TODAY; "Este mes" = the 1st -> TODAY (documented in `presetRange`). Presets query at once; custom dates only on "Actualizar"/Enter. A missing, inverted or future range is refused with brand copy and never queries; date inputs get `max = today (business time)`.
- **When the detail is collected**: only when a file is requested (viewing totals never pages `GET /sales`); it is cached per loaded range and reused for the second file; range controls are disabled while preparing.
- **Library usage** (read from their package files): pdfmake 0.3.11 `browser` field is the UMD `build/pdfmake.js` and the default Roboto vfs is `pdfmake/build/vfs_fonts` -> `import('pdfmake/build/pdfmake')` + `import('pdfmake/build/vfs_fonts')` + `addVirtualFileSystem`; `getBlob()`. `@types/pdfmake` already covers these entry points (no new types). exceljs 4.4.0: `import('exceljs')` (browser field -> `dist/exceljs.min.js` in the build), `writeBuffer()` -> Blob.
- **Business name**: not exposed by the API/session -> `APP_NAME`.
- **Money**: `formatMinorMoney` (`$1,250.00`, exact, no `Intl`) added to `src/utils/money.ts` (existing exports untouched); Excel cells are `minor / 100`, sums always in minor units.
- **Excel dates**: business wall-clock stored as a UTC-fielded `Date` so the cell shows the business time regardless of the reader's zone.
- **Precache**: `globIgnores` for `pdfmake-*`, `vfs_fonts-*`, `exceljs*` + `CacheFirst` runtime cache `export-libs`; a test ties the config to the dynamic import specifiers.

## Tasks

- [x] **B1 — Reports service + business-time date utilities (presets, normalization) + sales collector (paging until `from`) + report data builder.** `b4d3350`
- [x] **B2 — PDF builder (lazy pdfmake) + tests.** `4657134`
- [x] **B3 — Excel builder (lazy exceljs) + tests + file names + download helper.** `41fd44b`
- [x] **B4 — `ReportsView` + route + guard + nav item + tests (+ precache exclusion).** `ac32065`
- [x] **B5 — Docs, checks, browser pass (real downloads).** docs commit (`docs(reports): ...`, the last commit of the branch) — browser pass evidence below.

## Evidence

Baseline before this work: 80 files / 1204 tests, all green. Precache baseline: 50 entries (1587.93 KiB).

### B1 — `b4d3350`
- RED (observed, assertion failures against stubs): `business-time.test.ts` 27 failed; then `reports.service`, `sales-report-collector`, `sales-report` and `money formatMinorMoney` — 47 failed / 69 passed in that run; GREEN: all 116 passed after implementing.
- Tests cover: midnight boundaries (`05:59:59.999Z` = business day 24, `06:00:00.000Z` = day 25), `TZ` switched to Asia/Tokyo, America/Los_Angeles, Pacific/Kiritimati and UTC inside the test process (same answers), presets across week/month/year boundaries, collector stop-early / cap / inclusive boundaries / dedupe / empty / error propagation, exact minor-unit sums with `2147483647` amounts, ordering, unknown seller ("Sin nombre"), consistency mismatch.
- Note: a first `beforeEach(() => vi.mocked(...).mockReset())` returned the mock (Vitest treats a returned function as teardown) — fixed with braces.

### B2 — `4657134`
- RED: `pdf-report.test.ts` 17 failed against a stub (definition empty); `renderPdfBlob` tests failed with `renderPdfBlob is not a function` (2); `roleLabel` (1). GREEN after implementing: pdf tests + sales-report passed.
- Real render test (no mocks): the pdfmake browser build under jsdom returns an `application/pdf` Blob starting with `%PDF-`. Lazy-load test: importing / building the definition does not load pdfmake; fonts registered once.

### B3 — `41fd44b`
- RED: `excel-report` tests 19 failed against a `throw new Error('not implemented')` stub (the stub threw, so these were errors rather than assertion failures); `report-files` 5 assertion failures against a stub; `downloadPdf`/`downloadExcel` 3 (`is not a function`); shared helpers `rangeDescription`/`reportNotes` 4. GREEN: 523 tests in `src/utils`, `src/services`, `src/config` at that point.
- Round trip with real exceljs: sheets, header style/fill, frozen pane, autofilter `A1:F3`, real `Date` cells, money format, `SUM` formulas with cached results, names beginning with `= + - @` stay `ValueType.String` with `@` format.
- Deviation from the task split: `downloadPdf`/`downloadExcel` and the shared `report-palette.ts` landed in B3 (they need `saveBlob`); B2 exposes `renderPdfBlob`.

### B4 — `ac32065`
- RED: router tests 7 failed (route missing), nav tests 4 failed, `voice` collection error (`VOICE.reports` undefined), `ReportRangePicker`/`SalesReportSummary`/`ReportsView` failed to import; `pwa-precache` 4 failed before `globIgnores`/`export-libs`. GREEN: 94 files / 1422 tests.
- Two fixes found while going GREEN: `prepared`/`loaded` must be `shallowRef` (a reactive proxy broke report identity between PDF and Excel); the `loading` prop of `AppButton` hides the label, so the download buttons only use `disabled` + the "Preparando tu archivo…" status text.
- Bundle (`npm run build`): `pdfmake-*.js` 1,010.77 kB, `vfs_fonts-*.js` 855.12 kB, `exceljs.min-*.js` 940.21 kB — separate lazy chunks; main `index-*.js` 222.18 kB (was 220.55 kB). Without exclusion the precache was 57 entries / 4357.77 KiB; with `globIgnores` it is **54 entries / 1617.45 KiB** (baseline 50 / 1587.93 KiB: +4 entries = `ReportsView` chunk/css and shared ones, +29.5 KiB). None of the three chunks is in the `dist/sw.js` precache manifest; the runtime rule `export-libs` is present.

### B5 — browser pass (Edge headless via Playwright, production build served by `vite preview`, REAL `bazar-api` `dist` on a throwaway Postgres)
- Setup (all torn down afterwards): container `b5-report-pg` (postgres:16, port 55432, tmpfs, no volume), `prisma migrate deploy`, runtime role, seed (2 socios, device `shared-tablet`), API on :3000, preview on :5173. The existing `bazar-api-postgres-1` / `-test-1` containers and volumes were not touched. Fixtures: 5 products; a colaborador "Carlos Núñez" and a colaborador named `=HYPERLINK("http://x.test","clic")` inserted by SQL (there is no public endpoint); 238 real `POST /sales` (8 hand-made with awkward amounts such as $0.03 and $1,250.00, plus 230 small ones so `GET /sales` needs 3 pages). `receivedAt` is server time, so to get multi-day data the `receivedAt` of 12 sales was moved by SQL to exact boundary instants (day changes `05:59:59.999Z` / `06:00:00.000Z`, Sunday 00:00 of the week, the 1st of the month, the last ms of August) and one sale was flipped to `rechazada_por_conflicto` (reports must not count it). That is the only manipulation.
- Real interactions verified (script kept outside the repo; final run: every check PASS, exit 0):
  - Login through the real UI (user/password, device identify, pick person) as socio Alberto in Modo Gestión: nav shows Inicio, Productos, Vender, **Reportes** (last); title "Reportes".
  - Hoy: on-screen total `$57,873.79` / 226 sales = API `sales-by-period` = SQL; per-person table = API (names, roles, totals, order). Ayer, Esta semana, Este mes and Hoy each equal API and SQL (counts and totals); date inputs reflect business dates.
  - Inverted range: message shown, "Actualizar" disabled, **zero** extra requests; future end date and empty date show their messages; a custom range 20–24/09 queries only after "Actualizar" and sends `from=2026-09-20&to=2026-09-24`.
  - Day without sales (real API zeros): empty state, both downloads disabled. Real offline (`setOffline`): brand message + "Intentar de nuevo"; back online it recovers.
  - Touch targets measured: presets 62x44 and 94x44, Actualizar 114x45, Descargar PDF 148x45, Descargar Excel 157x45, date inputs 148x50 (all >= 44x44).
  - Downloads (Playwright `download` events, files saved and opened with tools outside the repo): PDF `ventas-la-marchanta-2026-09-25.pdf` — `%PDF-`, 6 pages, pdfjs text contains business name, "Ventas del 25/09/2026", "Generado el 25/09/2026 13:01", every sale row with `dd/mm/yyyy hh:mm` in business time, accents/ñ/`$`, the `=HYPERLINK(...)` name as text, footer "Página 1 de 6" … "Página 6 de 6", and the last page with the per-person table and `Total vendido $57,873.79 · 226 ventas · 570 artículos`; page 1 was rendered to PNG and inspected (brand mark, terracotta header, zebra rows). XLSX `ventas-la-marchanta-2026-09-25.xlsx` (opened with exceljs): sheets Ventas / Por persona / Resumen, header + filter `A1:F227` + frozen pane, 226 rows with numeric amounts and real dates, sum of rows in cents = API total (5,787,379), totals row `SUM(D2:D227)` with cached result 57873.79, 74 cells with the `=HYPERLINK` name are strings, first-row date = business wall-clock of the oldest sale of the day, "Por persona" = API, "Resumen" = business / period / total.
  - Range names and boundaries: `ventas-la-marchanta-2026-09-01_a_2026-09-25.xlsx` (235 rows = API = SQL; first row `2026-09-01 00:00` included, the sale at `2026-09-01T05:59:59.999Z` excluded), `..._2026-09-20_a_2026-09-25.xlsx` (starts Sunday 20 00:00, Saturday 19 23:59 excluded), Ayer PDF `ventas-la-marchanta-2026-09-24.pdf` (contains 24/09 23:59, not 25/09 00:00).
  - Paging and laziness: the first download issued exactly 3 requests `status=completada&sort=desc&page=1..3&limit=100`; the Excel that followed made 0 more (cache). While only viewing reports: no `GET /sales` and no pdfmake / vfs_fonts / exceljs requests; `pdfmake-*.js` + `vfs_fonts-*.js` were requested only after pressing "Descargar PDF" and `exceljs.min-*.js` only after "Descargar Excel". "Preparando tu archivo…" appeared with both buttons disabled (detail request delayed 700 ms on purpose); success toast "Listo, se descargó ventas-la-marchanta-2026-09-25.pdf."
  - Access control: switching to Modo Venta while on the view leaves it (-> `/app`) and the nav item disappears; direct URL `/app/reportes` in Modo Venta redirects to `/app`; back in Gestión the direct URL enters. Colaborador (Carlos): no nav item in either mode, direct URL redirects to `/app` in both modes, zero requests to `/reports`.
  - Console/page errors: none for the colaborador; for the socio only the two requests cut on purpose by `setOffline` (`ERR_INTERNET_DISCONNECTED`).
- Not verified in the browser: service-worker runtime caching (`export-libs`) — the pass ran with service workers blocked; only the generated `sw.js` was inspected. The "consistency mismatch" warning was not reproduced against the real API (a sale arriving mid-download); it is covered by unit and view tests. The Excel was opened with exceljs, not with Microsoft Excel or LibreOffice.

### Final checks (after the last code change)
- `npm run build`: exit 0. `npm run lint`: exit 0. `npm run test:run`: exit 0, **94 files / 1422 tests passed** (baseline 80 / 1204).

## Deviations from the brief

- `downloadPdf` / `downloadExcel` and `report-palette.ts` were added in B3's commit (they depend on `saveBlob`); B2 ships `renderPdfBlob` and the pure definition.
- Two presentational components were added in B4 (`ReportRangePicker`, `SalesReportSummary`) to keep the view a container; touch-target and voice guards were extended.
- The workbook has three sheets in this order: Ventas, Por persona, Resumen (the brief allowed a "small block or sheet").
- "Por persona" also carries the sale count and the share of the total.

## Money arithmetic in the report builder (change requested after the browser pass)

`buildSalesReport` summed cents with raw `+`. Totals and per-person subtotals now go through `addMinor` (dinero.js, `utils/money.ts`); see the evaluation in `odd/tasks/sales-screen.md`. Integer sums were already exact; the change centralizes them and makes an out-of-range sum fail loudly. Percent shares and the Excel `minor / 100` cell values are display conversions and stay as they were.

## Known limits

- No payment-method column (the backend only supports cash). Business name is `APP_NAME`, not per business (the API and session do not expose it).
- The detail is capped at 100 pages (10,000 sales); beyond that the file says it may be incomplete. Very long periods make `GET /sales` paging slow: the API has no date filter (a server-side filter or a detail endpoint would remove this).
- The collector pages from the newest sale down to the start of the range; a range far in the past pages through all newer sales first.
- Fonts: Roboto (bundled by pdfmake), not the brand fonts; emoji or unusual scripts in seller names may not render in the PDF.
- The detail comes from separate requests, so a sale registered while preparing a file can make it disagree with the screen (flagged, not hidden).
- pdfmake/exceljs are cached only after first use; a first download without internet cannot generate the file (the error message says so).

## Next step

User review of the local commits on `feat/sales-and-reports`; push and PR remain the user's decision.
