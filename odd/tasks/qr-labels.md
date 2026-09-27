# QR codes per product and calibrated label sheets

Branch: `feat/qr-labels` (from `main` @ 19d93cc). Not pushed.

## Objective

1. Generate the QR of each product in the browser (no backend call, nothing persisted: recomputed from the id, which never changes),
   show it in the product edit modal and let the person download it as PNG.
2. Print many QR labels at once on OFITURIA sheets: A4, 72 labels per sheet, 35 mm x 25 mm each, 6 columns x 12 rows, with
   adjustable top/left offsets saved in `localStorage`, selection of many products in the catalog and a print dialog.

## Decisions (with evidence)

### D1. What the QR encodes
The sale scanner (`src/services/qr-scanner.ts`) hands the raw decoded text to `saleCatalog.findByScannedText(text)`, which matches the product id
(a UUID) exactly and also accepts a UUID embedded in a URL/prefix. The QR therefore encodes **exactly the bare product id** (36 chars, no URL,
no prefix, no newline). Proven by a round trip test that decodes the embedded PNG with the same engine as the scanner (zxing) and resolves the
decoded text through `findByScannedText`.

### D2. Libraries (scope change from the user: jsPDF for the label PDF, `qrcode` for the QR)
| Package | Version / last publish | License | Dependencies | Unpacked size | Notes |
|---|---|---|---|---|---|
| `qrcode` (chosen) | 1.5.4, 2024-08-05 | MIT | pngjs, yargs (CLI only), dijkstrajs | 135 KB | `toDataURL` with an integer `scale` (px per module): crisp raster in the browser (canvas) and in Node (pngjs), so the test decodes the exact PNG that is embedded |
| `uqr` (evaluated, not chosen) | 0.1.3, 2026-04-03 | MIT | none | 79 KB | returns only the module matrix; no PNG output (would need a hand-made PNG encoder) |
| `jspdf` (chosen for the label PDF) | 4.2.1, 2026-03-17 | MIT | @babel/runtime, fflate, fast-png (+ optional canvg, dompurify, html2canvas, core-js not used) | 30 MB unpacked (mostly bundles/typings) | `unit: 'mm'` gives direct millimetre math |
| `pdfmake` | already used by the reports | | | | stays untouched, only the reports use it |

No real problem was found with `qrcode`, so the user's preference stands. Both libraries are imported lazily (`import('qrcode')`,
`import('jspdf')`): nothing lands in the initial bundle (see the build evidence at the bottom).

### D3. QR image parameters
ECC `M`, a 36-char lowercase UUID is byte mode: **version 3, 29 x 29 modules**. Quiet zone: 4 modules for the on-screen/downloaded PNG (spec value),
2 modules inside the image for the label sheet (the white label paper around it adds more). Integer pixels per module (`scale`), never fractional.

### D4. Sheet geometry and the row pitch (the physics problem)
OFITURIA A4, 6 columns x 12 rows, 35 x 25 mm labels.
- Columns: 6 x 35 = **210 mm** = the exact A4 width. Column pitch is a fixed constant (35 mm).
- Rows: 12 x 25 = **300 mm**, an A4 is **297 mm**. An offset cannot fix it: the error accumulates row by row (0.25 mm per row, 3 mm by the last).
  So the calibration has three numbers, all editable and saved: `offsetTopMm`, `offsetLeftMm` (-10..+10 mm, step 0.1, negatives allowed) and
  **`rowPitchMm`, default 24.75 mm (= 297 / 12)**, range 20..26 mm. With 24.75 the 12 rows end exactly at 297 mm. The user can type 25 if they
  really want it: the plan reports `bottomOverflowMm` (3 mm) and the print dialog explains it. The design box of a label is min(pitch, 25) mm high.
- All math in mm, one rounding step (0.001 mm) per coordinate, never accumulated across cells (`cellOrigin` = offset + index x pitch).
- jsPDF: `new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })`, so the plan's mm go in unchanged. (A4 in jsPDF is 595.28 x 841.89 pt = 210.0016 mm.)

### D5. Label layout (numbers for a 35 x 24.75 mm cell)
| Item | Value |
|---|---|
| Safety margin to every cell edge | 1.5 mm -> inner box 32.0 x 21.75 mm |
| Name font | Helvetica 6 pt, line pitch 2.434 mm (x1.15), max 2 lines, centred, ellipsis "..." |
| Gap QR -> name | 0.5 mm |
| **QR box (below layout)** | min(32, 21.75 - 2 x 2.434 - 0.5) = 16.38 -> **16.35 mm** (floor to 0.05), centred |
| QR pixels | version 3 = 29 modules + 2 quiet = 33 modules; scale 12 -> 396 px over 16.35 mm = **~615 dpi**, 0.495 mm per module |
| Text block bottom | cell top + 1.5 + 16.35 + 0.5 + 4.868 = 23.218 mm <= 23.25 mm (cell bottom minus margin) |
| Side-by-side alternative | QR 21.75 mm, but the text column is only 9.75 mm wide (< 15 mm legible minimum) -> rejected |

The name goes **below** the QR: the side layout gives a 33 % bigger QR but leaves ~9 characters per line, which cannot identify a product.
No price on the label (it changes often). `evaluateLabelLayouts()` keeps this decision testable.

### D6. Text and images in jsPDF
Core fonts are Latin-1: Spanish accents and ñ work; emoji/CJK/etc. are replaced by a space (never a broken glyph) and whitespace is collapsed;
an empty result becomes "Sin nombre". Each unique id is rasterised once and embedded with `alias = id` (repeated ids reuse the image).
`doc.text(..., { align: 'center', baseline: 'top' })`: the plan's `y` is the top edge of each line.

### D7. Calibration persistence
`localStorage['la-marchanta-label-calibration']` = JSON `{offsetTopMm, offsetLeftMm, rowPitchMm}`, validated on read (bad JSON, wrong type, NaN, out of
range -> defaults/clamped), storage errors swallowed, saved on every change, "Restablecer" button.

## Checklist

- [x] **Q1** Client QR generation util + PNG download in the edit modal (commit 1)
- [x] **Q2** Label sheet planning + jsPDF render + calibration store (commit 2)
- [x] **Q3** Catalog multi-select + print dialog (commit 3)

## Evidence

### Commit 1 — client QR + PNG download
- `src/utils/product-qr.ts`: `isProductId`, `productQrDataUrl` (ECC M, integer scale, quiet zone 4 by default), `dataUrlToBlob`, `productQrBlob`,
  `productQrFileName` (`qr-<slug>-<8 chars of id>.png`). `qrcode` is imported only through `import('qrcode')` (a test fails otherwise).
- `ProductQrCard` molecule (alt text `Código QR de <name>`, download button, clear error messages) shown by `ProductFormModal` **only in edit mode**
  and only for a UUID id; token `--color-qr-paper` (white in both themes) added to `main.css` because the repo forbids fixed colors in components.
- **Compatibility proof** (`product-qr.roundtrip.test.ts`, Node environment): the PNG is decoded with zxing (the engine behind the scanner's
  `barcode-detector`); the decoded text equals the product id exactly (36 chars, no prefix/URL/newline) for the on-screen settings, the label
  settings (scale 12, quiet zone 2) and a small scale (4), for 5 ids incl. extremes; and `findByScannedText` resolves it to the product.
- PNG size = (29 modules + 2 x quiet zone) x scale exactly (370 px at the defaults); the quiet zone is white on all four sides.
- Bundle: the encoder lives in its own lazy chunk `browser-*.js` = **25.79 kB (10.14 kB gzip)**, referenced only with `import("./browser-*.js")`
  from the catalog chunk; the entry chunk (`index-*.js`, 225.49 kB) contains no QR code.
- Checks: 127 files / 2413 tests, lint clean, build ok.

### Commit 2 — label sheet plan + jsPDF renderer + calibration store
- `utils/label-sheet-plan.ts` (pure): geometry constants, `normalizeCalibration`, `cellOrigin`, `sheetCount`, `sanitizeLabelText`, `wrapLabelName`,
  `evaluateLabelLayouts`, `planLabelSheet`. 60 tests: page count math (0, 1, 72, 73, 144, 145, 1000), exact mm of cells (0,0) (5,0) (0,11) (5,11)
  with default / positive / negative / decimal offsets and a custom pitch, last cell of the last page, label inside its cell minus margins, QR centred
  and uniform, text <= 2 lines inside the cell, 25 mm pitch overflows by exactly 3 mm, determinism, invalid ids rejected.
- `services/qr-label-sheet.ts`: `generateQrLabelSheet(products, calibration)` renders the plan with a lazily imported jsPDF. Spy tests (fake jsPDF) assert
  the constructor options, every `addImage` (x, y, size, alias) and `text` coordinates equal the plan, `addPage` timing (73 -> one page break before the
  73rd), one QR per unique id and alias reuse. Real-jsPDF tests: PDF header, A4, 72 -> 1 page, 73 -> 2, 144 -> 2, 145 -> 3, repeated id does not grow the
  file per copy, emoji/CJK names do not fail. The round-trip test now decodes the QR with the renderer's REAL scale/quiet zone (12 / 2).
- `stores/label-calibration.store.ts`: persistence round trip in a new session, corrupted JSON, wrong types, unavailable storage, clamping, reset.
- Checks: 131 files / 2507 tests, lint clean, build ok. jsPDF is not in any chunk yet (nothing imports the renderer until commit 3).

### Commit 3 — catalog selection + print dialog
- `product-selection.store.ts`: selection mode + `Map id -> {id, name}` outside the visible list, so paginating/searching never drops it; order of
  selection = order on the sheet; inactive products cannot be selected; `selectAllMatching(search)` fetches every page (limit 100, never
  `includeInactive`), keeps only active products, is all-or-nothing on error, exposes progress and ignores a second call while running.
- `ProductSelectionBar` (Seleccionar / counter with `aria-live` / Seleccionar todos / Limpiar / Imprimir códigos QR only when >= 1 / Salir),
  `ProductCard` checkbox (native input, 44 px touch area, accessible label, disabled + hint for inactive), `ProductCatalogGrid` selection props
  (no selection in Modo Venta), `LabelPrintDialog` (sheet count text 72/73/144 -> 1/2/2 hojas, three numeric calibration fields with inline range
  validation that never emits an invalid value, overflow warning, help text: 100 % / no "Ajustar a la página" / calibrate with one plain-paper sheet
  / 12 x 25 = 300 mm vs 297 mm and the 24.75 default, busy + error states), `useLabelPrinting` composable (preview opens the tab BEFORE generating so
  the pop-up is allowed, blocked pop-up message, blob URL revoked after 10 min, download `etiquetas-qr-YYYYMMDD.pdf`).
- The view discards the selection on unmount and when switching to Modo Venta. Socios and colaboradores can both print (read-only).
- Storage keys: `la-marchanta-label-calibration` (calibration, JSON); the selection is not persisted on purpose (it is transient work).
- **Bundle**: entry chunk `index-*.js` 225.50 kB (unchanged, +0.01 kB); lazy chunks: `jspdf.es.min-*.js` **390.81 kB (128.85 kB gzip)**,
  `browser-*.js` (qrcode) 25.79 kB (10.14 kB gzip), `qr-label-sheet-*.js` 1.48 kB, plus jsPDF's optional chunks `html2canvas` 202.38 kB and
  `purify` 29.40 kB that this app never loads. **PWA**: like the report libraries, jsPDF/html2canvas/purify are excluded from the precache and cached
  at runtime on first use (CacheFirst `export-libs`, 8 entries); verified in the generated `dist/sw.js` (68 precache entries, 1889 KiB, none of them).
  The QR encoder and the renderer stub ARE precached (a product QR needs no internet). Guard test extended in `pwa-precache.test.ts`.
- Checks: see the final report of the commit.

## Manual checks on paper (cannot be verified by tests)
1. Print ONE sheet on plain paper at 100 % ("Tamaño real"), never "Ajustar a la página".
2. Hold it against an OFITURIA sheet to the light; adjust top/left margins (negative = up/left) until every cell matches; check the last row.
3. If the last rows drift, adjust the row height (24.75 mm default; try 24.70-24.80 before 25).
4. Scan a printed label with the phone camera in the sale screen: it must add the right product (16.35 mm QR, ~0.5 mm modules).
5. Check the printer does not add its own margins (some drivers scale to a printable area).
