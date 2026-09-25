import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleResult from '../SaleResult.vue'
import type { SaleResultView } from '@/types/sale-result.types'

function mountResult(result: SaleResultView) {
  return mount(SaleResult, { props: { result }, attachTo: document.body })
}

const success: SaleResultView = { kind: 'success', totalMinor: 25000, changeMinor: 5000, summary: 'Venta anotada: $250.00. Cambio: $50.00. Quedó a nombre de Carlos.' }
const saved: SaleResultView = { kind: 'saved-offline', totalMinor: 19990, changeMinor: 10 }
const conflict: SaleResultView = {
  kind: 'conflict',
  message: 'Otra venta se llevó la última pieza de un producto justo antes que esta, así que no se cobró. Un socio la revisará en incidencias.',
  detail: 'stock insuficiente al sincronizar: producto p, solicitado 1, disponible 0',
}
const rejected: SaleResultView = { kind: 'rejected', message: 'Ya no hay suficientes piezas de uno de los productos. Baja la cantidad o quítalo del carrito e intenta de nuevo.' }
const authNeeded: SaleResultView = { kind: 'auth-needed', message: 'Tu sesión ya no es válida, pero la venta sigue guardada en este dispositivo. Inicia sesión de nuevo para enviarla.', totalMinor: 5000, changeMinor: 0 }
const failedToSave: SaleResultView = { kind: 'failed-to-save', message: 'No pudimos guardar esta venta en el dispositivo. Anótala aparte y conserva el carrito hasta tener internet.' }
const blocked: SaleResultView = { kind: 'blocked', message: 'La venta está vacía. Agrega un producto para poder cobrar.' }

const primary = (w: ReturnType<typeof mountResult>) => w.findAll('button.sale-result__primary')
const heading = (w: ReturnType<typeof mountResult>) => w.get('h2').text()

describe('SaleResult — cada pantalla tiene UN botón principal', () => {
  it.each([
    ['success', success, 'Nueva venta'],
    ['saved-offline', saved, 'Nueva venta'],
    ['conflict', conflict, 'Entendido, nueva venta'],
    ['rejected', rejected, 'Regresar a la venta'],
    ['auth-needed', authNeeded, 'Iniciar sesión'],
    ['failed-to-save', failedToSave, 'Intentar de nuevo'],
    ['blocked', blocked, 'Regresar a la venta'],
  ] as const)('%s: un solo botón principal "%s"', (_kind, result, label) => {
    const wrapper = mountResult(result)
    expect(primary(wrapper)).toHaveLength(1)
    expect(primary(wrapper)[0].text()).toBe(label)
    wrapper.unmount()
  })

  it('el botón principal es de 56 px (clase) y de tipo button', () => {
    const wrapper = mountResult(success)
    expect(primary(wrapper)[0].classes()).toContain('sale-result__primary')
    expect(primary(wrapper)[0].attributes('type')).toBe('button')
    wrapper.unmount()
  })

  it('los botones emiten el evento de su pantalla', async () => {
    const cases: [SaleResultView, string][] = [
      [success, 'new-sale'],
      [saved, 'new-sale'],
      [conflict, 'new-sale'],
      [rejected, 'back'],
      [blocked, 'back'],
      [authNeeded, 'login'],
      [failedToSave, 'retry'],
    ]
    for (const [result, event] of cases) {
      const wrapper = mountResult(result)
      await primary(wrapper)[0].trigger('click')
      expect(wrapper.emitted(event), `${result.kind} -> ${event}`).toHaveLength(1)
      wrapper.unmount()
    }
  })
})

describe('SaleResult — venta cobrada', () => {
  it('título de hecho, total y cambio grandes con dinero exacto', () => {
    const wrapper = mountResult(success)
    expect(heading(wrapper)).toBe('Venta registrada')
    expect(wrapper.get('.sale-result__total').text()).toContain('$250.00')
    expect(wrapper.get('.sale-result__change').text()).toContain('$50.00')
    expect(wrapper.get('.sale-result__change').text()).toContain('Cambio a entregar')
    expect(wrapper.text()).toContain('Quedó a nombre de Carlos.')
    wrapper.unmount()
  })

  it('sin cambio lo dice con palabras', () => {
    const wrapper = mountResult({ kind: 'success', totalMinor: 12550, changeMinor: 0 })
    expect(wrapper.get('.sale-result__change').text()).toContain('Sin cambio')
    expect(wrapper.get('.sale-result__change').text()).not.toContain('$0.00')
    wrapper.unmount()
  })

  it('es una región de estado, no una alerta', () => {
    const wrapper = mountResult(success)
    expect(wrapper.get('.sale-result').attributes('role')).toBe('status')
    wrapper.unmount()
  })
})

describe('SaleResult — guardada sin señal', () => {
  it('se siente como éxito: "Listo, ya quedó" con el mensaje de que se manda sola', () => {
    const wrapper = mountResult(saved)
    expect(heading(wrapper)).toBe('Listo, ya quedó')
    expect(wrapper.text()).toContain('Sin señal, pero tu venta está guardada y se manda sola cuando haya internet.')
    expect(wrapper.get('.sale-result__total').text()).toContain('$199.90')
    expect(wrapper.get('.sale-result__change').text()).toContain('$0.10')
    expect(wrapper.text()).not.toMatch(/error|falló|no se pudo/i)
    expect(wrapper.get('.sale-result').classes()).toContain('sale-result--saved-offline')
    wrapper.unmount()
  })
})

describe('SaleResult — conflicto (NUNCA como éxito)', () => {
  it('pantalla propia: otro título, otra clase, otro ícono y sin cifras de cobro', () => {
    const wrapper = mountResult(conflict)
    expect(heading(wrapper)).toBe('Esta venta no se pudo cobrar')
    expect(wrapper.get('.sale-result').classes()).toContain('sale-result--conflict')
    expect(wrapper.get('.sale-result').classes()).not.toContain('sale-result--success')
    expect(wrapper.get('.sale-result__icon').text()).not.toBe('✓')
    expect(wrapper.find('.sale-result__total').exists()).toBe(false)
    expect(wrapper.find('.sale-result__change').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/Venta registrada|Listo, ya quedó/)
    wrapper.unmount()
  })

  it('explica qué pasó, qué hacer con el producto y el dinero, sin culpar', () => {
    const wrapper = mountResult(conflict)
    expect(wrapper.text()).toContain('Otra venta se llevó la última pieza')
    expect(wrapper.text()).toContain('no entregues el producto')
    expect(wrapper.text()).toMatch(/devuelve el dinero/)
    expect(wrapper.text()).toMatch(/socio/)
    expect(wrapper.text()).not.toMatch(/tu culpa|te equivocaste/i)
    wrapper.unmount()
  })

  it('el motivo técnico es solo un detalle secundario, plegado', () => {
    const wrapper = mountResult(conflict)
    const details = wrapper.get('details.sale-result__detail')
    expect(details.attributes('open')).toBeUndefined()
    expect(details.get('summary').text()).toBe('Detalle para el socio')
    expect(details.text()).toContain('stock insuficiente al sincronizar')
    wrapper.unmount()
  })

  it('sin detalle no dibuja el bloque', () => {
    const wrapper = mountResult({ kind: 'conflict', message: conflict.kind === 'conflict' ? conflict.message : '' })
    expect(wrapper.find('details').exists()).toBe(false)
    wrapper.unmount()
  })

  it('es una alerta (se anuncia enseguida)', () => {
    const wrapper = mountResult(conflict)
    expect(wrapper.get('.sale-result').attributes('role')).toBe('alert')
    wrapper.unmount()
  })
})

describe('SaleResult — rechazada, sesión, guardado y bloqueada', () => {
  it('rechazada: motivo amable, el carrito sigue (botón regresar) y no hay cifras de éxito', () => {
    const wrapper = mountResult(rejected)
    expect(heading(wrapper)).toBe('No pudimos registrar la venta')
    expect(wrapper.text()).toContain('Baja la cantidad o quítalo del carrito')
    expect(wrapper.find('.sale-result__total').exists()).toBe(false)
    expect(wrapper.get('.sale-result').attributes('role')).toBe('alert')
    wrapper.unmount()
  })

  it('sesión vencida: promete que la venta está guardada, muestra total y cambio y deja seguir vendiendo', async () => {
    const wrapper = mountResult(authNeeded)
    expect(heading(wrapper)).toBe('Tu venta está guardada')
    expect(wrapper.text()).toContain('sigue guardada en este dispositivo')
    expect(wrapper.get('.sale-result__total').text()).toContain('$50.00')
    const secondary = wrapper.get('button.sale-result__secondary')
    expect(secondary.text()).toBe('Nueva venta')
    await secondary.trigger('click')
    expect(wrapper.emitted('new-sale')).toHaveLength(1)
    wrapper.unmount()
  })

  it('no se pudo guardar: mensaje honesto, reintentar como principal y regresar como secundario', async () => {
    const wrapper = mountResult(failedToSave)
    expect(heading(wrapper)).toBe('No se guardó la venta')
    expect(wrapper.text()).toContain('Anótala aparte')
    const secondary = wrapper.get('button.sale-result__secondary')
    expect(secondary.text()).toBe('Regresar a la venta')
    await secondary.trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
    wrapper.unmount()
  })

  it('bloqueada (defensiva): título y motivo claros', () => {
    const wrapper = mountResult(blocked)
    expect(heading(wrapper)).toBe('Todavía no se puede cobrar')
    expect(wrapper.text()).toContain('Agrega un producto')
    wrapper.unmount()
  })

  it('solo las pantallas de sesión y de no guardado tienen botón secundario', () => {
    for (const result of [success, saved, conflict, rejected, blocked]) {
      const wrapper = mountResult(result)
      expect(wrapper.find('button.sale-result__secondary').exists(), result.kind).toBe(false)
      wrapper.unmount()
    }
  })
})

describe('SaleResult — distintas a simple vista y accesibles', () => {
  it('cada tipo lleva su propia clase e ícono (el color nunca es la única señal)', () => {
    const results = [success, saved, conflict, rejected, authNeeded, failedToSave, blocked]
    const classes = new Set<string>()
    for (const result of results) {
      const wrapper = mountResult(result)
      classes.add(`${wrapper.get('.sale-result').classes().find((c) => c.startsWith('sale-result--'))}`)
      expect(wrapper.get('.sale-result__icon').attributes('aria-hidden')).toBe('true')
      expect(wrapper.get('.sale-result__icon').text().length).toBeGreaterThan(0)
      wrapper.unmount()
    }
    expect(classes.size).toBe(results.length)
  })

  it('al aparecer, el foco va al título (lectores de pantalla y teclado empiezan ahí)', () => {
    const wrapper = mountResult(success)
    expect(document.activeElement).toBe(wrapper.get('h2').element)
    expect(wrapper.get('h2').attributes('tabindex')).toBe('-1')
    wrapper.unmount()
  })
})
