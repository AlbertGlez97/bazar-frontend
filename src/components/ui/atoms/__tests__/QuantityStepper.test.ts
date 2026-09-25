import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import QuantityStepper from '../QuantityStepper.vue'

function mountStepper(props: Partial<InstanceType<typeof QuantityStepper>['$props']> = {}) {
  return mount(QuantityStepper, { props: { quantity: 2, productName: 'Café de olla', ...props } })
}

const minus = (w: ReturnType<typeof mountStepper>) => w.get('button[data-action="decrement"]')
const plus = (w: ReturnType<typeof mountStepper>) => w.get('button[data-action="increment"]')

describe('QuantityStepper — contenido y accesibilidad', () => {
  it('muestra la cantidad dentro de un <output> de región viva educada', () => {
    const wrapper = mountStepper({ quantity: 3 })
    const output = wrapper.get('output')
    expect(output.text()).toBe('3')
    expect(output.attributes('aria-live')).toBe('polite')
  })

  it('el grupo y los botones nombran el producto para lectores de pantalla', () => {
    const wrapper = mountStepper()
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Cantidad de Café de olla')
    expect(minus(wrapper).attributes('aria-label')).toBe('Quitar una pieza de Café de olla')
    expect(plus(wrapper).attributes('aria-label')).toBe('Agregar una pieza de Café de olla')
  })

  it('son botones reales (type="button") para no enviar formularios por accidente', () => {
    const wrapper = mountStepper()
    expect(minus(wrapper).attributes('type')).toBe('button')
    expect(plus(wrapper).attributes('type')).toBe('button')
  })

  it('los símbolos son decorativos: el nombre lo da el aria-label', () => {
    const wrapper = mountStepper()
    expect(minus(wrapper).get('[aria-hidden="true"]').text()).toBe('−')
    expect(plus(wrapper).get('[aria-hidden="true"]').text()).toBe('+')
  })
})

describe('QuantityStepper — eventos', () => {
  it('"+" emite increment y "−" emite decrement', async () => {
    const wrapper = mountStepper({ quantity: 2, max: 5 })
    await plus(wrapper).trigger('click')
    await minus(wrapper).trigger('click')
    expect(wrapper.emitted('increment')).toHaveLength(1)
    expect(wrapper.emitted('decrement')).toHaveLength(1)
    expect(wrapper.emitted('limit')).toBeUndefined()
  })

  it('sin tope (max no definido) "+" siempre emite increment', async () => {
    const wrapper = mountStepper({ quantity: 999 })
    await plus(wrapper).trigger('click')
    expect(wrapper.emitted('increment')).toHaveLength(1)
  })
})

describe('QuantityStepper — límites', () => {
  it('en el mínimo "−" se ve deshabilitado (aria-disabled) y avisa el límite en vez de decrementar', async () => {
    const wrapper = mountStepper({ quantity: 1 })
    expect(minus(wrapper).attributes('aria-disabled')).toBe('true')
    expect(minus(wrapper).classes()).toContain('quantity-stepper__btn--limit')

    await minus(wrapper).trigger('click')

    expect(wrapper.emitted('decrement')).toBeUndefined()
    expect(wrapper.emitted('limit')).toEqual([['min']])
  })

  it('en el máximo "+" se ve deshabilitado y avisa "max" en vez de incrementar', async () => {
    const wrapper = mountStepper({ quantity: 4, max: 4 })
    expect(plus(wrapper).attributes('aria-disabled')).toBe('true')

    await plus(wrapper).trigger('click')

    expect(wrapper.emitted('increment')).toBeUndefined()
    expect(wrapper.emitted('limit')).toEqual([['max']])
  })

  it('por debajo del máximo "+" está activo', () => {
    const wrapper = mountStepper({ quantity: 3, max: 4 })
    expect(plus(wrapper).attributes('aria-disabled')).toBeUndefined()
  })

  it('los botones en un límite siguen siendo enfocables (aria-disabled, no disabled) para poder explicar el porqué', () => {
    const wrapper = mountStepper({ quantity: 1, max: 1 })
    expect(minus(wrapper).attributes('disabled')).toBeUndefined()
    expect(plus(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('el mínimo es configurable', async () => {
    const wrapper = mountStepper({ quantity: 0, min: 0 })
    expect(minus(wrapper).attributes('aria-disabled')).toBe('true')
    await minus(wrapper).trigger('click')
    expect(wrapper.emitted('limit')).toEqual([['min']])
  })

  it('disabled bloquea todo de verdad (mientras se cobra): nada se emite', async () => {
    const wrapper = mountStepper({ quantity: 2, max: 5, disabled: true })
    expect(minus(wrapper).attributes('disabled')).toBeDefined()
    expect(plus(wrapper).attributes('disabled')).toBeDefined()
    await plus(wrapper).trigger('click')
    await minus(wrapper).trigger('click')
    expect(wrapper.emitted('increment')).toBeUndefined()
    expect(wrapper.emitted('decrement')).toBeUndefined()
    expect(wrapper.emitted('limit')).toBeUndefined()
  })
})

describe('QuantityStepper — tamaño', () => {
  it('por defecto es md y "lg" (carrito) agrega su clase', () => {
    expect(mountStepper().get('.quantity-stepper').classes()).toContain('quantity-stepper--md')
    expect(mountStepper({ size: 'lg' }).get('.quantity-stepper').classes()).toContain('quantity-stepper--lg')
  })
})
