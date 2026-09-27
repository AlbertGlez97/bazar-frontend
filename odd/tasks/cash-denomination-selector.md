# Combinable cash denomination selector + Paso 2 mobile layout + Deuda/fiado pending note

Branch: `feat/cash-denomination-selector` (from `feat/css-units-rem-migration`, stacked so it's built on the
new rem tokens from the start). Not pushed.

TDD: ON (source: explicit user choice, confirmed against this exact request — same precedent as
`sales-screen`, which built this exact area of the code: money-accumulation logic with edge cases). RED must
be observed and recorded before each new behavior. Runner: `npm run test:run` (Vitest, jsdom).

## Objective

On a real phone, Paso 2 (checkout) feels cramped, and the quick cash-shortcut buttons (Justo/$20/.../$500)
only support a single selection — a customer paying with two $200 bills (=$400) has no way to express that
except typing the number by hand. Add a combinable denomination selector (tap a bill/coin multiple times,
it accumulates) with distinguishable visual denominations, synced with the existing free-text field; reflow
Paso 2 for narrow screens; and record, explicitly, that the sale flow still has no "fiado"/"Deuda" path even
though the backend has supported it since BE-09.

## Prior mapping (evidence, from a full read of the current checkout flow before any design decision)

- Paso 2 is `SaleView.vue`'s `prominent` mode on `SaleCart.vue` (query param `?paso=cobro`, CSS reorder via
  `display: contents` + `order`, not a separate route/component).
- **The "Cobrar" button is already `position: sticky; bottom: ...` inside checkout mode**
  (`SaleCart.vue`, `.sale-cart--checkout .sale-cart__charge`) — nothing to build there, just verify it still
  reads well once the pad takes the space of the old chips.
- **A collapsible pattern already exists in this repo**: `SaleResult.vue` uses native `<details>`/`<summary>`
  for "Detalle para el socio" (lines 62-68, class `.sale-result__detail`). An earlier broad-repo scan claimed
  no such pattern existed — that was **wrong**, verified by reading the file directly. Reuse `<details>`, do
  not invent a custom accordion component.
- `CashInput.vue` is a self-contained molecule: props `modelValue`/`totalMinor`/`disabled`, single event
  `update:modelValue: [text: string]`. It owns the free-text field, "Justo", and (today) 5 single-select
  chips that replace the text outright. `checkout.store.ts` never talks to it directly — the chain is
  `CashInput` → `SaleCart` reemits `update:cashText` → `SaleView.onCashText()` → `cart.setCashFromDisplay()`.
  **This means the whole feature can live inside `CashInput.vue` without changing its public API** — `SaleCart`,
  `SaleView`, `checkout.store`, `cart.store` need zero changes for Part 1.
- Money math: use `sumMinor`/`multiplyMinor`/`minorToDisplay` from `src/utils/money.ts` (already used
  elsewhere in the app for exactly this kind of accumulation) — never hand-roll arithmetic on centavos.
- `lucide-vue-next` is deprecated; the current maintained package is **`@lucide/vue`** — already installed
  (`^1.48.0`) on this branch.
- Backend Deuda/fiado: **confirmed real**, not a guess. 4 endpoints live since BE-09
  (`bazar-api/src/deudas/*`), Prisma models `Deuda`/`Abono`/`Deudor`, documented for frontend consumption in
  `bazar-frontend/doc/api-contract-for-frontend.md:1816-2054` (section 10). Zero references to
  `deuda`/`fiado`/`abono` anywhere in `bazar-frontend/src`. `bazar-frontend/doc/reglas-de-negocio.md` does not
  exist yet (only `bazar-api` has one) — create it, don't bury this in a code comment only.

## Decisions

### Denominations included
Bills only: **$20, $50, $100, $200, $500, $1000** (MXN's $1000 polymer note is real and valid — the reported
pain point, "two $200 bills", is a bills problem). Coins ($1/$2/$5/$10) are explicitly left out: the user
offered them as optional, and adding low-value coin taps to an already-cramped Paso 2 works against the
layout goal of Part 2. If a real need for coins shows up later, `CashDenominationPad` is built to take an
arbitrary denomination list, so it's a config change, not a rewrite.

### Colors (reuse, don't invent)
Six distinct card colors are needed. Rather than inventing new hex values that would need fresh WCAG
contrast verification, **reuse the 6 existing `--color-avatar-*` tokens**, already paired with white text at
verified AA contrast in `brand-tokens.test.ts`'s `pairs` table. Add plain aliases in `main.css` (same pattern
already used for `--space-*` → `--spacing-*`), so the component reads `var(--color-denom-*)` instead of
`var(--color-avatar-*)` (avoids a component about money looking like it's borrowing a people-avatar token,
while adding zero new contrast risk — no new entries needed in `brand-tokens.test.ts`, the alias resolves to
an already-tested hex):

```
--color-denom-20:   var(--color-avatar-3); /* talavera, blue-ish  — closest to the real note's blue */
--color-denom-50:   var(--color-avatar-4); /* rosa, pink          — closest to the real note's pink */
--color-denom-100:  var(--color-avatar-1); /* terracota, red/orange */
--color-denom-200:  var(--color-avatar-2); /* nopal, green        — matches the real note well */
--color-denom-500:  var(--color-avatar-6); /* maiz-800, brown/gold */
--color-denom-1000: var(--color-avatar-5); /* cafe-700, dark brown */
```
Text on every card: `--color-on-primary` (white), same contrast guarantee as the avatars. This is styling
inspired by the real notes' color families, never a reproduction of the note design itself (no serial
numbers, no portraits, no exact layout) — matches what was asked.

### Component boundary (keeps the change small)
- **New molecule `src/components/ui/molecules/CashDenominationPad.vue`**: dumb/controlled. Props:
  `counts: Partial<Record<number, number>>`, `disabled?: boolean`. Emits `tap: [denomination: number]`.
  Renders one rounded-rectangle button per denomination (`BILLS = [20, 50, 100, 200, 500, 1000]`, exported),
  `var(--color-denom-*)` background, the number large and centered, a small "×N" badge only when
  `counts[denomination] > 0`. Each button ≥ `2.75rem` (44px) both dimensions, `type="button"`, dynamic
  `aria-label` including the current count (e.g. `` `Billete de $200, agregado ${n} veces` `` /
  `` `Billete de $200` `` when zero) so the tally is announced to assistive tech, not just shown visually.
  No generic bill icon on the cards (color + number is the identifier, per the request).
- **`CashInput.vue` absorbs the pad and owns all sync state** — its public API (`modelValue`/`totalMinor`/
  `disabled` props, single `update:modelValue` event) does not change, so `SaleCart.vue` needs no edits.
  Replaces the old single-select `BILLS` chips entirely with `<CashDenominationPad>`. Adds a "Limpiar
  selección" button (visible/enabled only when at least one denomination count is > 0), icon `RotateCcw`
  from `@lucide/vue`. Keeps "Justo" exactly as it is today (still a separate quick action, still replaces
  the text outright).

### The sync mechanism (this is the part the user explicitly asked to be documented)
One rule resolves every case, instead of special-casing "typing" vs. "Justo" vs. "external reset"
separately: `CashInput` keeps a local `lastEmittedByPad` ref (the exact text it itself emitted as a *direct
result* of a denomination tap). A single `watch(() => props.modelValue, ...)` clears `denominationCounts` to
`{}` whenever the incoming prop value does **not** equal `lastEmittedByPad`. Only the pad's own tap handler
sets `lastEmittedByPad` (right before emitting); every other source of a new `modelValue` — typing in the
field, tapping "Justo", or `SaleView`'s existing resync watcher after a new sale — never touches
`lastEmittedByPad`, so the very next round-trip of the prop naturally fails the equality check and clears
the pad. No separate `onInput`-specific reset code is needed; one comparison covers typing, Justo, and
external resets uniformly, and taps survive their own round trip because they set the ref right before
emitting.

- **Tap**: `denominationCounts[d] += 1` (money math via `multiplyMinor`/`sumMinor`, never `+`/`*` on raw
  numbers) → format the new total with `minorToDisplay` → set `lastEmittedByPad` → emit.
- **"Limpiar selección"**: `denominationCounts = {}`, `lastEmittedByPad = ''`, emit `''` (clears the amount
  too — leaving stale text next to a reset pad would just recreate the two-sources-of-truth problem this
  feature exists to fix).
- **Typing / "Justo" / external resync**: no special code — the generic watcher clears the pad because the
  incoming value never matches `lastEmittedByPad`.

### Paso 2 layout (Part 2)
- Total: already renders above the payment block in `SaleCart.vue`'s prominent mode — verify it stays that
  way once the pad replaces the old chips (larger content), adjust order/spacing only if the reflow pushes
  it out of place.
- Denomination pad: main body, `flex-wrap` grid, gap ≥ existing `--spacing-sm` between cards so 44px targets
  don't touch (touch-target law already enforced by `touch-targets.test.ts`, extend it to
  `CashDenominationPad`'s button).
- Change: no code change expected — `CartSummary` already renders it live off `cart.changeMinor`, in green,
  and that reacts to `cashReceivedMinor` exactly as before, whether it changed via typing or via the pad.
- Cobrar: already `sticky`, confirmed above — just re-check after the reflow that it's not pushed off-screen
  by the taller pad on a 375px-tall viewport (this is the manual check disclosed as not performable in this
  environment, see Verification).
- Cart line items: wrap in `<details :open="!prominent">` (same tag already used by `SaleResult.vue`) —
  expanded by default outside checkout (Paso 1 / wide screen, unchanged from today), collapsed by default
  when `prominent` is true (Paso 2), always toggleable by the person. `prominent` only changes on a step
  transition (not while sitting inside one step), so forcing the `open` state on that transition is the
  desired behavior (fresh collapse each time checkout opens), not a fight with the user's own toggle.

### Deuda/fiado (Part 3)
Create `bazar-frontend/doc/reglas-de-negocio.md` (does not exist yet) with one section, mirroring the style
of `bazar-api/doc/reglas-de-negocio.md`: explicitly states the sale flow (`SaleView`/`cart.store`/
`checkout.store`) has **no** fiado/apartado (Deuda) path today, that the backend has supported it since
BE-09 with 4 stable endpoints already documented in `doc/api-contract-for-frontend.md` section 10, and that
this is a known, tracked gap — not an oversight to rediscover later. Cross-reference it from
`doc/api-contract-for-frontend.md`'s Deudas section.

## Checklist

- [ ] **C1** `main.css`: add the 6 `--color-denom-*` aliases (no new contrast pairs needed — same hex as
      already-tested avatar tokens). Route: direct inline (mechanical, 1 file).
- [ ] **C2** `CashDenominationPad.vue` (new molecule) + tests: renders 6 denomination cards, accumulates
      taps, shows the count badge, accessible label includes the tally, touch target ≥ 44px, no icon on the
      cards. TDD: RED first (render + tap behavior tests fail against no component), then GREEN.
- [ ] **C3** `CashInput.vue` rewrite + tests: absorb the pad, implement the `lastEmittedByPad` sync rule,
      "Limpiar selección" (with `RotateCcw` from `@lucide/vue`), keep "Justo" behavior. TDD: RED first
      (accumulate multiple taps of the same denomination, combine different denominations, typing resets the
      pad, Justo resets the pad, Limpiar resets both count and text, change recalculates on every
      interaction), then GREEN. Public API (`modelValue`/`totalMinor`/`disabled`/`update:modelValue`)
      unchanged — confirm `SaleCart.vue`'s existing tests still pass without editing `SaleCart.vue`.
- [ ] **C4** `SaleCart.vue`: wrap the line-items list in `<details :open="!prominent">`; re-check spacing/
      order of total, pad, change, and the already-sticky Cobrar button in `prominent` mode now that the pad
      is taller than the old chips. TDD: RED first for the new collapsible behavior.
- [ ] **C5** `doc/reglas-de-negocio.md` (new file, frontend) + cross-reference from
      `doc/api-contract-for-frontend.md`. Route: direct inline.
- [ ] **C6** Verify: build, lint, `test:run` full suite (RED/GREEN evidence recorded per behavior above);
      disclose (don't fake) the manual checks this environment cannot perform: real/emulated 375-414px
      viewport screenshot, and confirming nothing overlaps/clips.

## Acceptance criteria

Tapping the same denomination N times accumulates N× its value; combining different denominations sums
correctly; typing directly in the field resets the visual denomination selection; "Limpiar selección"
zeroes counts and the amount; the change amount recalculates on every interaction; "Justo" keeps working as
today; `SaleCart`/`SaleView`/`checkout.store`/`cart.store` are untouched (Part 1 is fully contained in the
two `CashInput`-family components); Paso 2 line items are collapsible via `<details>`, collapsed by default,
never hidden outside checkout; the "Cobrar" button stays visible without scrolling; `doc/reglas-de-negocio.md`
states the Deuda/fiado gap explicitly.
