import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AppDropdownPanel from '../AppDropdownPanel.vue'

const slots = {
  trigger: '<template #trigger="{ attrs }"><button type="button" class="trigger" v-bind="attrs">Filtros</button></template>',
  default: '<button type="button" class="first">Uno</button><button type="button" class="last">Dos</button>',
}

function mountPanel(modelValue = false) {
  const wrapper = mount(AppDropdownPanel, {
    props: {
      modelValue,
      title: 'Filtros',
      closeLabel: 'Cerrar filtros',
      'onUpdate:modelValue': (value: boolean) => wrapper.setProps({ modelValue: value }),
    },
    slots,
    attachTo: document.body,
  })
  return wrapper
}

const surface = (wrapper: ReturnType<typeof mountPanel>) => wrapper.find('[role="dialog"]')
const press = (key: string, init: KeyboardEventInit = {}) =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))

function mockViewport(narrow: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: narrow, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })))
  window.matchMedia = globalThis.matchMedia
}

afterEach(() => {
  vi.unstubAllGlobals()
  // @ts-expect-error restaurar el entorno sin matchMedia
  delete window.matchMedia
  document.body.innerHTML = ''
})

describe('AppDropdownPanel', () => {
  describe('abrir y cerrar', () => {
    it('cerrado: no hay panel y el disparador dice aria-expanded=false', () => {
      const wrapper = mountPanel(false)

      expect(surface(wrapper).exists()).toBe(false)
      expect(wrapper.get('.trigger').attributes('aria-expanded')).toBe('false')
      wrapper.unmount()
    })

    it('abierto: el panel es un diálogo con nombre y el disparador lo apunta con aria-controls', () => {
      const wrapper = mountPanel(true)
      const dialog = surface(wrapper)

      expect(dialog.exists()).toBe(true)
      expect(dialog.attributes('aria-label')).toBe('Filtros')
      expect(wrapper.get('.trigger').attributes('aria-expanded')).toBe('true')
      expect(wrapper.get('.trigger').attributes('aria-controls')).toBe(dialog.attributes('id'))
      wrapper.unmount()
    })

    it('tocar el disparador abre y vuelve a cerrar', async () => {
      const wrapper = mountPanel(false)

      await wrapper.get('.trigger').trigger('click')
      expect(surface(wrapper).exists()).toBe(true)
      await wrapper.get('.trigger').trigger('click')
      expect(surface(wrapper).exists()).toBe(false)
      wrapper.unmount()
    })

    it('Escape lo cierra', async () => {
      const wrapper = mountPanel(true)

      press('Escape')
      await wrapper.vm.$nextTick()

      expect(surface(wrapper).exists()).toBe(false)
      wrapper.unmount()
    })

    it('un clic fuera lo cierra; un clic dentro no', async () => {
      const wrapper = mountPanel(true)
      await wrapper.vm.$nextTick()

      await wrapper.get('.first').trigger('click')
      expect(surface(wrapper).exists()).toBe(true)

      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await wrapper.vm.$nextTick()
      expect(surface(wrapper).exists()).toBe(false)
      wrapper.unmount()
    })

    it('el botón de cerrar tiene nombre accesible y lo cierra', async () => {
      const wrapper = mountPanel(true)
      const close = wrapper.get('[aria-label="Cerrar filtros"]')

      await close.trigger('click')

      expect(surface(wrapper).exists()).toBe(false)
      wrapper.unmount()
    })

    it('no deja escuchas globales cuando se desmonta abierto', async () => {
      const spy = vi.spyOn(document, 'removeEventListener')
      const wrapper = mountPanel(true)
      await wrapper.vm.$nextTick()

      wrapper.unmount()

      expect(spy.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(['click', 'keydown']))
      spy.mockRestore()
    })
  })

  describe('teclado y foco', () => {
    it('al abrir, el foco entra al panel', async () => {
      const wrapper = mountPanel(false)
      ;(wrapper.get('.trigger').element as HTMLElement).focus()

      await wrapper.get('.trigger').trigger('click')
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      expect(surface(wrapper).element.contains(document.activeElement)).toBe(true)
      wrapper.unmount()
    })

    it('Tab en el último elemento vuelve al primero (foco atrapado)', async () => {
      const wrapper = mountPanel(true)
      await wrapper.vm.$nextTick()
      const last = wrapper.get('.last').element as HTMLElement
      last.focus()

      await surface(wrapper).trigger('keydown', { key: 'Tab' })

      const first = surface(wrapper).element.querySelector<HTMLElement>('button')
      expect(document.activeElement).toBe(first)
      wrapper.unmount()
    })

    it('Shift+Tab en el primero salta al último', async () => {
      const wrapper = mountPanel(true)
      await wrapper.vm.$nextTick()
      const first = surface(wrapper).element.querySelector<HTMLElement>('button')!
      first.focus()

      await surface(wrapper).trigger('keydown', { key: 'Tab', shiftKey: true })

      expect(document.activeElement).toBe(wrapper.get('.last').element)
      wrapper.unmount()
    })

    it('al cerrar, el foco regresa al disparador', async () => {
      const wrapper = mountPanel(false)
      const trigger = wrapper.get('.trigger').element as HTMLElement
      trigger.focus()
      await wrapper.get('.trigger').trigger('click')
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      press('Escape')
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      expect(document.activeElement).toBe(trigger)
      wrapper.unmount()
    })
  })

  describe('presentación según el ancho', () => {
    it('pantalla ancha: panel anclado al disparador, sin telón', () => {
      mockViewport(false)
      const wrapper = mountPanel(true)

      expect(surface(wrapper).classes()).toContain('app-dropdown-panel__surface--popover')
      expect(wrapper.find('.app-dropdown-panel__backdrop').exists()).toBe(false)
      wrapper.unmount()
    })

    it('tablet o celular: hoja desde abajo con telón que también cierra', async () => {
      mockViewport(true)
      const wrapper = mountPanel(true)

      expect(surface(wrapper).classes()).toContain('app-dropdown-panel__surface--sheet')
      await wrapper.get('.app-dropdown-panel__backdrop').trigger('click')
      expect(surface(wrapper).exists()).toBe(false)
      wrapper.unmount()
    })
  })

  it('el pie es opcional y se muestra si se pasa', () => {
    const wrapper = mount(AppDropdownPanel, {
      props: { modelValue: true, title: 'Filtros', closeLabel: 'Cerrar' },
      slots: { ...slots, footer: '<span class="pie">Pie</span>' },
    })

    expect(wrapper.find('.pie').exists()).toBe(true)
    wrapper.unmount()
  })
})
