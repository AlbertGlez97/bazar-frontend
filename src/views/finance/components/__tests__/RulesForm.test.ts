import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import RulesForm from '../RulesForm.vue'
import { defaultRulesConfig } from '@/utils/finance-rules'
import type { FinanceRulesConfig } from '@/types/finance-rules.types'

const mountIt = (config: FinanceRulesConfig = defaultRulesConfig(), props: Record<string, unknown> = {}) =>
  mount(RulesForm, { props: { modelValue: config, ...props } })
const last = (w: VueWrapper) => {
  const events = w.emitted('update:modelValue') as FinanceRulesConfig[][]
  return events[events.length - 1]![0]!
}
const type = (w: VueWrapper, selector: string, value: string) => w.get(`${selector} input`).setValue(value)
const segment = (w: VueWrapper, group: string, value: string) =>
  w.get(`[role="group"][aria-label="${group}"] [data-value="${value}"]`).trigger('click')

describe('RulesForm', () => {
  it('tiene los siete engranes, cada uno con su ayuda', () => {
    const w = mountIt()
    const legends = w.findAll('legend').map((l) => l.text())

    expect(legends).toHaveLength(7)
    expect(legends[0]).toBe('1. Cómo se divide la utilidad')
    expect(legends[6]).toBe('7. Préstamos de socios')
    expect(w.findAll('.rule-guide')).toHaveLength(7)
  })

  describe('1. utilidad', () => {
    it('un atajo pone una división que suma 100', async () => {
      const w = mountIt()
      await w.get('[data-test="preset-mixto"]').trigger('click')
      expect(last(w).profitBase).toEqual({ partnerPct: 40, capitalPct: 60, workPct: 0 })
    })

    it('al escribir a mano un campo, los otros se completan', async () => {
      const w = mountIt({ ...defaultRulesConfig(), profitBase: { partnerPct: 50, capitalPct: 30, workPct: 20 } })
      await type(w, '[data-test="base-partner"]', '70')
      expect(last(w).profitBase).toEqual({ partnerPct: 70, capitalPct: 18, workPct: 12 })
    })

    it('un texto que no se entiende no cambia nada', async () => {
      const w = mountIt()
      await type(w, '[data-test="base-capital"]', 'mucho')
      expect(w.emitted('update:modelValue')).toBeUndefined()
    })
  })

  describe('2. reinversión', () => {
    it('cambia la fase y los porcentajes de cada fase', async () => {
      const w = mountIt()
      await segment(w, 'Fase actual del negocio', 'arranque')
      expect(last(w).reinvestment.currentPhase).toBe('arranque')
      const inputs = w.findAll('fieldset')[1]!.findAll('input[inputmode="decimal"]')
      await inputs[0]!.setValue('80')
      await inputs[1]!.setValue('40')
      await inputs[2]!.setValue('5,5')
      const events = w.emitted('update:modelValue') as FinanceRulesConfig[][]
      expect(events.map((e) => e[0]!.reinvestment.arranquePct)).toContain(80)
      expect(events.map((e) => e[0]!.reinvestment.operacionPct)).toContain(40)
      expect(last(w).reinvestment.cierrePct).toBe(5.5)
    })

    it('el atajo sugerido pone 100 / 50 / 0', async () => {
      const w = mountIt()
      await w.get('[data-test="preset-reinvest"]').trigger('click')
      expect(last(w).reinvestment).toMatchObject({ arranquePct: 100, operacionPct: 50, cierrePct: 0 })
    })

    it('el tope se enciende, se escribe y se apaga', async () => {
      const w = mountIt()
      expect(w.find('.amount-input').exists()).toBe(false)

      await w.get('[data-test="until-switch"]').setValue(true)
      expect(last(w).reinvestment.untilAmountMinor).toBe(0)
      await w.get('.amount-input input').setValue('1500')
      expect(last(w).reinvestment.untilAmountMinor).toBe(150000)

      await w.get('[data-test="until-switch"]').setValue(false)
      expect(last(w).reinvestment.untilAmountMinor).toBeNull()
    })

    it('si el monto escrito es ambiguo, el tope se enciende en 0 y no adivina', async () => {
      const w = mountIt()
      await w.get('[data-test="until-switch"]').setValue(true)
      await w.get('.amount-input input').setValue('100,50')
      await w.get('[data-test="until-switch"]').setValue(false)
      await w.get('[data-test="until-switch"]').setValue(true)
      expect(last(w).reinvestment.untilAmountMinor).toBe(0)
    })

    it('un tope ya guardado se muestra encendido', () => {
      const config = defaultRulesConfig()
      config.reinvestment.untilAmountMinor = 250000
      const w = mountIt(config)
      expect((w.get('[data-test="until-switch"]').element as HTMLInputElement).checked).toBe(true)
      expect((w.get('.amount-input input').element as HTMLInputElement).value).toBe('2500.00')
    })
  })

  describe('3. capital', () => {
    it('sin devolución no pregunta cuándo; con devolución sí', async () => {
      const w = mountIt()
      expect(w.find('[aria-label="Cuándo se recupera"]').exists()).toBe(false)

      await w.get('[data-test="recovery-mode"]').setValue('por_diferencia')
      expect(last(w).capitalRecovery.mode).toBe('por_diferencia')
      await w.setProps({ modelValue: last(w) })
      await segment(w, 'Cuándo se recupera', 'al_cierre')
      expect(last(w).capitalRecovery).toEqual({ mode: 'por_diferencia', timing: 'al_cierre' })
    })
  })

  describe('4. trabajo', () => {
    it('solo pide detalles si se pagan las horas', async () => {
      const w = mountIt()
      expect(w.find('[aria-label="Cuándo se paga el trabajo"]').exists()).toBe(false)

      await w.get('[data-test="pay-hours"]').setValue(true)
      expect(last(w).work.payHours).toBe(true)
      await w.setProps({ modelValue: last(w) })
      await segment(w, 'Cuándo se paga el trabajo', 'despues')
      expect(last(w).work.order).toBe('despues')
    })

    it('tarifa por hora en pesos o porcentaje del reparto', async () => {
      const config = defaultRulesConfig()
      config.work.payHours = true
      const w = mountIt(config)

      expect(w.find('[aria-label="Cómo se paga el trabajo"]').exists()).toBe(true)
      await w.get('.amount-input input').setValue('50')
      expect(last(w).work.pay).toEqual({ kind: 'por_hora', rateMinorPerHour: 5000 })

      await segment(w, 'Cómo se paga el trabajo', 'porcentaje')
      expect(last(w).work.pay).toEqual({ kind: 'porcentaje', pct: 0 })
      await w.setProps({ modelValue: last(w) })
      await w.get('fieldset:nth-of-type(4) input[inputmode="decimal"]').setValue('15')
      expect(last(w).work.pay).toEqual({ kind: 'porcentaje', pct: 15 })
    })
  })

  describe('5, 6 y 7', () => {
    it('gastos de socio: tres opciones', async () => {
      const w = mountIt()
      await segment(w, 'Qué pasa con ese gasto', 'contar_como_aportacion')
      expect(last(w).partnerExpenses).toBe('contar_como_aportacion')
      await segment(w, 'Qué pasa con ese gasto', 'reembolsar')
      expect(last(w).partnerExpenses).toBe('reembolsar')
    })

    it('reservas: porcentaje o monto fijo', async () => {
      const w = mountIt()
      await segment(w, 'Cómo se aparta', 'monto')
      expect(last(w).reserves).toEqual({ kind: 'monto', amountMinor: 0 })
      await w.setProps({ modelValue: last(w) })
      await w.get('fieldset:nth-of-type(6) .amount-input input').setValue('1200')
      expect(last(w).reserves).toEqual({ kind: 'monto', amountMinor: 120000 })

      await segment(w, 'Cómo se aparta', 'porcentaje')
      expect(last(w).reserves).toEqual({ kind: 'porcentaje', pct: 0 })
    })

    it('préstamos de socio: antes o después del capital', async () => {
      const w = mountIt()
      await w.get('[data-test="loans-switch"]').setValue(true)
      expect(last(w).partnerLoans.repayBeforeCapital).toBe(true)
    })
  })

  it('nunca modifica el objeto que recibe', async () => {
    const config = defaultRulesConfig()
    const copy = JSON.parse(JSON.stringify(config))
    const w = mountIt(config)
    await w.get('[data-test="preset-capital"]').trigger('click')
    expect(config).toEqual(copy)
  })

  it('deshabilitado, nada se puede tocar', () => {
    const w = mountIt(defaultRulesConfig(), { disabled: true })
    // La ayuda (ⓘ) se puede leer siempre, aunque el formulario esté bloqueado.
    const controls = w.findAll('input, select, fieldset button:not(.rule-guide button)')
    expect(controls.length).toBeGreaterThan(10)
    for (const control of controls) expect(control.attributes('disabled'), control.html()).toBeDefined()
  })

  it('cada campo tiene etiqueta enlazada y un autocompletado válido', () => {
    const config = defaultRulesConfig()
    config.work.payHours = true
    config.reinvestment.untilAmountMinor = 1000
    const w = mountIt(config)
    for (const input of w.findAll('input, select')) {
      const id = input.attributes('id')
      const wrapped = input.element.closest('label') !== null
      const linked = !!id && w.find(`label[for="${id}"]`).exists()
      expect(wrapped || linked, input.html()).toBe(true)
      const autocomplete = input.attributes('autocomplete')
      if (autocomplete !== undefined) expect(['off', 'on']).toContain(autocomplete)
    }
  })
})
