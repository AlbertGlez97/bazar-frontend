# Cuotas Planeadas: repeatable date-rows editor (replaces multi-date picker)

## Objective
Replace `CuotasPlaneadasEditor.vue`'s single `@vuepic/vue-datepicker` in
`multi-dates` mode with N independent rows, each a single-date picker + amount
input. Backend emit contract (`cuotasPlaneadas: { fechaEsperada, montoEsperadoMinor }[]`)
must stay byte-identical; this is a UI-only rework of collection mechanics.

## Problem / why
The old design (one multi-date calendar, one auto-generated row per selected
date) is rejected. New design: explicit repeatable rows with add/remove
controls, matching the cart's existing "Quitar" button styling.

## Scope
- `src/components/ui/molecules/CuotasPlaneadasEditor.vue` — internal rework.
- `src/components/ui/molecules/__tests__/CuotasPlaneadasEditor.test.ts` — replace/update tests for row-based behavior.
- `src/components/ui/organisms/RegistrarDeudaModal.vue` — verify/adjust only if it reaches into the old multi-date internals.
- `src/components/ui/organisms/__tests__/RegistrarDeudaModal.test.ts` — update anything exercising the old picker through the parent.
- Reuse `splitEvenMinor` from `src/utils/money.ts` (unchanged).
- Match "Quitar" button styling from `src/components/ui/molecules/CartLineItem.vue`.

## Constraints
- No new dependencies; `@vuepic/vue-datepicker` single-date API only.
- Public props/emits shape of `CuotasPlaneadasEditor.vue` preserved as much as possible.
- Zero rows = today's behavior exactly (no calendar, abono inicial only, no `cuotasPlaneadas` field/empty array emitted).
- Branch from `main` (`ffeb078`), no push/merge.

## Ambiguity resolution (pre-decided by task author, literal reading)
"Cada fila (excepto si solo queda una) tiene botón 'Quitar'" is read literally:
the single last remaining row has NO quitar button, so the UI cannot go from 1
row to 0 via the remove button. Zero rows is reachable only as the untouched
starting state (before "+ Agregar" is ever clicked). Implementer must apply
this exact reading and flag it in the report.

## Tasks
- [ ] T1. Explore current implementation: `CuotasPlaneadasEditor.vue`, its test file, `RegistrarDeudaModal.vue` + its test file, `CartLineItem.vue` Quitar button markup/classes, `splitEvenMinor` signature in `src/utils/money.ts`. Confirm current emit type/contract.
- [ ] T2. Write failing tests (RED) for: add row, remove intermediate row re-splits untouched rows correctly, single remaining row has no Quitar button, submit with zero rows emits no `cuotasPlaneadas` (matches current behavior), single-date picker per row (not multi-dates mode).
- [ ] T3. Implement the row-based rework (GREEN): row model (date + amount + edited flag), add/remove row handlers, re-split-on-add/remove reusing existing re-split-on-total-change logic, Quitar button styled like `CartLineItem.vue`, zero-row initial/only-state preserved.
- [ ] T4. Update `RegistrarDeudaModal.vue` / its tests only if they reach into old multi-date internals.
- [ ] T5. Run focused tests for touched files, `npm run lint`, `npm run build`.
- [ ] T6. Commit (Conventional Commits, no AI attribution, split only if a prep refactor is genuinely separable from the new UI).
- [ ] T7. Report: files touched, RED then GREEN evidence, ambiguity resolution note, contract-unchanged confirmation, squashed authored-line count (`git diff --numstat --find-renames ffeb078 HEAD`).

## TDD
Mode: ON (explicit task instruction: write failing tests first, confirm RED, implement, confirm GREEN). Runner: Vitest (project standard, confirm via `package.json`).

## Delivery
Single feature branch `feat/cuotas-repeatable-date-rows` from `main` (`ffeb078`). No push, no PR in this pass. RDD: off (clone-local), confirmed via `gentle-ai review mode status` — no native review ceremony required; ordinary checks (test/lint/build) apply.

## Route
Delegated direct: one writer agent does exploration-as-preparation-for-write + implementation (mapping trigger + writer trigger both fire; combined per "read as prep for write, delegate together with the write").

## Progress
- Branch created from `main` at `ffeb078`. Task file created. Delegated writer completed T1–T7.
- [x] T1. Explored: CuotasPlaneadasEditor.vue, its test, RegistrarDeudaModal.vue + test, CartLineItem.vue (Quitar styling), money.ts (splitEvenMinor). Confirmed CuotaDraft contract.
- [x] T2. RED confirmed: 10/11 failing (old component had no add/remove affordances, rendered multi-dates picker). Only the zero-dates-emits-empty-array test passed pre-rework.
- [x] T3. Implemented: `rows: Row[]` state keyed by `row-${id}`, addRow/removeRow, resuggest() reusing splitEvenMinor on add/remove/totalMinor change, skips `edited` rows, emitRows() filters `date === null`. Quitar button hidden via `v-if="rows.length > 1"`.
- [x] T4. RegistrarDeudaModal.vue needed no changes (only consumes `@update:cuotas`); its test file's D2 section updated for row-based mechanics.
- [x] T5. GREEN: CuotasPlaneadasEditor.test.ts 11/11, RegistrarDeudaModal.test.ts 22/22 (33/33 total). Lint clean. Build succeeded (2 pre-existing unrelated chunk-size warnings only).
- [x] T6. Commit `dcba746` — refactor(cuotas): rework planned-installment editor into repeatable date rows. No AI attribution, verified.
- [x] T7. Reported below / to user. Squashed diff (ffeb078..HEAD): CuotasPlaneadasEditor.vue +131/-51, its test +101/-40, RegistrarDeudaModal.test.ts +41/-7, voice.ts +5/-0. Total 278/-98.

Status: DONE. No push, no merge, no other branch touched. Engram mirror write hit `ambiguous_project` (bazar-api vs bazar-frontend both detected in cwd) — not retried automatically per policy (never guess project on ambiguous_project); this file is the source of truth.
