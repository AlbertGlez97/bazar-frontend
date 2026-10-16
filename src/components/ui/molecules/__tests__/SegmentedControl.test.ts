import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SegmentedControl from '../SegmentedControl.vue'
import source from '../SegmentedControl.vue?raw'

const options = [
  { value: 'a', label: 'Uno' },
  { value: 'b', label: 'Dos' },
  { value: 'c', label: 'Tres' },
]

const mountControl = (props: Record<string, unknown> = {}) =>
  mount(SegmentedControl, { props: { modelValue: 'a', options, label: 'Elige una', ...props } })

const buttons = (w: ReturnType<typeof mountControl>) => w.findAll('button')

describe('SegmentedControl', () => {
  it('es un grupo con nombre accesible y un botón por opción, con su texto', () => {
    const wrapper = mountControl()

    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Elige una')
    expect(buttons(wrapper).map((b) => b.text())).toEqual(['Uno', 'Dos', 'Tres'])
    expect(buttons(wrapper).every((b) => b.attributes('type') === 'button')).toBe(true)
  })

  it('marca la opción activa con aria-pressed (no solo con color)', () => {
    const wrapper = mountControl({ modelValue: 'b' })

    expect(buttons(wrapper).map((b) => b.attributes('aria-pressed'))).toEqual(['false', 'true', 'false'])
  })

  it('cada botón lleva su valor', () => {
    const wrapper = mountControl()

    expect(buttons(wrapper).map((b) => b.attributes('data-value'))).toEqual(['a', 'b', 'c'])
  })

  it('tocar otra opción emite update:modelValue con su valor', async () => {
    const wrapper = mountControl()

    await buttons(wrapper)[2]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['c']])
  })

  it('tocar la opción que ya está activa no emite nada', async () => {
    const wrapper = mountControl({ modelValue: 'a' })

    await buttons(wrapper)[0]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('deshabilitado bloquea todos los botones', async () => {
    const wrapper = mountControl({ disabled: true })

    expect(buttons(wrapper).every((b) => b.attributes('disabled') !== undefined)).toBe(true)
    await buttons(wrapper)[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('el tamaño lg agrega su clase', () => {
    expect(mountControl().get('.segmented-control').classes()).toContain('segmented-control--md')
    expect(mountControl({ size: 'lg' }).get('.segmented-control').classes()).toContain('segmented-control--lg')
  })

  it('un ícono decorativo no reemplaza al texto', () => {
    const wrapper = mountControl({ options: [{ value: 'a', label: 'Uno', icon: '▦' }] })

    expect(wrapper.get('button').text()).toContain('Uno')
    expect(wrapper.get('button [aria-hidden="true"]').text()).toBe('▦')
  })

  it('se alinea con teclado: los botones son nativos (Enter y Espacio funcionan sin código extra)', () => {
    expect(buttons(mountControl()).every((b) => b.element.tagName === 'BUTTON')).toBe(true)
  })

  describe('contrato de CSS', () => {
    const style = source.slice(source.indexOf('<style'))
    const rule = (selector: string) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return style.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? ''
    }

    it('el alto sale de los tokens por tipo de puntero (los valores: control-heights.test.ts)', () => {
      expect(rule('.segmented-control__btn')).toMatch(/min-height:\s*var\(--control-height\)/)
      expect(rule('.segmented-control--lg .segmented-control__btn')).toMatch(/min-height:\s*var\(--control-height-cta\)/)
    })

    it('el texto NUNCA se parte ni se trunca: una sola línea, ancho según contenido ("Transferencia" completa)', () => {
      const button = rule('.segmented-control__btn')
      expect(button).toMatch(/white-space:\s*nowrap/)
      expect(button).toMatch(/flex:\s*1\s+1\s+auto/)
      expect(button).not.toMatch(/min-width:\s*0/)
      expect(rule('.segmented-control__label')).not.toMatch(/overflow-wrap:\s*anywhere|word-break/)
      expect(rule('.segmented-control__label')).not.toMatch(/text-overflow|overflow:\s*hidden/)
    })

    it('si de verdad no cupieran, los botones bajan a otra fila en vez de cortar el texto', () => {
      expect(rule('.segmented-control')).toMatch(/flex-wrap:\s*wrap/)
    })

    it('la opción activa se distingue por borde y peso, no solo por color', () => {
      const active = rule(".segmented-control__btn[aria-pressed='true']")
      expect(active).toMatch(/border-color/)
      expect(active).toMatch(/font-weight:\s*800/)
    })

    it('el tono es neutro: no usa el color fuerte de la acción principal', () => {
      expect(rule(".segmented-control__btn[aria-pressed='true']")).not.toMatch(/--color-primary\b/)
    })
  })
})
