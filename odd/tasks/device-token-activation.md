# Device activation with a one-time code and a device token

Branch: `feat/device-token-activation` (from `main` @ `e3909d5`). No push until the user says so.
Scope: only the part of the frontend that does not depend on the backend endpoints still being built
(`POST /members`, `POST /auth/change-password`). Settings, team and devices screens come later.

## Objective

bazar-api (BE-12) now activates a device with a ONE-TIME identifier and answers `{ deviceId, deviceToken }`
once; from then on ContextGuard needs `x-device-id` + `x-device-token`. Devices that existed before
(legacy: active, no token) keep working with `x-device-id` alone. The frontend must keep the token,
send it, never keep the burned identifier, and explain a used identifier apart from wrong credentials.

## Backend contract relied on

- `POST /devices/identify` `{ identifier, name }` (JWT): new flow -> `{ deviceId, deviceToken }`; legacy ->
  `{ deviceId }`; wrong credentials -> 403; identifier already used or device revoked -> 409 with a Spanish
  `message`.
- ContextGuard: a device with a token must send `x-device-token`; a legacy device must not need it.

## Decisions

1. **Stored shape** (`localStorage.device_context`): `{ deviceId, name, deviceToken? }`. The identifier is not
   stored anymore (it stops working once used and is a secret while pending).
2. **Legacy migration, not deletion:** a stored `{ deviceId, identifier, name }` is read, rewritten without the
   identifier and keeps working without a token. Corrupt values (non-string fields, empty/non-string token,
   arrays, null) are still discarded.
3. **The interceptor owns `x-device-token`.** It adds the token only when the effective `x-device-id` of the
   request equals the session device, so an offline-queued sale that carries another device id never gets the
   wrong token (that would only cause a 403). The token is read at SEND time, so a sale queued before the
   activation uses the current token when it finally syncs. Nothing was added to `sales.service.ts` or to the
   pending-sale payload: the token is never written to IndexedDB nor sent in a body.
4. Header builders found: only `src/services/api.ts` (interceptor) and `src/services/sales.service.ts`
   (explicit `x-member-id`/`x-device-id` per sale, which the interceptor completes). `members.service.ts` only
   mentions the headers in a comment.

## Tasks

- [x] **T1 Token kept and sent.** Types, session store with legacy migration, interceptor, tests.
- [x] **T2 Used identifier explained.** `SelectContextView` / `DeviceIdentifyForm`: 409 message distinct from 403.
  * Copy lives in `VOICE.device` and `deviceIdentifyError(cause)` (`src/config/voice.ts`), the project's copy module.
  * 409 -> the server `message` when it is a non-empty string (it already comes in Spanish and tells "already
    used" from "revoked"), else the fallback "Este identificador ya fue usado. Pide a un socio que te genere
    uno nuevo."; shown as a WARNING alert. 403 keeps its old text as an ERROR alert. Anything else keeps the
    generic "No pudimos verificar el dispositivo...". The message never includes what was typed.
  * `DeviceIdentifyForm` got an `errorType` prop (`'error'` default, `'warning'`); it stays editable so the
    person can retry, and a successful retry clears the alert.

## Known follow-up (out of scope)

A revoked or reissued device gets 403 on every guarded request. It needs a recovery path (clear the stored
device with `clearDevice()` and return to `SelectContext`). There is deliberately no global 403 handler yet: a
403 also means "colaborador on a socio-only endpoint".

## Progress and evidence

- T1: commit `feat(devices): keep the activation token and send it as x-device-token` (RED: 24 failing tests
  before the store/interceptor changes; GREEN: full suite, lint and build).
- T2: commit `feat(devices): explain an already used identifier apart from wrong credentials` (RED: 15 failing
  tests before the change; GREEN: full suite, lint and build).

## Next step

Settings, team and devices screens, once the backend `POST /members` and `POST /auth/change-password`
endpoints and the updated api contract exist.
