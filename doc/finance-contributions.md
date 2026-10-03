# Capital contributions offline contract

Contributions record capital delivered to the business. They are not sales, income, profit, ownership, compensation or automatic capital repayment. Sales/report totals are unchanged.

## Durable operations

IndexedDB `la-marchanta` version 2 adds `pending-contributions`, `contribution-history`, and `finance-references`; upgrades retain all version 1 sales/debt operations and catalog snapshots. Persist first, then acknowledge the local record, regardless of network state. A failed IndexedDB write is a failed registration.

Financial identity uses account + API scope, frozen originating member/device, economic date and UUID v7. Tokens are only read by the existing Axios interceptor while sending and are never part of stored records. Cross-account/API/device operations are not reassigned. Original selected member headers survive shared-account member changes; the backend remains the permission authority.

Exact acknowledgements must match complete operation identities and money/date fields. Malformed successful responses are uncertain and preserve the pending payload. History insertion and pending deletion share one IndexedDB transaction. Replaying a creation receipt must not remove known reversal metadata. Lists merge incrementally; local history is a last-known snapshot, not a complete online financial ledger.

## Corrections

Original values remain immutable. A pending original can have a dependent reversal queued; creation must reconcile before its reversal is sent. Reversal plus optional replacement is one server operation, never an independent replacement POST. Annulment corrects a record and does not return capital.

Web Locks exclude other tabs when available. Same-tab exclusion and server idempotency provide a safe fallback, not a promise of browser-wide exclusivity without Web Locks. Transient/network/uncertain acknowledgement failures use bounded exponential backoff; business errors require review; 401/403 pause for explicit session/device recovery and retry. No operation is silently discarded.

Financial GETs are excluded from generic Workbox caching. Offline finance data comes only from scoped durable snapshots with freshness disclosed. The authenticated shell starts/stops the financial scheduler independently of the sales queue.

## Management UI

Gestion > Finanzas > Aportaciones is restricted to socios. It supports member and inclusive date-only filters, simple capital registration, auditable annulment, and linked correction without mutating original amounts. Date-only values map to the existing fixed UTC-6 business day; API end filters are exclusive next-day midnight.

Active socio references are fetched using /members?includeInactive=true and cached by account/API origin. That exact member request and financial requests are excluded from generic Workbox caching, so a successful financial refresh never treats a shared stale HTTP cache as canonical. Inactive historical names remain available; no offline reference cache means registration must wait for a genuine member snapshot.

Pending, synced, paused/review, annulled and corrected states are visible. Known local rows merge with fetched pages, not a claim of complete history. A durable committed write remains successful if subsequent list readback fails, with a visible warning; a failed initial write never reports success. No totals are added to income or profit. Responsive grids cover mobile/tablet/desktop; automated component tests are not a substitute for visual browser verification.
