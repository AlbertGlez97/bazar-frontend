# Settings: gear menu, change password, team and devices

Branch: `feat/team-and-devices-settings` (stacked on `feat/device-token-activation` @ `0fcd8fa`). No push until the user says so.

## Objective

bazar-api (BE-12) can now add people (`POST /members`) and manage devices (`POST/GET /devices`, revoke, reissue)
and lets anyone change their own password (`POST /auth/change-password`). The frontend gets:

1. A gear icon in the sidebar footer, next to the name, that opens a settings screen.
2. "Cambiar mi contraseña" for EVERYONE.
3. "Mi equipo" and "Dispositivos" for SOCIOS ONLY.

## Backend contract relied on (read from bazar-api sources)

- `GET /members` -> `[{ id, name, role, active }]`.
- `POST /members` (socio) `{ nombre, apellidos, correo, role, commissionRateBps? }` -> 201
  `{ id, name, role, active, commissionRateBps, createdByMemberId, username, credentialsEmail: 'member' | 'approver-fallback' }`.
  `commissionRateBps` is an integer 0..10000 (1000 = 10.00%), only for a colaborador. Errors: 400, 403, 409 (username
  race), 502 (credentials email not sent, nothing created). Never a password in the response.
- `GET /devices` (socio) -> `[{ id, name, status, legacy, createdAt, activatedAt, revokedAt, identifier? }]`
  (`identifier` only while `pendiente_activacion`). `POST /devices` `{ name, correoEnvio? }` -> 201, identifier
  returned unless emailed (then `deliveredTo: 'recipient' | 'approver-fallback'`). `PATCH /devices/:id/revoke`,
  `PATCH /devices/:id/reissue` `{ correoEnvio? }`.
- `POST /auth/change-password` `{ currentPassword, newPassword }` -> 204. Wrong current password is **403** (on
  purpose not 401, so the interceptor does not log the person out). 400 = the new one is rejected (10..128 chars,
  different from the current one). The backend commit lands in parallel: the frontend codes against this contract
  and mocks HTTP in tests.

## Decisions

1. **How the role is known.** From the member chosen on this device (`session.member.role`, persisted in
   sessionStorage): the same source the sidebar (`nav-items.ts`) and the Reports guard already use. No extra
   request. The socio-only entries are hidden for a colaborador AND their routes declare `meta.requiresSocio`,
   which the router guard enforces (a colaborador who types the URL is sent to the app home). The backend still
   answers 403.
2. **Settings as a screen, not a popover.** The gear is a real link to `/app/ajustes`, a screen listing the entries
   as big links. A popover does not fit the 64 px collapsed sidebar that is the normal state on a phone, and links
   are keyboard and screen-reader friendly by construction.
3. **Gear placement.** Sidebar footer between the name and the logout button. When the sidebar is collapsed the footer
   stacks (avatar, gear, logout), each at least 44x44 px.
4. **Active state of the gear** is decided by the route path (`/app/ajustes*`), not by the link's own active state:
   the sub-screens are siblings of `/app/ajustes` in the router, not children.
5. **Entries are declarative** (`src/layouts/settings-items.ts`, like `nav-items.ts`); each task adds its row.
6. **Passwords** live only in the form's local state; never in storage, never in the console; the form is remounted
   after a success so the three fields are empty. The 403 shows "La contraseña actual no es correcta." on the
   current-password field and keeps what was typed.

## Tasks

- [x] **T1 Gear menu + change password.** Gear in `AppLayout`, `/app/ajustes`, `/app/ajustes/contrasena`,
  `SettingsView`, `ChangePasswordView`, `ChangePasswordForm`, `AuthService.changePassword`, `changePasswordError`.
- [x] **T2 Mi equipo.** List members, "Agregar persona", credentials-email confirmation.
  * `GET /members?includeInactive=true` (socios only see the inactive ones; the server ignores it otherwise).
  * Add form in a modal (real Teleport in tests: VTU's stub remounts the form on every re-render). Percent text is
    converted to integer basis points with digit math (`src/utils/commission.ts`); a socio never sends
    `commissionRateBps` (the server rejects it even as null) and a colaborador without a chosen rate omits it too
    (general rate).
  * The confirmation names WHERE the credentials went: `credentialsEmail: 'approver-fallback'` (email provider in
    test mode) is shown as a warning, honestly, instead of "we emailed them". Never a password.
  * 400 is mapped to fields by the START of each server message (`nombre must…`), not by substring: the correo
    message contains "nombre@dominio.com".
  * 502 says nothing was created and the list is not reloaded; 409/403/network have their own messages.
- [x] **T3 Dispositivos.** List with status, register, identifier shown once with copy, revoke and reissue with confirmation.
  * `DevicesAdminService` (list, create, revoke, reissue; the reissue body is always an object, the server expects one).
  * The identifier is shown ONCE in a notice (selectable `<code>` + "Copiar código", with a manual fallback when the
    clipboard is refused) and, while the device is still pending, each row offers "Copiar código" without ever painting
    the code. It is never written to localStorage/sessionStorage.
  * With `correoEnvio` the server does not return the code; the notice says where the email went and `approver-fallback`
    (email provider in test mode) is a warning saying it did NOT reach the person.
  * Revoke and reissue ask for confirmation and say the effect in plain words; when the target is `session.deviceId`
    they warn it will disconnect (revoke/reissue of the device in use). A 404 closes the dialog and refreshes the list;
    a 502 says nothing changed (on reissue the current access keeps working).
  * A `legacy` device (active, no token) says so and points to "Reemitir": that is how it moves to the token model.
  * Dates (`createdAt`, `activatedAt`, `revokedAt`) are not shown: names and states are what a socio needs to act.
  * The dialogs use the REAL Teleport in tests, as in `TeamView`.

## Out of scope (known follow-ups)

- No global 403 handler and no recovery path for a revoked/reissued device (see `device-token-activation.md`).
- Nothing was run against a real backend or in a browser: everything is covered with mocked HTTP and jsdom.

## Progress and evidence

- T1: `feat(settings): add the settings gear menu and the change-password view`. RED: 34 failing tests and 4 test
  files that could not load (their modules did not exist). GREEN: full suite 100 files / 1737 tests, lint clean,
  build OK. One `router.test.ts` test (landing, ~1.9 s of lazy import) timed out once while 10 files ran in
  parallel; it passes alone and in the full run (a load flake, not related to this change).
- T2: `feat(team): let socios see the team and add people`. RED: 26 failing tests and 6 test files that could not
  load. GREEN: full suite 105 files / 1908 tests, lint clean, build OK.
- T3: `feat(devices): let socios register, revoke and reissue devices`. RED: 19 failing tests and 7 test files that
  could not load. GREEN: full suite 112 files / 2070 tests, lint clean, build OK (`vue-tsc -b && vite build`).
