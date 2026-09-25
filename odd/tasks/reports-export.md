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

## Tasks

- [ ] **B1 — Reports service + business-time date utilities (presets, normalization) + sales collector (paging until `from`) + report data builder.**
- [ ] **B2 — PDF builder (lazy pdfmake) + tests.**
- [ ] **B3 — Excel builder (lazy exceljs) + tests + file names + download helper.**
- [ ] **B4 — `ReportsView` + route + guard + nav item + tests.**
- [ ] **B5 — Docs, checks, browser pass (real downloads).**

## Evidence

_(filled as tasks close)_

## Next step

Writer B implements B1–B5.
