import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AmountInput from '../AmountInput.vue'
import source from '../AmountInput.vue?raw'

const mountInput = (props: Record<string, unknown> = {}) =>
  mount(AmountInput, { props: { modelValue: '', label: '¿Cuánto te dan?', ...props } })

describe('AmountInput', () => {
  it('es un campo numérico con su etiqueta enlazada', () => {
    const wrapper = mountInput()
    const input = wrapper.get('input')

    expect(wrapper.get('label').text()).toBe('¿Cuánto te dan?')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('inputmode')).toBe('decimal')
    expect(input.attributes('type')).toBe('text')
    expect(input.attributes('placeholder')).toBe('0.00')
  })

  it('muestra el signo de pesos y el valor recibido', () => {
    const wrapper = mountInput({ modelValue: '1,500' })

    expect(wrapper.text()).toContain('$')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('1,500')
  })

  it('emite el texto ya limpio mientras se escribe', async () => {
    const wrapper = mountInput()

    await wrapper.get('input').setValue('$ 1abc500')

    expect(wrapper.emitted('update:modelValue')).toEqual([['1500']])
  })

  it('no ofrece billetes, monedas, limpiar selección ni atajos', () => {
    const wrapper = mountInput({ modelValue: '100' })

    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).not.toMatch(/billete|moneda|Justo|Limpiar/i)
  })

  describe('un monto ambiguo no se adivina', () => {
    it('lo marca inválido y explica cómo escribirlo', () => {
      const wrapper = mountInput({ modelValue: '100,50' })
      const input = wrapper.get('input')

      expect(input.attributes('aria-invalid')).toBe('true')
      expect(wrapper.get('[role="alert"]').text()).toContain('1,000.50')
      expect(input.attributes('aria-describedby')).toBe(wrapper.get('[role="alert"]').attributes('id'))
    })

    it.each(['', '0', '1,000.50', '125.5'])('un valor claro (%j) no muestra error', (modelValue) => {
      const wrapper = mountInput({ modelValue })

      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      expect(wrapper.get('input').attributes('aria-invalid')).toBeUndefined()
    })
  })

  it('deshabilitado bloquea el campo', () => {
    expect(mountInput({ disabled: true }).get('input').attributes('disabled')).toBeDefined()
  })

  it('acepta un id propio y una descripción externa', () => {
    const wrapper = mountInput({ id: 'importe', descriptionId: 'ayuda' })

    expect(wrapper.get('input').attributes('id')).toBe('importe')
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('ayuda')
  })

  it('el tamaño grande agrega su clase (pantalla de cobro en celular)', () => {
    expect(mountInput({ size: 'lg' }).get('.amount-input').classes()).toContain('amount-input--lg')
  })

  describe('contrato de CSS', () => {
    const style = source.slice(source.indexOf('<style'))
    const rule = (selector: string) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return style.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? ''
    }

    it('el campo mide al menos 44 px y en tamaño grande 64 px, con letra legible', () => {
      expect(rule('.amount-input__control')).toMatch(/min-height:\s*var\(--control-height-cta\)/)
      expect(rule('.amount-input--lg .amount-input__control')).toMatch(/min-height:\s*4rem/)
      expect(rule('.amount-input--lg .amount-input__control')).toMatch(/font-size:\s*2rem/)
    })

    it('no se sale de su tarjeta', () => {
      expect(rule('.amount-input__control')).toMatch(/width:\s*100%/)
      expect(rule('.amount-input__control')).toMatch(/min-width:\s*0/)
    })
  })
})
