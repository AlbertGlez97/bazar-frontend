import { describe, it, expect } from 'vitest'

// Guarda del objetivo táctil mínimo (44x44 px, guía de marca, sección "Interacción", y WCAG 2.5.5 nivel AAA).
// jsdom no calcula layout, así que no se puede medir un botón: en su lugar se
// comprueba el CONTRATO DE CSS, es decir, que la regla que dimensiona cada
// control táctil declare al menos 44 px (en px o rem). La medición real en
// navegador queda para la revisión manual (ver odd/tasks/ui-mode-selector.md).
const MIN_TOUCH_PX = 44

const sources = import.meta.glob<string>('../../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
})

function sourceOf(fileName: string): string {
  const entry = Object.entries(sources).find(([path]) => path.endsWith(`/${fileName}`))
  if (!entry) throw new Error(`No se encontró ${fileName}`)
  return entry[1]
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Cuerpo de la primera regla cuyo selector es exactamente `selector`. */
function ruleBody(source: string, selector: string): string {
  const match = new RegExp(`(?:^|\\n)\\s*${escapeRegex(selector)}\\s*\\{([^}]*)\\}`).exec(source)
  if (!match) throw new Error(`No se encontró la regla "${selector}"`)
  return match[1]
}

/** Valor en px de una propiedad (acepta px y rem, con 1rem = 16px). */
function pxOf(body: string, property: string): number | undefined {
  const match = new RegExp(`(?:^|[;\\s])${escapeRegex(property)}\\s*:\\s*([\\d.]+)(px|rem)`).exec(body)
  if (!match) return undefined
  return parseFloat(match[1]) * (match[2] === 'rem' ? 16 : 1)
}

function expectAtLeast44(fileName: string, selector: string, properties: string[]) {
  const body = ruleBody(sourceOf(fileName), selector)
  for (const property of properties) {
    const value = pxOf(body, property)
    expect(value, `${fileName} "${selector}" debe declarar ${property} en px o rem`).toBeDefined()
    expect(value, `${fileName} "${selector}" ${property}`).toBeGreaterThanOrEqual(MIN_TOUCH_PX)
  }
}

describe('objetivos táctiles de 44 px (contrato de CSS)', () => {
  it('el ayudante detecta valores en px y rem', () => {
    expect(pxOf('min-height: 3.5rem;', 'min-height')).toBe(56)
    expect(pxOf('min-width: 44px;', 'min-width')).toBe(44)
    expect(pxOf('height: 2rem;', 'min-height')).toBeUndefined()
  })

  it('paginación táctil (size="lg"): botones de 44x44', () => {
    expectAtLeast44('AppPagination.vue', '.app-pagination--lg .app-pag-btn', ['min-width', 'min-height', 'height'])
  })

  it('buscador del catálogo en Modo Venta', () => {
    expectAtLeast44(
      'ProductCatalogGrid.vue',
      '.product-catalog-grid--venta .product-catalog-grid__search :deep(.app-input)',
      ['min-height'],
    )
  })

  it('selector de modo: cada botón mide al menos 44x44', () => {
    expectAtLeast44('UiModeSwitch.vue', '.ui-mode-switch__btn', ['min-height', 'min-width'])
  })

  it('selector de modo compacto (sidebar colapsado): el botón es de 44 px de ancho', () => {
    expectAtLeast44('UiModeSwitch.vue', '.ui-mode-switch--compact .ui-mode-switch__btn', ['width'])
  })

  it('AppInput size="lg" (el que usa el buscador de venta) supera los 44 px', () => {
    const body = ruleBody(sourceOf('AppInput.vue'), '.app-input--lg')
    expect(pxOf(body, 'min-height')).toBeGreaterThanOrEqual(MIN_TOUCH_PX)
  })

  it('AppButton size="lg" supera los 44 px (botones del aviso de modo)', () => {
    const body = ruleBody(sourceOf('AppButton.vue'), '.app-btn--lg')
    expect(pxOf(body, 'min-height')).toBeGreaterThanOrEqual(MIN_TOUCH_PX)
  })

  it('lector de QR: "Listo" e "Intentar de nuevo" miden 56 px de alto', () => {
    expectAtLeast44('QrScannerModal.vue', '.qr-scanner__action', ['min-height'])
  })

  it('QuantityStepper: "−" y "+" miden 44x44 (56x56 en el carrito)', () => {
    expectAtLeast44('QuantityStepper.vue', '.quantity-stepper__btn', ['min-width', 'min-height'])
    expectAtLeast44('QuantityStepper.vue', '.quantity-stepper--lg .quantity-stepper__btn', ['min-width', 'min-height'])
  })

  it('carrito: el botón "Quitar" de cada línea mide 44x44', () => {
    expectAtLeast44('CartLineItem.vue', '.cart-line__remove', ['min-width', 'min-height'])
  })

  it('efectivo: el campo mide 56 px y los atajos 44x44', () => {
    expectAtLeast44('CashInput.vue', '.cash-input__control', ['min-height'])
    expectAtLeast44('CashInput.vue', '.cash-input__chip', ['min-width', 'min-height'])
  })

  it('filtro de categorías: cada botón mide 44x44', () => {
    expectAtLeast44('CategoryQuickFilter.vue', '.category-filter__btn', ['min-width', 'min-height'])
  })

  it('carrito: "Cobrar" mide 56 px y "Vaciar" 44x44', () => {
    expectAtLeast44('SaleCart.vue', '.sale-cart .sale-cart__charge', ['min-height'])
    expectAtLeast44('SaleCart.vue', '.sale-cart__clear', ['min-width', 'min-height'])
  })

  it('catálogo de venta: buscador de 56 px y botón "Escanear" de 56 px', () => {
    expectAtLeast44('SaleCatalogPicker.vue', '.sale-picker__search :deep(.app-input)', ['min-height'])
    expectAtLeast44('SaleCatalogPicker.vue', '.sale-picker .sale-picker__scan', ['min-height'])
  })

  it('indicador de sincronización: "Ver", "Entendido" y "Cerrar" miden al menos 44 px', () => {
    expectAtLeast44('SyncStatusIndicator.vue', '.sync-status__see', ['min-width', 'min-height'])
    expectAtLeast44('SyncStatusIndicator.vue', '.sync-status__dismiss', ['min-width', 'min-height'])
    expectAtLeast44('SyncStatusIndicator.vue', '.sync-status .sync-status__close', ['min-height'])
  })

  it('pantallas de resultado: el botón principal y el secundario miden 56 px y el detalle 44', () => {
    expectAtLeast44('SaleResult.vue', '.sale-result .sale-result__primary', ['min-height'])
    expectAtLeast44('SaleResult.vue', '.sale-result .sale-result__secondary', ['min-height'])
    expectAtLeast44('SaleResult.vue', '.sale-result__detail summary', ['min-height'])
  })

  it('pantalla de venta (celular): el botón de la barra mide 56 px y "Seguir agregando" 44', () => {
    expectAtLeast44('SaleView.vue', '.sale-view .sale-view__bar-button', ['min-height'])
    expectAtLeast44('SaleView.vue', '.sale-view__close', ['min-height'])
  })
})
