import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CashInput from '../CashInput.vue'
import { parseCashInput, sanitizeCashText } from '@/utils/money'

function mountCash(props: { modelValue?: string; totalMinor?: number; disabled?: boolean } = {}) {
  return mount(CashInput, { props: { modelValue: '', totalMinor: 0, ...props } })
}

async function type(wrapper: ReturnType<typeof mountCash>, text: string) {
  const input = wrapper.get('input')
  await input.setValue(text)
  return input
}

const lastEmitted = (w: ReturnType<typeof mountCash>) => {
  const all = w.emitted('update:modelValue') ?? []
  return all[all.length - 1]?.[0]
}

/** Simula el round-trip real de v-model: el padre reasigna `modelValue` con lo último emitido. */
async function roundTrip(w: ReturnType<typeof mountCash>) {
  await w.setProps({ modelValue: lastEmitted(w) as string })
}

const padButtons = (w: ReturnType<typeof mountCash>) => w.findAll('.cash-denomination-pad__btn')
const padCoinButtons = (w: ReturnType<typeof mountCash>) => w.findAll('.cash-denomination-pad__btn--coin')
const padBadges = (w: ReturnType<typeof mountCash>) => w.findAll('.cash-denomination-pad__badge')

// El limpiador solo quita lo que no puede ser parte de un monto (letras, símbolos)
// y topa dígitos; NO reinterpreta comas ni puntos: lo que se ve en el campo es lo
// que se lee, y si es ambiguo lo rechaza `parseCashInput`.
describe('sanitizeCashText', () => {
  it.each([
    ['100', '100'],
    ['100.5', '100.5'],
    ['1,000', '1,000'],
    ['1,000.50', '1,000.50'],
    ['100,50', '100,50'],
    ['', ''],
    ['abc', ''],
    ['$ 1 500', '1500'],
    ['-20', '20'],
    ['1e5', '15'],
    ['12.345', '12.34'],
    ['12,999', '12,999'],
    ['1.000,50', '1.000,50'],
    ['1,000,000', '1,000,000'],
    ['1.2.3', '1.2.3'],
    ['.5', '.5'],
    [',5', ',5'],
    ['100.', '100.'],
    ['1234567890.55', '12345678.55'],
    ['123456789012', '12345678'],
    ['12,345,678.90', '12,345,678.90'],
  ])('%j -> %j', (typed, expected) => {
    expect(sanitizeCashText(typed)).toBe(expected)
  })

  it('lo que devuelve lo entiende parseCashInput con dinero exacto (coma = miles, punto = decimal)', () => {
    expect(parseCashInput(sanitizeCashText('100'))).toBe(10000)
    expect(parseCashInput(sanitizeCashText('100.5'))).toBe(10050)
    expect(parseCashInput(sanitizeCashText('1,000'))).toBe(100000)
    expect(parseCashInput(sanitizeCashText('$1,000.50'))).toBe(100050)
    expect(parseCashInput(sanitizeCashText('19.99'))).toBe(1999)
  })

  it('lo ambiguo NO se adivina: pasa tal cual y parseCashInput lo rechaza', () => {
    expect(parseCashInput(sanitizeCashText('100,50'))).toBeNull()
    expect(parseCashInput(sanitizeCashText('1.000,50'))).toBeNull()
  })
})

describe('CashInput — campo', () => {
  it('es un campo con etiqueta visible, prefijo de pesos y teclado decimal', () => {
    const wrapper = mountCash()
    const input = wrapper.get('input')
    expect(wrapper.get('label').text()).toBe('Efectivo recibido')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('inputmode')).toBe('decimal')
    expect(input.attributes('autocomplete')).toBe('off')
    expect(wrapper.get('.cash-input__prefix').text()).toBe('$')
    expect(wrapper.get('.cash-input__prefix').attributes('aria-hidden')).toBe('true')
  })

  it('refleja el modelValue', () => {
    expect((mountCash({ modelValue: '150' }).get('input').element as HTMLInputElement).value).toBe('150')
  })

  it.each([
    ['100', '100'],
    ['100.5', '100.5'],
    ['100,50', '100,50'],
  ])('al escribir %j emite %j tal cual (la tienda lo parsea)', async (typed, emitted) => {
    const wrapper = mountCash()
    await type(wrapper, typed)
    expect(lastEmitted(wrapper)).toBe(emitted)
  })

  it('un monto válido no muestra aviso', () => {
    const wrapper = mountCash({ modelValue: '1,000.50' })
    expect(wrapper.find('.cash-input__error').exists()).toBe(false)
    expect(wrapper.get('input').attributes('aria-invalid')).toBeUndefined()
  })

  it('un campo vacío no muestra aviso', () => {
    expect(mountCash({ modelValue: '' }).find('.cash-input__error').exists()).toBe(false)
  })

  it.each(['100,50', '1,5', '1.2.3', '1.000,50'])('%j es ambiguo: avisa cómo escribirlo y marca el campo', (text) => {
    const wrapper = mountCash({ modelValue: text })
    const error = wrapper.get('.cash-input__error')
    expect(error.text()).toContain('1,000.50')
    const input = wrapper.get('input')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe(error.attributes('id'))
  })

  it('quita la basura: emite el texto limpio y corrige lo que se ve en el campo', async () => {
    const wrapper = mountCash()
    const input = await type(wrapper, '$ 1a0b0')
    expect(lastEmitted(wrapper)).toBe('100')
    expect((input.element as HTMLInputElement).value).toBe('100')
  })

  it('un campo bloqueado no acepta escritura ni atajos', () => {
    const wrapper = mountCash({ disabled: true, totalMinor: 5000 })
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    for (const chip of wrapper.findAll('.cash-input__chip')) expect(chip.attributes('disabled')).toBeDefined()
    for (const btn of padButtons(wrapper)) expect(btn.attributes('disabled')).toBeDefined()
  })
})

describe('CashInput — "Justo"', () => {
  const chips = (w: ReturnType<typeof mountCash>) => w.findAll('.cash-input__chip')

  it('sin total (carrito vacío) no ofrece "Justo"', () => {
    const wrapper = mountCash({ totalMinor: 0 })
    expect(chips(wrapper)).toHaveLength(0)
  })

  it('"Justo" emite el total exacto (entero sin decimales, o con dos)', async () => {
    const whole = mountCash({ totalMinor: 15000 })
    await chips(whole)[0].trigger('click')
    expect(lastEmitted(whole)).toBe('150')

    const cents = mountCash({ totalMinor: 12550 })
    await chips(cents)[0].trigger('click')
    expect(lastEmitted(cents)).toBe('125.50')
    expect(parseCashInput(lastEmitted(cents) as string)).toBe(12550)

    const odd = mountCash({ totalMinor: 1999 })
    await chips(odd)[0].trigger('click')
    expect(lastEmitted(odd)).toBe('19.99')
  })

  it('tiene nombre accesible que contiene su texto visible y el monto', () => {
    const wrapper = mountCash({ totalMinor: 12550 })
    const justo = chips(wrapper)[0]
    expect(justo.attributes('aria-label')).toContain('Justo')
    expect(justo.attributes('aria-label')).toContain('125.50')
    expect(justo.attributes('type')).toBe('button')
  })
})

describe('CashInput — selector de billetes combinable', () => {
  it('siempre muestra los 6 billetes + 4 monedas del pad, sin importar el total', () => {
    expect(padButtons(mountCash({ totalMinor: 0 }))).toHaveLength(10)
    expect(padButtons(mountCash({ totalMinor: 12550 }))).toHaveLength(10)
  })

  it('tocar el mismo billete varias veces acumula su valor (p. ej. $200 x2 = $400)', async () => {
    const wrapper = mountCash()
    const bill200 = padButtons(wrapper).find((b) => b.text().startsWith('$200'))!

    await bill200.trigger('click')
    expect(lastEmitted(wrapper)).toBe('200.00')
    await roundTrip(wrapper)

    await bill200.trigger('click')
    expect(lastEmitted(wrapper)).toBe('400.00')
  })

  it('combinar billetes distintos suma correctamente', async () => {
    const wrapper = mountCash()
    const bill200 = padButtons(wrapper).find((b) => b.text().startsWith('$200'))!
    const bill50 = padButtons(wrapper).find((b) => b.text().startsWith('$50'))!

    await bill200.trigger('click')
    await roundTrip(wrapper)
    await bill50.trigger('click')

    expect(lastEmitted(wrapper)).toBe('250.00')
  })

  it('escribir directamente en el campo limpia la selección visual del pad', async () => {
    const wrapper = mountCash()
    const bill200 = padButtons(wrapper).find((b) => b.text().startsWith('$200'))!

    await bill200.trigger('click')
    await roundTrip(wrapper)
    expect(padBadges(wrapper)).toHaveLength(1)

    await type(wrapper, '999')
    await roundTrip(wrapper)
    expect(padBadges(wrapper)).toHaveLength(0)
  })

  it('tocar "Justo" también limpia la selección del pad (su texto no coincide con lo emitido por el pad)', async () => {
    const wrapper = mountCash({ totalMinor: 99999 })
    const bill200 = padButtons(wrapper).find((b) => b.text().startsWith('$200'))!
    const justo = wrapper.get('.cash-input__chip--exact')

    await bill200.trigger('click')
    await roundTrip(wrapper)
    expect(padBadges(wrapper)).toHaveLength(1)

    await justo.trigger('click')
    // El total ($999.99) no coincide con lo que el pad emitió ("200.00"), así que
    // este caso no cae en el borde raro de coincidencia exacta documentado.
    expect(lastEmitted(wrapper)).not.toBe('200.00')
    await roundTrip(wrapper)
    expect(padBadges(wrapper)).toHaveLength(0)
  })

  it('"Limpiar selección" limpia las cuentas Y el texto, y solo aparece con selección activa', async () => {
    const wrapper = mountCash()
    expect(wrapper.find('.cash-input__clear').exists()).toBe(false)

    const bill200 = padButtons(wrapper).find((b) => b.text().startsWith('$200'))!
    await bill200.trigger('click')
    await roundTrip(wrapper)

    const clearBtn = wrapper.get('.cash-input__clear')
    expect(clearBtn.attributes('type')).toBe('button')
    await clearBtn.trigger('click')

    expect(lastEmitted(wrapper)).toBe('')
    expect(padBadges(wrapper)).toHaveLength(0)
    await roundTrip(wrapper)
    expect(wrapper.find('.cash-input__clear').exists()).toBe(false)
  })

  it('"Limpiar selección" se deshabilita cuando el campo está bloqueado', async () => {
    const wrapper = mountCash()
    const bill200 = padButtons(wrapper).find((b) => b.text().startsWith('$200'))!
    await bill200.trigger('click')
    await roundTrip(wrapper)
    await wrapper.setProps({ disabled: true })
    expect(wrapper.get('.cash-input__clear').attributes('disabled')).toBeDefined()
  })

  it('el monto emitido se recalcula en cada interacción', async () => {
    const wrapper = mountCash()
    const bill100 = padButtons(wrapper).find((b) => b.text().startsWith('$100'))!
    const bill500 = padButtons(wrapper).find((b) => b.text().startsWith('$500'))!

    await bill100.trigger('click')
    expect(lastEmitted(wrapper)).toBe('100.00')
    await roundTrip(wrapper)

    await bill100.trigger('click')
    expect(lastEmitted(wrapper)).toBe('200.00')
    await roundTrip(wrapper)

    await bill500.trigger('click')
    expect(lastEmitted(wrapper)).toBe('700.00')
  })

  it('tocar la misma moneda varias veces acumula su valor (p. ej. $5 x3 = $15)', async () => {
    const wrapper = mountCash()
    const coin5 = padCoinButtons(wrapper).find((b) => b.text().startsWith('$5'))!

    await coin5.trigger('click')
    expect(lastEmitted(wrapper)).toBe('5.00')
    await roundTrip(wrapper)

    await coin5.trigger('click')
    expect(lastEmitted(wrapper)).toBe('10.00')
    await roundTrip(wrapper)

    await coin5.trigger('click')
    expect(lastEmitted(wrapper)).toBe('15.00')
  })

  it('combina billetes y monedas en el mismo total (2×$200 + 1×$10 + 2×$5 = $420)', async () => {
    const wrapper = mountCash()
    const bill200 = padButtons(wrapper).find((b) => b.text().startsWith('$200'))!
    const coin10 = padCoinButtons(wrapper).find((b) => b.text().startsWith('$10'))!
    const coin5 = padCoinButtons(wrapper).find((b) => b.text().startsWith('$5'))!

    await bill200.trigger('click')
    await roundTrip(wrapper)
    await bill200.trigger('click')
    await roundTrip(wrapper)
    await coin10.trigger('click')
    await roundTrip(wrapper)
    await coin5.trigger('click')
    await roundTrip(wrapper)
    await coin5.trigger('click')
    await roundTrip(wrapper)

    expect(lastEmitted(wrapper)).toBe('420.00')
  })
})
