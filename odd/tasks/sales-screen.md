# Sales screen (Modo Venta) with offline queue

Real sale screen for "Modo Venta": catalog + cart side by side, QR scan, cash and change, charge, success / conflict / saved-offline results, and an offline-first queue in IndexedDB with idempotent sync. Contract of record: `doc/api-contract-for-frontend.md` §1.4, §1.6, §1.9, §6 (Sales).

## Authority and boundaries

- Authorized root: `bazar-frontend/`, branch `feat/sales-and-reports` (from `feat/ui-mode-selector`, which is unpushed). Commit locally only; no push (user will confirm).
- TDD: ON (source: user request, "Pruebas exhaustivas (TDD)"). Runner: `npm run test:run` (Vitest, jsdom). RED must be observed and recorded before each behavior.
- Native review: unavailable in this clone (`gentle-ai review mode status` = off, and it errors on `.git` ownership by another Windows account). Ordinary functional checks only.
- Delivery: forecast far over 400 authored lines. Slicing into PRs is decided when the user asks to push (no PR now). One work-unit commit per task.
- Route: delegated direct; sequential writers: A1 (domain + offline), A2 (UI), then Part B in its own record `odd/tasks/reports-export.md`.

## Facts verified against the contract and the repo (drive the design)

- Server ignores `unitPriceMinor` and computes the total; it answers **201 `completada`**, **201 `rechazada_por_conflicto`** (body, not an HTTP error), **200** idempotent replay, **409** same id/different payload, **400** business errors (`Insufficient stock for product <id>`, `Cash received is insufficient...`, `Product <id> is deactivated...`, `Product <id> does not exist...`), **403** attribution mismatch (`memberId`/`deviceId` in the body must equal `x-member-id`/`x-device-id`).
- Contract §1.6: a sale whose stock is already insufficient when it is synced later gets **400, not a persisted conflict**; the client must NOT retry a 400 forever. Only a concurrent race yields 201 conflict.
- "Same payload" for idempotency = `memberId`, `deviceId`, `currency`, `cashReceivedMinor`, `occurredAt` (instant) and the set of `{productId, quantity}`. So a queued record must freeze `occurredAt` and the exact items; retries send the identical body.
- `GET /sales/:id` confirms what was persisted after a lost response (404 if it never arrived).
- `Product.category: string | null` exists, so category quick filters are applicable.
- `products.store` holds only the current page (default limit 20, max 100), so it is NOT the "local catalog". The sale screen needs the whole active catalog: a dedicated loader that pages with `limit=100`.
- `uuid` is NOT a direct dependency (only `uuid@8.3.2`, transitive from `exceljs`, which has no `v7`). `idb@7.1.1` is only transitive (workbox). Both must be added as direct dependencies (uuid >= 10 for `v7`).
- `src/services/api.ts` already sends `Authorization`, `x-member-id`, `x-device-id` from the session store. `displayToMinor` in `utils/money.ts` is digit-based (no float trap); `saleSuccessMessage()` exists in `src/config/voice.ts`.
- `pdfmake` and `exceljs` are already dependencies (Part B).

## Decisions

- **Route**: `/app/venta` (name `Sale`), reachable in any mode (no dead-end redirects for someone who is not computer-savvy); the sidebar shows "Vender" always, and "Reportes" only for socios in Modo Gestión.
- **Local catalog**: dedicated store that loads all active products (`limit=100` pages), does search/category filtering client-side, and persists a snapshot in IndexedDB so a refresh while offline still has a catalog (decision: yes, needed for the offline promise; cost is one object store). The catalog view is stale-tolerant: it shows a soft note when it is using the saved copy.
- **Local stock**: after a sale is accepted (online or queued) the local catalog decrements stock; the cart cannot exceed local stock; `unica` max 1; zero stock is shown as agotado and is not addable.
- **Money**: integer minor units only, `displayToMinor` for the cash input, no float arithmetic. Total shown on screen is computed locally from the catalog price; on success the SERVER's `totalMinor`/`changeMinor` are shown when available, local ones when the sale was queued.
- **Sale id/timestamp**: UUID v7 generated when "Cobrar" is pressed (not when the cart is created); `occurredAt` = device now, frozen inside the record. If the cart changes after a failed attempt, a new id is generated.
- **Submit flow**: offline (`navigator.onLine === false`) -> enqueue and show "saved" result. Online -> POST. Network error / timeout / 5xx / no response -> enqueue the SAME record (the outcome is unknown, the idempotent replay resolves it). 201/200 `completada` -> success. 201/200 `rechazada_por_conflicto` -> conflict result (never the success screen). 400/409 online -> honest "no se pudo registrar" with friendly reason, nothing queued, cart kept. 401/403 -> keep in queue / ask to log in again, never drop a sale.
- **Queue**: IndexedDB database `la-marchanta`, stores `pending-sales` (keyPath `id`; payload, createdAt, state `pending` | `needs_review`, attempts, lastError, sellerName for display) and `catalog-snapshot`. Sync is sequential in creation order; each request sends the record's own `memberId`/`deviceId` as headers (they must match the body); triggers = `online` event, app start, periodic timer while items are pending; an in-memory mutex (plus `navigator.locks` when available) prevents overlapping runs. A record is removed only after a definitive server answer. `completada` -> removed. `rechazada_por_conflicto` or 400/409 during sync -> `needs_review` (never retried, never silently deleted) with a friendly reason; the UI shows a calm indicator and lets a socio/seller dismiss it after reading. Network errors, 5xx, 401 stop the run and leave everything pending.
- **Indicator**: "X ventas pendientes de sincronizar" (calm, brand voice) plus a separate soft note for `needs_review`.
- **QR**: library chosen after checking maintenance, Vue 3 / browser support and offline behavior (no runtime CDN fetch; WASM must be bundled so it works offline in the PWA). QR content = product id. Unknown code -> friendly message.
- **Components**: atom `QuantityStepper`; molecules `CartLineItem`, `CartSummary`, `CashInput`, `CategoryQuickFilter`; organisms `SaleCart`, `SaleCatalogPicker` (reuses `ProductCatalogGrid mode="venta"` where it fits); view `views/sales/SaleView.vue`. Respect the barrel rules (molecules do not import organisms; `ui/` does not read stores; the view/container connects stores). Touch targets >= 44x44.

## Tasks

- [x] **A1.1 — Direct deps (`uuid`, `idb`, `fake-indexeddb` dev) + sales types + `sales.service` (POST/GET) + sale payload/id builder (UUID v7).**
- [x] **A1.2 — Cart logic (`cart.store`): add/increment/decrement/remove, stock limits, exact total and change (money tests).**
- [x] **A1.3 — IndexedDB layer + offline queue + sync engine (states, headers per record, idempotent replay, mutex, triggers).**
- [x] **A1.4 — Sale catalog loader/store (all pages, client search + category, IDB snapshot, local stock decrement).**
- [x] **A1.5 — Submit orchestration (`useSaleCheckout` or store action): online/offline/network-error/conflict/400 outcomes.**
- [ ] **A2.1 — QR scanner (library choice recorded) + scan component.**
- [ ] **A2.2 — Atoms/molecules: QuantityStepper, CartLineItem, CartSummary, CashInput, CategoryQuickFilter.**
- [ ] **A2.3 — Organisms: SaleCart, SaleCatalogPicker; sync indicator.**
- [ ] **A2.4 — SaleView (states: selling / success / conflict / saved offline / error), route, sidebar nav by mode, sync bootstrap.**
- [ ] **A2.5 — Brand guidelines + this record; checks; browser pass (incl. offline/online).**

## Evidence

### A1.1 (commit f1d5c08)

- RED: `sale.test.ts`, `sale-errors.test.ts`, `sales.service.test.ts` failed to load (`Failed to resolve import "../sale" / "../sale-errors" / "../sales.service"`); `voice.test.ts` failed to load (missing exports `saleConflictMessage`, ...); `api.test.ts > respeta x-member-id/x-device-id ya presentes en la petición` failed with `AssertionError: expected 'm-actual' to be 'm-de-la-venta'`.
- GREEN: same 5 files, 79 tests passed; `vue-tsc -b` and `eslint` clean on the touched folders.
- Decisions: `uuid@^14.0.2`, `idb@^8.0.3` (runtime), `fake-indexeddb@^6.2.5` (dev). The brief's premise "uuid is already a dependency" was wrong (only transitive 8.3.2). `api.ts` request interceptor now keeps `x-member-id`/`x-device-id` already present on the request (session values are only defaults) so the queue can send each record's own attribution; `createSale` always sets them from the payload. `createSale` returns `{ outcome: 'completed' | 'conflict', httpStatus, replayed, sale }` and throws `UnexpectedSaleResponseError` (classified `server`) when a 2xx body is not a sale of that id (captive portal / proxy HTML). `classifySaleError`: no response -> `network`; 5xx/408/429 -> `server`; 401/403 -> `auth`; 409 -> `conflict-payload`; every other 4xx (400, 413, 404, 422) -> `business` so one poisoned record cannot block the queue. `buildSalePayload` merges repeated `productId` lines (sum, first-appearance order) and validates ranges (throws `RangeError`).

### A1.2 (commit 8d43aa5)

- RED: `cart.store.test.ts` failed to load (`Failed to resolve import "../cart.store"`; 0 tests ran).
- GREEN: 39 tests passed (exact money: 3 x 19.99 = 5997, 10 + 20 = 30, price 0 with cash 0 chargeable, cash "100" / "100.5" / "100,50" / "" / "abc" / "-20" / "1e5", clamp to 2147483647, 500-line and 100000-quantity contract limits). `vue-tsc -b` and `eslint src/stores` clean.
- Decisions: mutations return `{ ok: true } | { ok: false, reason }` with reasons `out-of-stock | already-in-cart | max-stock | min-quantity | not-in-cart | cart-full`. `decrement` at 1 keeps 1 (`min-quantity`); removal is explicit `remove`. `increment` of an `unica` is `max-stock`. `clear()` empties lines AND cash. Added `setQuantity`, `setCashMinor` and a `signature` computed (`cash|sorted productId:quantity`) that A1.5 uses to know when the cart changed and a new sale id is needed (idempotency compares cash + productId/quantity set, not prices).

### A1.3 (commit cd34899)

- RED: `local-db.test.ts`, `sales-queue.test.ts` and `sales-sync.test.ts` failed to load (`Failed to resolve import`; 0 tests ran). After implementing local-db, queue and engine, the first run of `sales-sync.test.ts` showed 8 failures caused by a test-harness bug (`expected "spy" to be called 1 times, but got 0 times`: the helper returned the default mock instead of the overriding one); fixed in the test, not in the code. `sales-sync-scheduler.test.ts` was written before its implementation but I ran it only after implementing it; RED was then observed retroactively by moving the implementation away (suite failed to load, 0 tests ran). `sales-queue.store.test.ts` failed to load before the store existed.
- GREEN: the five new suites pass (55 tests for local-db + queue + engine, 18 scheduler, 11 queue store = 84). Full suite at that point: 63 files / 777 tests passed. `vue-tsc -b` and `eslint src` clean.
- Decisions: layout = `services/local-db.ts` (idb wrapper, snapshot helpers), `services/sales-queue.ts`, `services/sales-sync.ts` (pure engine `createSalesSync(deps)`), `services/sales-sync-scheduler.ts` (pure timers and backoff), `stores/sales-queue.store.ts` (Pinia wiring with the real deps). `enqueue` returns `{ ok: true, record, alreadyQueued } | { ok: false, reason: 'storage-unavailable' }`; the other queue functions throw `LocalDbUnavailableError`; the snapshot helpers return `false` / `null`. Concurrent `syncPendingSales()` calls share the in-flight run (one send per record); `navigator.locks.request(..., { ifAvailable: true })` guards several tabs (`locked-elsewhere` when another tab holds it, and a broken `locks` falls back to running). The engine refuses to send without a session token (`not-authenticated`) so a queued sale never triggers the 401 redirect. Backoff 30 s, 60 s, 120 s, 240 s, capped at 300 s; `offline` and `locked-elsewhere` do not count as failures. The timer only runs while there are pending records and the browser is online. There is no module-level `syncPendingSales()`: use `useSalesQueueStore().syncNow()` (or `createSalesSync` with injected deps).

### A1.4 (commit a549758)

- RED: `sale-catalog.store.test.ts` failed to load (`Failed to resolve import "../sale-catalog.store"`; 0 tests ran). First GREEN run: 34 passed, 1 failed: `la búsqueda es por subcadena y recorta espacios` (`expected [] to deeply equal [ 'a' ]`), caused by a typo in the test (`'ola'` is not a substring of "Café de olla"); fixed in the test.
- GREEN: 35 tests pass (3-page paging with `limit=100`, empty page safety stop, cross-page dedupe, snapshot saved and used on failure incl. mid-paging failure, no-snapshot error states, accent/case-insensitive search, exact category, combined filters, Spanish category ordering, QR lookup incl. UUID inside a URL, stock decrement + persistence + reload from snapshot, IndexedDB unavailable). `vue-tsc -b` and `eslint src` clean.
- Decisions: `load()` never throws and shares one in-flight request; `isFromSnapshot` means "not a fresh server load" (also set when a reload fails but products are already in memory, which are at least as recent as the snapshot). `category === ''` means "all" (the UI renders the "Todas" option; `categories` lists only real ones). `findByScannedText` accepts the bare id, or a UUID embedded in a URL/prefix. `applySoldItems(items: { productId, quantity }[])` accepts `CartLine[]` directly, replaces product objects (reactive), and keeps the snapshot's `savedAt` equal to `lastLoadedAt`. `products.store`/`products.service` untouched.

### A1.5 (commit 9d48355)

- RED: `checkout.store.test.ts` failed to load (`Failed to resolve import "../checkout.store"`; 0 tests ran). After implementing, all 32 tests passed on the first run, so I ran a mutation check to be sure the suite has teeth: forcing `outcome === 'conflict'` to never match and disabling the once-per-attempt stock guard made 3 tests fail (`201 rechazada_por_conflicto: kind conflict...`, `200 idempotente de una rechazada sigue siendo conflict`, `error de red y reintento con el MISMO id...`); the original code was restored and passes.
- GREEN: 32 tests pass (blocked reasons, 201 success with SERVER totals, exact contract body, 200 replay, conflict never success and no stock decrement, 400/409 rejected with nothing queued, 401/403 auth-needed with the sale kept in the queue, offline straight to queue without calling the service, network / timeout / 500 / 503 saved-offline, retry with the same id producing the identical body and a single stock decrement, queued copy dropped after a definitive answer, IndexedDB unavailable failed-to-save, frozen id/occurredAt, new id when cart / cash / seller changes, `startNewSale`, double tap sends once, `loading` reset).
- Final verification (all run after A1.5): `npm run build` exit 0 (vue-tsc + vite build, PWA precache 39 entries), `npm run lint` exit 0, `npm run test:run` exit 0 with 65 files / 844 tests (baseline was 54 files / 589 tests; +11 files, +255 tests).
- Decisions: store (`useCheckoutStore`), not a composable, because the view reads `loading`/`lastResult` and the frozen attempt must survive component remounts. Added result kind `blocked` (`empty-cart | cash-insufficient | missing-context`) for the refusal case the brief did not give a kind for; `auth-needed` also carries `pendingId`, totals and `message`; `failed-to-save` carries `message`. `auth-needed` also decrements local stock (the sale is safe in the queue and will happen). Stock is decremented at most once per attempt. After a definitive server answer for an id that was enqueued earlier in the same attempt, the queued copy is removed. Known limit: if an attempt was enqueued (stock decremented locally) and the retry then comes back `conflict`, local stock stays low until the next catalog load.

## Next step

A1 done (commits above). Writer A2 (UI) next, using cart / checkout / sale-catalog / sales-queue stores; then Part B (`odd/tasks/reports-export.md`).
