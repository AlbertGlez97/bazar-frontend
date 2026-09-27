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

(The label geometry, row pitch and layout numbers are added by the next commits.)

## Checklist

- [x] **Q1** Client QR generation util + PNG download in the edit modal (commit 1)
- [ ] **Q2** Label sheet planning + jsPDF render + calibration store (commit 2)
- [ ] **Q3** Catalog multi-select + print dialog (commit 3)

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
