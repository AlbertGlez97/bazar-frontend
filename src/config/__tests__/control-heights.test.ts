import { describe, expect, it } from 'vitest'
import mainCss from '../../assets/main.css?raw'

// El tamaño de un botón depende de CÓMO se toca, no del ancho de la pantalla:
//   mouse (pointer: fine)  → principal 40 px, compacto 32 px
//   dedo  (pointer: coarse) → 44 a 48 px
// Los tamaños se definen UNA vez, como tokens en main.css; los componentes solo
// los usan. jsdom no calcula layout ni evalúa media queries, así que se lee el
// CSS: se resuelve cada token en los dos modos y se comprueba el resultado.

const sources = import.meta.glob<string>('../../**/*.vue', { query: '?raw', import: 'default', eager: true })

function sourceOf(fileName: string): string {
  const entry = Object.entries(sources).find(([path]) => path.endsWith(`/${fileName}`))
  if (!entry) throw new Error(`No se encontró ${fileName}`)
  return entry[1]
}

const COARSE_BLOCK = /@media \(pointer: coarse\)\s*\{\s*:root\s*\{([^}]*)\}\s*\}/
const coarseCss = COARSE_BLOCK.exec(mainCss)?.[1] ?? ''
const baseCss = mainCss.replace(COARSE_BLOCK, '')

const declared = (css: string) =>
  Object.fromEntries([...css.matchAll(/(--control-height[\w-]*)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]))

type PointerMode = 'fine' | 'coarse'

/** Altura en px de un token tal como la vería cada tipo de puntero. */
function tokenPx(token: string, mode: PointerMode): number {
  const vars: Record<string, string> = { ...declared(baseCss), ...(mode === 'coarse' ? declared(coarseCss) : {}) }
  let value = vars[token]
  for (let hops = 0; value?.startsWith('var(') && hops < 5; hops += 1) {
    value = vars[/var\((--[\w-]+)\)/.exec(value)![1]!]
  }
  const match = /^([\d.]+)rem$/.exec(value ?? '')
  if (!match) throw new Error(`El token ${token} no resuelve a rem en modo ${mode}: "${value}"`)
  return parseFloat(match[1]!) * 16
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function ruleBody(source: string, selector: string): string {
  const match = new RegExp(`(?:^|\\n)\\s*${escapeRegex(selector)}\\s*\\{([^}]*)\\}`).exec(source)
  if (!match) throw new Error(`No se encontró la regla "${selector}"`)
  return match[1]!
}

describe('tokens de altura de controles (main.css)', () => {
  it('mouse: principal 40 px y compacto 32 px', () => {
    expect(tokenPx('--control-height', 'fine')).toBe(40)
    expect(tokenPx('--control-height-compact', 'fine')).toBe(32)
  })

  it('dedo: principal 48 px y compacto 44 px (entre 44 y 48)', () => {
    expect(tokenPx('--control-height', 'coarse')).toBe(48)
    expect(tokenPx('--control-height-compact', 'coarse')).toBe(44)
  })

  it('el valor táctil de referencia existe y es de 44 a 48 px', () => {
    expect(tokenPx('--control-height-touch', 'fine')).toBe(44)
    expect(tokenPx('--control-height-touch-lg', 'fine')).toBe(48)
  })

  it('la acción principal de la pantalla (Cobrar) es más alta: 48 px con mouse, 56 con dedo', () => {
    expect(tokenPx('--control-height-cta', 'fine')).toBe(48)
    expect(tokenPx('--control-height-cta', 'coarse')).toBe(56)
  })

  it('el cambio de modo se decide por el tipo de puntero, no por el ancho', () => {
    expect(coarseCss).toMatch(/--control-height\s*:/)
    expect(mainCss).not.toMatch(/--control-height[\w-]*\s*:[^;]*;[^}]*@media[^{]*max-width/)
    expect(mainCss).toMatch(/@media \(pointer: coarse\)/)
  })

  it('en rem (convención de doc/brand-guidelines.md), nunca en px', () => {
    expect(mainCss.match(/--control-height[\w-]*\s*:\s*[\d.]+px/)).toBeNull()
  })
})

// Cada control declara su alto con un token (un solo lugar define los tamaños) y
// el resultado cae donde debe en AMBOS modos.
const USES: [file: string, selector: string, property: string, token: string][] = [
  ['AppButton.vue', '.app-btn--xs', 'min-height', '--control-height-compact'],
  ['AppButton.vue', '.app-btn--sm', 'min-height', '--control-height-compact'],
  ['AppButton.vue', '.app-btn--md', 'min-height', '--control-height'],
  ['AppButton.vue', '.app-btn--lg', 'min-height', '--control-height'],
  ['AppButton.vue', '.app-btn--xl', 'min-height', '--control-height-cta'],
  ['SegmentedControl.vue', '.segmented-control__btn', 'min-height', '--control-height'],
  ['SegmentedControl.vue', '.segmented-control--lg .segmented-control__btn', 'min-height', '--control-height-cta'],
  ['QuantityStepper.vue', '.quantity-stepper__btn', 'min-height', '--control-height-compact'],
  ['QuantityStepper.vue', '.quantity-stepper__btn', 'min-width', '--control-height-compact'],
  ['CartLineItem.vue', '.cart-line__remove', 'min-height', '--control-height-compact'],
  ['SaleCart.vue', '.sale-cart .sale-cart__charge', 'min-height', '--control-height-cta'],
  ['SaleCart.vue', '.sale-cart__clear', 'min-height', '--control-height-compact'],
  ['SaleCart.vue', '.sale-cart__lines-summary', 'min-height', '--control-height-compact'],
  ['SaleCart.vue', '.sale-cart__debt-option', 'min-height', '--control-height'],
  ['SaleCatalogPicker.vue', '.sale-picker .sale-picker__scan', 'min-height', '--control-height'],
  ['SaleCatalogPicker.vue', '.sale-picker__view-btn', 'min-height', '--control-height-compact'],
  ['AmountInput.vue', '.amount-input__control', 'min-height', '--control-height-cta'],
]

describe('los controles usan los tokens y miden lo correcto en cada modo', () => {
  it.each(USES)('%s %s → %s usa var(%s)', (file, selector, property, token) => {
    const body = ruleBody(sourceOf(file), selector)
    expect(body, `${file} "${selector}" debe declarar ${property} con ${token}`).toMatch(
      new RegExp(`${property}:\\s*var\\(${escapeRegex(token)}\\)`),
    )
    const fine = tokenPx(token, 'fine')
    const coarse = tokenPx(token, 'coarse')
    expect([32, 40, 48]).toContain(fine)
    expect(coarse).toBeGreaterThanOrEqual(44)
    // Con el dedo nada baja de 44 px; los principales y compactos no pasan de 48.
    if (token !== '--control-height-cta') expect(coarse).toBeLessThanOrEqual(48)
  })

  it('AppButton no cambia de tamaño por el ancho de la pantalla (sin @media max-width)', () => {
    expect(sourceOf('AppButton.vue')).not.toMatch(/@media[^{]*max-width/)
  })

  it('ninguno de estos controles fija su alto con un número suelto', () => {
    for (const [file, selector, property] of USES) {
      expect(ruleBody(sourceOf(file), selector), `${file} ${selector}`).not.toMatch(
        new RegExp(`${property}:\\s*[\\d.]+(rem|px)`),
      )
    }
  })
})
