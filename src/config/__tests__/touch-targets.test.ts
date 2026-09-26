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

  // Paso 2 del cobro (celular): total y efectivo son lo más grande y "Cobrar" el botón mayor.
  it('Paso 2 del cobro: "Cobrar" mide 72 px, el campo de efectivo 80 px y sus billetes 56 px', () => {
    const MIN_PROMINENT_PX = 72
    const charge = ruleBody(sourceOf('SaleCart.vue'), '.sale-cart--checkout .sale-cart__charge')
    expect(pxOf(charge, 'min-height')).toBeGreaterThanOrEqual(MIN_PROMINENT_PX)
    expectAtLeast44('SaleCart.vue', '.sale-cart--checkout :deep(.cash-input__control)', ['min-height'])
    expectAtLeast44('SaleCart.vue', '.sale-cart--checkout :deep(.cash-input__chip)', ['min-height'])
    expect(pxOf(ruleBody(sourceOf('SaleCart.vue'), '.sale-cart--checkout :deep(.cash-input__control)'), 'min-height')).toBeGreaterThanOrEqual(80)
  })

  it('Paso 2 del cobro: el total y el cambio son más grandes que en el carrito normal', () => {
    const source = sourceOf('SaleCart.vue')
    const total = pxOf(ruleBody(source, '.sale-cart--checkout :deep(.cart-summary__total)'), 'font-size')!
    const change = pxOf(ruleBody(source, '.sale-cart--checkout :deep(.cart-summary__change)'), 'font-size')!
    // El total normal del resumen es de 2.5rem (40 px) y el cambio de 2rem (32 px).
    const normalTotal = pxOf(ruleBody(sourceOf('CartSummary.vue'), '.cart-summary__total'), 'font-size')!
    const normalChange = pxOf(ruleBody(sourceOf('CartSummary.vue'), '.cart-summary__change'), 'font-size')!
    expect(total).toBeGreaterThan(normalTotal)
    expect(change).toBeGreaterThan(normalChange)
  })

  it('reportes: los atajos de periodo, "Actualizar" y las descargas miden 44x44', () => {
    expectAtLeast44('ReportRangePicker.vue', '.report-range-picker__preset', ['min-width', 'min-height'])
    expectAtLeast44('ReportRangePicker.vue', '.report-range-picker__apply', ['min-width', 'min-height'])
    expectAtLeast44('ReportsView.vue', '.reports-view__downloads :deep(.app-btn)', ['min-width', 'min-height'])
  })

  it('reportes: los campos de fecha usan AppInput size="lg" (48 px)', () => {
    expect(sourceOf('ReportRangePicker.vue')).toMatch(/type="date"\s+size="lg"/)
  })

  it('ajustes: el engrane del pie y cada entrada del menú miden 44x44', () => {
    expectAtLeast44('AppLayout.vue', '.sidebar__settings', ['min-width', 'min-height'])
    expectAtLeast44('SettingsView.vue', '.settings-view__link', ['min-height'])
  })

  it('cambiar contraseña: el interruptor de mostrar/ocultar mide 44 px y los campos son size="lg" (48 px)', () => {
    expectAtLeast44('ChangePasswordForm.vue', '.change-password-form__toggle', ['min-width', 'min-height'])
    expect(sourceOf('ChangePasswordForm.vue').match(/size="lg"/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
  })

  it('cambiar contraseña: "Volver a ajustes" mide 44 px', () => {
    expectAtLeast44('ChangePasswordView.vue', '.change-password-view__back', ['min-height'])
  })

  it('dispositivos: "Volver", las acciones de cada fila y el botón de copiar el código miden 44 px', () => {
    expectAtLeast44('DevicesView.vue', '.devices-view__back', ['min-height'])
    expectAtLeast44('DeviceList.vue', '.device-list__action', ['min-width', 'min-height'])
    expectAtLeast44('DeviceCodeNotice.vue', '.device-code-notice__copy', ['min-width', 'min-height'])
  })

  it('dispositivos: los campos y botones de los formularios usan size="lg" (48 px)', () => {
    expect(sourceOf('DeviceCreateForm.vue').match(/size="lg"/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
    expect(sourceOf('DeviceActionConfirm.vue').match(/size="lg"/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
  })

  it('mi equipo: "Volver", los botones y los campos del alta miden al menos 44 px (size="lg")', () => {
    expectAtLeast44('TeamView.vue', '.team-view__back', ['min-height'])
    const form = sourceOf('MemberCreateForm.vue')
    // 3 campos de texto + rol + comisión (AppInput/AppSelect lg) y 2 botones lg
    expect(form.match(/size="lg"/g)?.length ?? 0).toBeGreaterThanOrEqual(7)
  })
})
