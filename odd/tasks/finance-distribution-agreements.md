# Distribution agreements frontend — Phase 5.5

Implement historical, immutable agreements from accepted simulations using the exact bazar-api contract, with on-demand snapshot PDFs. Phase closure requires a real integrated test.

## Scope and constraints

- Frontend only; no payments, withdrawals, paid flags, backend mutations, offline queues, push, merge, deploy, or Phase 6.
- Base: `feat/finance-distribution-simulator` at `b04fba4`; branch: `feat/finance-distribution-agreements`.
- Preserve existing changes in `src/services/__tests__/finance-overview.fixture.ts`, `src/services/__tests__/finance-reserves.fixture.ts`, `src/types/finance-reserve.types.ts`.
- Contract: `../bazar-api/doc/finance-distribution-agreements.md`; title required, period end exclusive, active/voided states, UUIDv7 identity, exact replay before drift, reversal endpoint, replacement supported.
- No list reversal reason exists; obtain it through detail if displayed. Never invent fields.
- Store in memory only. Reuse installed pdfmake with lazy fonts; snapshot-only amounts.
- Delivery: ask-on-risk, resolved by user as stacked-to-main for future PRs. No PR creation authorized. Forecast: 1,800–2,700 authored lines including tests. Running committed lines: 0.
- Engram mirror pending: host-session registration blocks memory mutation. Local document is recovery source until synchronization is available.

## Tasks

- [x] A1 — Preserve simulator fingerprint and robust freshness/connection eligibility. Route: delegated; preparation and behavior changes across non-trivial files. Acceptance: fingerprint validated, pending inputs/failed retry/remount/offline cannot create; successful recalculation restores eligibility. Commit `a9cd961`; meaningful RED observed, 116 focused tests GREEN, build/lint/diff checks passed. Native risk medium, under_budget; boundary remains `b04fba4`. Build reports chunk-size and mixed-import warnings.
- [ ] A2 — Exact agreement adapter and ephemeral state. Route: delegated; multiple non-trivial files. Acceptance: strict contract, origin/session isolation, same-request replay, drift invalidation, mapped 400/401/403/404/409/422/503; no persistence.
- [ ] A3 — Confirmation, success, history/detail and navigation. Route: delegated; multiple non-trivial files. Acceptance: socio-only, filters/cursors, snapshot names/amounts/warnings, no recalculation/editing, responsive cards.
- [ ] A4 — Reversal and replacement references. Route: delegated; multiple non-trivial files. Acceptance: required reason, connection, replay/double attempt, focus, historical snapshot retained, real replacement links.
- [ ] A5 — Lazy A4 snapshot PDF, help and regression verification. Route: delegated; PDF generation and execution checks. Acceptance: sanitized filename, amounts/rule/work/warnings/disclaimer/signatures, voided indicator/reason, long multipage participants; requested help articles.

## Verification

Use existing Vitest/Vue Test Utils. Observe meaningful deterministic RED before GREEN for behavior changes. Structural documentation checks need no RED. Each work unit includes its own tests and conventional commit, no AI attribution.

- Focused `npm run test:run -- <changed test paths>`.
- Full `npm run test:run`, `npm run lint`, `npm run build` at closure.
- Responsive/browser keyboard checks at 320/390/768/1280, socio/non-socio, offline restrictions and download, where tooling permits.
- Render and inspect representative active/voided/long A4 PDFs where tooling permits; report unavailable checks honestly.
- RDD is on (global). Assess each work-unit candidate and follow exact provider transitions and candidate consent. Never manufacture approval.

## Evidence and next step

- Read-only delegated contract audit completed; parent spot-checked API contract document. No tests run yet.
- Next: A2 exact agreement adapter and ephemeral state. A1 committed range: 258 authored lines including initial task document; review deferred under native slice budget. Tasks remain open until observed checks and commit identities are recorded.
- Final report must preserve all requested headings and explicitly leave integrated real testing pending unless performed.
