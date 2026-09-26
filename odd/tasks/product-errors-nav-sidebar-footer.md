# Product-save errors, Vender in Gestión, sidebar footer

Branch: `fix/product-errors-nav-and-sidebar-footer` (from `main` @ e7d1c5f). No push.
Three bugs found on a real phone. Each has its own commit. Root causes below are backed by evidence; what only a phone can confirm is listed at the end.

## Bug 1 — "No pudimos guardar el producto. Intenta de nuevo."

### Evidence (real backend, isolated probe business, cleaned up afterwards)
- `POST /api/v1/products` with the exact JSON `ProductForm` builds (`unica`: `{name,tipo,unitPriceMinor}`; `cantidad`: `+initialStock`; full: `+category,purchaseCostMinor,supplier,notes`) -> **201** for a socio.
- Same request as a colaborador (shared login choosing a colaborador member, or a bound colaborador account) -> **403** `Only socios may access this resource`.
- 400 only for malformed data: non-integer price, empty-string `category`, unknown property. Price 0 and `purchaseCostMinor: null` are accepted.
- **Stale device id** (a device id that no longer exists in the database): `GET /products` (AuthGuard only) -> **200** with an empty list; `POST /products` (SocioGuard -> ContextGuard) -> **403** `Selection is not authorized for this context`.
- The backend log shows no 5xx around the attempts (Nest does not log 4xx). The dev database held no real product at all.

### Root cause
Two layers, both confirmed:
1. **The UI swallowed the reason.** `ProductCatalogView` had bare `catch { toast.error('No pudimos guardar el producto. Intenta de nuevo.') }` in create, update, deactivate, reactivate and the list/search/page loaders. Status and body were discarded, so a 403 and a 400 looked identical.
2. **Most likely trigger (matches the symptom "the catalog loads empty, creating fails"): a stale stored device.** `session.store.ts:88` defines `isDeviceIdentified = !!deviceId`, and logout deliberately keeps the device (`clearOnLogout` only clears the person). After the dev database was wiped and re-seeded, the phone still held the old `device_context`, so the identification form was skipped and every ContextGuard route answered 403 `Selection is not authorized for this context`. `GET /products` only needs AuthGuard, so the list kept working. This was the "revoked or reissued device has no recovery path" follow-up recorded earlier.
The colaborador hypothesis is weak: the catalog already hides "Nuevo producto" and the card actions for non-socios (`isSocio && !isVenta`, `:show-actions="isSocio"`); that behavior existed and is tested.

### What changed
- `src/utils/api-error.ts`: `describeApiError` (kind, status, message, detail) and `describeFailure(action, error)`. 403 "Only socios" and 403 "Selection is not authorized" have their own copy; 400 class-validator messages are mapped to friendly Spanish for known fields and the first raw message is shown for unknown ones (capped, never HTML); 404, 409 (server message when plain text), 5xx and network have their own copy. The HTTP code is appended for support: `(código 403)`. Never exposes tokens, headers or request bodies. An error that is neither network nor HTTP keeps the historical text (`… Intenta de nuevo.`) with no code.
- `ProductCatalogView`: every action reports the real reason. On `context-lost` a persistent warning appears with a button "Volver a identificar este dispositivo" that clears the stored device and person and goes to `SelectContext`. **Nothing is cleared automatically** (queued offline sales keep their own device id).
- Read-only note for non-socios in Modo Gestión: "Solo los socios pueden cambiar el catálogo." (the hidden actions already existed).
- Copy lives in `VOICE.apiErrors` (`src/config/voice.ts`).

### Decisions
- Recovery is user-initiated: a generic 403 handler in the Axios interceptor was NOT added (a 403 also means "colaborador on a socio-only endpoint"). Only the catalog view offers the recovery today; other ContextGuard screens would need the same treatment (follow-up).
- Read-only catalog for non-socios reuses `session.member.role`, the same source as the nav and the route guards.

## Bug 2 — "Vender" shown in Modo Gestión
(filled in by the second commit)

## Bug 3 — sidebar footer disappears when expanded
(filled in by the third commit)

## Checklist
- [x] Bug 1 util + view + tests
- [ ] Bug 2
- [ ] Bug 3

## Evidence
- Bug 1: `api-error.test.ts` (38 cases) and `ProductCatalogView.errors.test.ts` (22 cases) RED first (module missing / 18 failing), then GREEN.

## Needs a phone to confirm
- That the toast on the failing phone shows "(código 403)" and the "no reconocido" text (proves the stale-device diagnosis on that phone), and that the "Volver a identificar este dispositivo" button leads to the identification screen.
