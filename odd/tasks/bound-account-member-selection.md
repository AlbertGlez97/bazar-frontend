# Bound accounts skip the member selector (security fix)

Branch: `fix/bound-account-skips-member-selector` (from `main` @ `7af00bb`). Not pushed.

## Finding

An account created through `POST /members` is bound server-side (`Account.memberId`)
and the API refuses any other `x-member-id` (403). The frontend did not know the
binding, because login returns only the token, so it showed the member selector
with EVERY member. A colaborador could pick a socio and the UI, which reads the
role from the client-side `session.member.role`, then showed every socio screen
(Mi equipo, Dispositivos, Reportes). The data calls still failed with 403, but the
UI privilege escalation was real.

The API side was verified separately against the running backend (a bound
colaborador gets 403 on every socio route and cannot list inactive rows).

## Decisions

1. **Source of truth: `GET /auth/me`** (`{ username, memberId, member }`, Bearer only).
   `member: null` is the shared business login (the tablet/seed login), the ONLY
   case where a person chooses who is attending.
2. **Fetched before any role or context decision.** `auth.store.ensureBinding()` runs
   once per login and once per page load. The router guard awaits it on every
   `requiresAuth` navigation, so a reload, a deep link or a forged
   `member_context` in sessionStorage can never be trusted first.
3. **A bound member is forced into the session** (`session.setMember`), overwriting
   whatever was stored. The selector is skipped: with the device already
   identified the guard sends the person straight in; without it the view asks
   only for the device and then goes to the app.
4. **Fail closed for a bound-but-unusable account.** `member.active === false`, a
   `memberId` with no readable member, or a `member.id` that differs from
   `memberId` all become `inactive`: the session member is cleared, the route
   guard sends every operative route to select-context, and that view explains
   it and offers to sign out. Never treated as the shared login.
5. **Defense in depth.** `MemberSelector` takes `lockedMemberId` (offers only that
   person; an id not in the list offers nobody), and the view ignores a selection
   for a bound or inactive account. The view passes `null` today because the
   selector is never rendered for a bound account.
6. **Offline.** The app sells offline, so `/auth/me` can be unreachable.
   - The last good answer is cached in `localStorage['account_binding']` as
     `{ username, member }` (never the token). It is used only when the request
     fails with no response or a 5xx, and only if the username matches the
     session's. An online answer always wins and rewrites it.
   - It is cleared on logout, on any 401 (the Axios interceptor and `/auth/me`
     itself) and when malformed.
   - A 4xx other than 401 (for example a backend without `/auth/me`) is not
     "offline": the cache is not used.
   - **No cache and unreachable: previous behavior** (status `unknown`, the selector
     is shown, and whatever `member_context` holds is used). The server still
     enforces the binding, so this can only ever show UI the API refuses. Chosen
     over blocking the app because a first offline session should still be able
     to sell; covered by a test.
7. A 401 from `/auth/me` logs out completely, and the guard then sends the person
   to login.

## Files

`src/stores/auth.store.ts` (binding state, cache, `ensureBinding`), `src/router/index.ts`
(async guard), `src/services/auth.service.ts` + `src/types/auth.types.ts` (`me()`,
`AccountBinding`), `src/views/SelectContextView.vue`, `src/components/ui/molecules/MemberSelector.vue`,
`src/services/api.ts` (401 also clears the cache), `src/utils/member.ts` (shared `isMember`),
`src/config/voice.ts` (deactivated-account copy).

## Evidence

- RED (new tests before the change): 48 failed, 34 passed (the controls) across 6 files.
- One real bug caught by the tests during GREEN: a deactivated account still requested
  the member list; fixed (`showSelector` excludes `inactive`).
- GREEN: full suite 115 files / 2124 tests, `npm run lint` clean, `npm run build` ok.
- New tests: `auth.store.binding.test.ts`, `router.binding.test.ts`,
  `SelectContextView.binding.test.ts`, plus cases in `MemberSelector.test.ts`,
  `auth.service.test.ts`, `api.test.ts`.
- Existing tests changed: `router.test.ts` only gained a mock of `auth.service`
  whose `/auth/me` answers "shared login", because the guard now asks the server
  on signed-in navigation; no existing assertion was touched.

## Not verified

No run against the real backend or in a browser; `GET /auth/me` is being added to
bazar-api in parallel and is mocked here from its agreed contract. The manual
scenario (create a colaborador, sign in with it, confirm no selector) needs both
sides deployed.
