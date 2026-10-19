// Dos modales abiertos a la vez (la ficha de un producto ENCIMA del escáner): Escape y Tab
// son del de arriba, y al cerrar ese el de abajo sigue con el scroll bloqueado.
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { h, ref, defineComponent } from 'vue'
import AppModal from '../AppModal.vue'

const mounted: Array<{ unmount: () => void }> = []
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.replaceChildren()
  document.body.style.overflow = ''
})

const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

function mountStack() {
  const lower = ref(true)
  const upper = ref(false)
  const wrapper = mount(
    defineComponent({
      setup: () => () => [
        h(AppModal, { modelValue: lower.value, title: 'Abajo', 'onUpdate:modelValue': (v: boolean) => (lower.value = v) }),
        h(AppModal, { modelValue: upper.value, title: 'Arriba', 'onUpdate:modelValue': (v: boolean) => (upper.value = v) }),
      ],
    }),
    { attachTo: document.body },
  )
  mounted.push(wrapper)
  return { wrapper, lower, upper }
}

describe('modales apilados', () => {
  it('Escape cierra solo el de arriba', async () => {
    const { lower, upper } = mountStack()
    upper.value = true
    await flushPromises()

    escape()
    await flushPromises()

    expect(upper.value).toBe(false)
    expect(lower.value).toBe(true)
  })

  it('con el de arriba cerrado, Escape cierra el de abajo', async () => {
    const { lower, upper } = mountStack()
    upper.value = true
    await flushPromises()
    escape()
    await flushPromises()

    escape()
    await flushPromises()

    expect(lower.value).toBe(false)
  })

  it('al cerrar el de arriba el scroll sigue bloqueado por el de abajo', async () => {
    const { upper } = mountStack()
    upper.value = true
    await flushPromises()
    expect(document.body.style.overflow).toBe('hidden')

    upper.value = false
    await flushPromises()

    expect(document.body.style.overflow).toBe('hidden')
  })

  it('al cerrar todos se libera el scroll', async () => {
    const { lower, upper } = mountStack()
    upper.value = true
    await flushPromises()

    upper.value = false
    lower.value = false
    await flushPromises()

    expect(document.body.style.overflow).toBe('')
  })

  it('un modal abierto solo sigue funcionando como siempre', async () => {
    const { lower } = mountStack()
    await flushPromises()

    escape()
    await flushPromises()

    expect(lower.value).toBe(false)
  })

  it('desmontar con el modal abierto lo saca de la pila (el siguiente Escape no se pierde)', async () => {
    const { wrapper, lower, upper } = mountStack()
    upper.value = true
    await flushPromises()
    wrapper.unmount()

    const solo = mount(AppModal, { attachTo: document.body, props: { modelValue: true, title: 'Solo' } })
    mounted.push(solo)
    escape()

    expect(solo.emitted('update:modelValue')?.at(-1)).toEqual([false])
    expect(lower.value).toBe(true)
  })
})
