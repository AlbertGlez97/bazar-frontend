import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CashInput from '../CashInput.vue'
import { displayToMinor, sanitizeCashText } from '@/utils/money'

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

describe('sanitizeCashText', () => {
  it.each([
    ['100', '100'],
    ['100.5', '100.5'],
    ['100,50', '100,50'],
    ['', ''],
    ['abc', ''],
    ['$ 1 500', '1500'],
    ['-20', '20'],
    ['1e5', '15'],
    ['12.345', '12.34'],
    ['12,999', '12,99'],
    ['1,000.50', '1000.50'],
    ['1.000,50', '1000,50'],
    ['1,000,000', '1000000'],
    ['1.2.3', '123'],
    ['.5', '0.5'],
    [',5', '0,5'],
    ['100.', '100.'],
    ['1234567890.55', '12345678.55'],
    ['123456789012', '12345678'],
  ])('%j -> %j', (typed, expected) => {
    expect(sanitizeCashText(typed)).toBe(expected)
  })

  it('lo que devuelve lo entiende el parser de la tienda (displayToMinor) con dinero exacto', () => {
    expect(displayToMinor(sanitizeCashText('100'))).toBe(10000)
    expect(displayToMinor(sanitizeCashText('100.5'))).toBe(10050)
    expect(displayToMinor(sanitizeCashText('100,50'))).toBe(10050)
    expect(displayToMinor(sanitizeCashText('$1,000.50'))).toBe(100050)
    expect(displayToMinor(sanitizeCashText('19.99'))).toBe(1999)
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
  })
})

describe('CashInput — atajos', () => {
  const chips = (w: ReturnType<typeof mountCash>) => w.findAll('.cash-input__chip')

  it('ofrece "Justo" y cinco billetes: 20, 50, 100, 200 y 500', () => {
    const wrapper = mountCash({ totalMinor: 12550 })
    expect(chips(wrapper).map((c) => c.text())).toEqual(['Justo', '$20', '$50', '$100', '$200', '$500'])
  })

  it('un billete emite ese monto por el mismo camino que escribir', async () => {
    const wrapper = mountCash({ totalMinor: 12550 })
    await chips(wrapper)[3].trigger('click')
    expect(lastEmitted(wrapper)).toBe('100')
    expect(displayToMinor(lastEmitted(wrapper) as string)).toBe(10000)
  })

  it('"Justo" emite el total exacto (entero sin decimales, o con dos)', async () => {
    const whole = mountCash({ totalMinor: 15000 })
    await chips(whole)[0].trigger('click')
    expect(lastEmitted(whole)).toBe('150')

    const cents = mountCash({ totalMinor: 12550 })
    await chips(cents)[0].trigger('click')
    expect(lastEmitted(cents)).toBe('125.50')
    expect(displayToMinor(lastEmitted(cents) as string)).toBe(12550)

    const odd = mountCash({ totalMinor: 1999 })
    await chips(odd)[0].trigger('click')
    expect(lastEmitted(odd)).toBe('19.99')
  })

  it('sin total (carrito vacío) no ofrece "Justo" pero sí los billetes', () => {
    const wrapper = mountCash({ totalMinor: 0 })
    expect(chips(wrapper).map((c) => c.text())).not.toContain('Justo')
    expect(chips(wrapper)).toHaveLength(5)
  })

  it('cada atajo tiene nombre accesible que contiene su texto visible', () => {
    const wrapper = mountCash({ totalMinor: 12550 })
    const justo = chips(wrapper)[0]
    expect(justo.attributes('aria-label')).toContain('Justo')
    expect(justo.attributes('aria-label')).toContain('125.50')
    expect(chips(wrapper)[2].attributes('aria-label')).toContain('$50')
    for (const chip of chips(wrapper)) expect(chip.attributes('type')).toBe('button')
  })
})
