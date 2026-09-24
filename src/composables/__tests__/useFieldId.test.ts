// Tests del composable useFieldId — id de campo generado o explícito
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, useAttrs } from 'vue'
import { useFieldId } from '@/composables/useFieldId'

// Componente mínimo que expone el id resuelto en un <input>
const Harness = defineComponent({
  inheritAttrs: false,
  setup() {
    const fieldId = useFieldId(useAttrs())
    return () => h('input', { id: fieldId() })
  },
})

describe('useFieldId', () => {
  it('genera un id no vacío cuando el padre no pasa ninguno', () => {
    const wrapper = mount(Harness)
    expect(wrapper.get('input').attributes('id')).toBeTruthy()
  })

  it('respeta el id explícito recibido como atributo', () => {
    const wrapper = mount(Harness, { attrs: { id: 'campo-usuario' } })
    expect(wrapper.get('input').attributes('id')).toBe('campo-usuario')
  })

  it.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['un número (no string)', 42],
    ['null', null],
  ])('usa el id generado cuando el explícito es %s', (_caso, valor) => {
    const wrapper = mount(Harness, { attrs: { id: valor } })
    const id = wrapper.get('input').attributes('id')

    expect(id).toBeTruthy()
    expect(id).not.toBe(String(valor))
    expect(id?.trim()).toBe(id)
  })

  it('asigna ids distintos a dos instancias del componente', () => {
    // Misma app (mismo padre): useId() numera por aplicación, no por mount()
    const Parent = () => h('div', [h(Harness), h(Harness)])
    const inputs = mount(Parent).findAll('input')
    expect(inputs[0].attributes('id')).not.toBe(inputs[1].attributes('id'))
  })

  it('respeta un cambio posterior del atributo id', async () => {
    const id = ref('primero')
    const Parent = () => h(Harness, { id: id.value })
    const wrapper = mount(Parent)
    expect(wrapper.get('input').attributes('id')).toBe('primero')

    id.value = 'segundo'
    await nextTick()
    expect(wrapper.get('input').attributes('id')).toBe('segundo')
  })
})
