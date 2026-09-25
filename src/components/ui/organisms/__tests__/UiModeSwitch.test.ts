import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { mockDevice, type MockDevice } from '@/test/mockDevice'
import type { UiMode } from '@/types/ui-mode.types'
import UiModeSwitch from '../UiModeSwitch.vue'

let device: MockDevice | null = null

afterEach(() => {
  device?.restore()
  device = null
})

// AppModal usa <Teleport to="body">: se stubea para que el aviso quede dentro
// del wrapper y sea consultable desde el test.
function mountSwitch(modelValue: UiMode, props: { compact?: boolean } = {}) {
  return mount(UiModeSwitch, {
    props: { modelValue, ...props },
    global: { stubs: { teleport: true } },
  })
}

const WARNING_TITLE = '¿Seguro que quieres entrar a Gestión?'
const warningShown = (wrapper: ReturnType<typeof mountSwitch>) => wrapper.text().includes(WARNING_TITLE)
const button = (wrapper: ReturnType<typeof mountSwitch>, name: string) =>
  wrapper.findAll('button').find((b) => b.text() === name || b.attributes('aria-label') === name)!
const emittedModes = (wrapper: ReturnType<typeof mountSwitch>) =>
  (wrapper.emitted('update:modelValue') ?? []).map(([mode]) => mode)

/** Dispositivo táctil de pantalla pequeña: el único que dispara el aviso. */
const smallTouch = () => { device = mockDevice({ touch: true, small: true }) }

describe('UiModeSwitch — semántica y contenido', () => {
  it('ofrece dos botones reales, "Venta" y "Gestión", dentro de un grupo con nombre', () => {
    const wrapper = mountSwitch('gestion')
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Modo de la aplicación')
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons.every((b) => b.attributes('type') === 'button')).toBe(true)
    expect(buttons.map((b) => b.text())).toEqual(expect.arrayContaining([expect.stringContaining('Venta'), expect.stringContaining('Gestión')]))
  })

  it('aria-pressed marca solo el modo activo', () => {
    const gestion = mountSwitch('gestion')
    expect(button(gestion, 'Modo Gestión').attributes('aria-pressed')).toBe('true')
    expect(button(gestion, 'Modo Venta').attributes('aria-pressed')).toBe('false')

    const venta = mountSwitch('venta')
    expect(button(venta, 'Modo Venta').attributes('aria-pressed')).toBe('true')
    expect(button(venta, 'Modo Gestión').attributes('aria-pressed')).toBe('false')
  })

  it('compacto conserva los nombres accesibles pero sin texto visible', () => {
    const wrapper = mountSwitch('venta', { compact: true })
    expect(wrapper.get('.ui-mode-switch').classes()).toContain('ui-mode-switch--compact')
    expect(wrapper.find('.ui-mode-switch__label').exists()).toBe(false)
    expect(button(wrapper, 'Modo Venta').attributes('aria-label')).toBe('Modo Venta')
    expect(button(wrapper, 'Modo Gestión').attributes('aria-label')).toBe('Modo Gestión')
  })

  it('el aviso no se muestra mientras no se intenta pasar a Gestión', () => {
    smallTouch()
    expect(warningShown(mountSwitch('venta'))).toBe(false)
  })
})

describe('UiModeSwitch — cambio sin aviso', () => {
  it('equipo grande sin pantalla táctil: pasar a Gestión cambia directo, sin aviso', async () => {
    device = mockDevice({ touch: false, small: false })
    const wrapper = mountSwitch('venta')
    await button(wrapper, 'Modo Gestión').trigger('click')
    expect(warningShown(wrapper)).toBe(false)
    expect(emittedModes(wrapper)).toEqual(['gestion'])
  })

  it('sin matchMedia (entorno sin soporte) tampoco avisa', async () => {
    const wrapper = mountSwitch('venta')
    await button(wrapper, 'Modo Gestión').trigger('click')
    expect(warningShown(wrapper)).toBe(false)
    expect(emittedModes(wrapper)).toEqual(['gestion'])
  })

  it.each([
    { name: 'solo táctil (pantalla grande)', touch: true, small: false },
    { name: 'solo pantalla pequeña (sin táctil)', touch: false, small: true },
  ])('$name: no avisa', async ({ touch, small }) => {
    device = mockDevice({ touch, small })
    const wrapper = mountSwitch('venta')
    await button(wrapper, 'Modo Gestión').trigger('click')
    expect(warningShown(wrapper)).toBe(false)
    expect(emittedModes(wrapper)).toEqual(['gestion'])
  })

  it('pasar a Venta nunca avisa, ni siquiera desde táctil + pantalla pequeña', async () => {
    smallTouch()
    const wrapper = mountSwitch('gestion')
    await button(wrapper, 'Modo Venta').trigger('click')
    expect(warningShown(wrapper)).toBe(false)
    expect(emittedModes(wrapper)).toEqual(['venta'])
  })

  it('tocar el modo que ya está activo no hace nada', async () => {
    smallTouch()
    const gestion = mountSwitch('gestion')
    await button(gestion, 'Modo Gestión').trigger('click')
    expect(emittedModes(gestion)).toEqual([])
    expect(warningShown(gestion)).toBe(false)

    const venta = mountSwitch('venta')
    await button(venta, 'Modo Venta').trigger('click')
    expect(emittedModes(venta)).toEqual([])
  })
})

describe('UiModeSwitch — aviso no bloqueante (táctil + pantalla pequeña)', () => {
  it('al ir a Gestión muestra el aviso y todavía no cambia el modo', async () => {
    smallTouch()
    const wrapper = mountSwitch('venta')
    await button(wrapper, 'Modo Gestión').trigger('click')

    expect(warningShown(wrapper)).toBe(true)
    expect(wrapper.text()).toContain('computadora')
    expect(emittedModes(wrapper)).toEqual([])
  })

  it('ofrece exactamente dos salidas: "Entiendo, quiero seguir" y "Mejor no"', async () => {
    smallTouch()
    const wrapper = mountSwitch('venta')
    await button(wrapper, 'Modo Gestión').trigger('click')

    const actions = wrapper.get('.ui-mode-switch__actions').findAll('button').map((b) => b.text())
    expect(actions).toEqual(['Entiendo, quiero seguir', 'Mejor no'])
  })

  it('"Entiendo, quiero seguir" cambia a Gestión y cierra el aviso', async () => {
    smallTouch()
    const wrapper = mountSwitch('venta')
    await button(wrapper, 'Modo Gestión').trigger('click')

    await button(wrapper, 'Entiendo, quiero seguir').trigger('click')

    expect(emittedModes(wrapper)).toEqual(['gestion'])
    expect(warningShown(wrapper)).toBe(false)
  })

  it('"Mejor no" cierra el aviso y no cambia nada', async () => {
    smallTouch()
    const wrapper = mountSwitch('venta')
    await button(wrapper, 'Modo Gestión').trigger('click')

    await button(wrapper, 'Mejor no').trigger('click')

    expect(emittedModes(wrapper)).toEqual([])
    expect(warningShown(wrapper)).toBe(false)
    expect(button(wrapper, 'Modo Venta').attributes('aria-pressed')).toBe('true')
  })

  it('Escape también equivale a "Mejor no"', async () => {
    smallTouch()
    const wrapper = mountSwitch('venta')
    await button(wrapper, 'Modo Gestión').trigger('click')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(warningShown(wrapper)).toBe(false)
    expect(emittedModes(wrapper)).toEqual([])
    wrapper.unmount()
  })

  it('tras cancelar se puede volver a intentar y el aviso reaparece', async () => {
    smallTouch()
    const wrapper = mountSwitch('venta')
    await button(wrapper, 'Modo Gestión').trigger('click')
    await button(wrapper, 'Mejor no').trigger('click')
    await button(wrapper, 'Modo Gestión').trigger('click')
    expect(warningShown(wrapper)).toBe(true)
  })

  it('evalúa el dispositivo al momento de cambiar: si la pantalla cambia, el aviso responde', async () => {
    device = mockDevice({ touch: true, small: false })
    const wrapper = mountSwitch('venta')

    await button(wrapper, 'Modo Gestión').trigger('click')
    expect(warningShown(wrapper)).toBe(false)
    expect(emittedModes(wrapper)).toEqual(['gestion'])

    device.set({ small: true })
    await wrapper.vm.$nextTick()
    await button(wrapper, 'Modo Gestión').trigger('click')
    expect(warningShown(wrapper)).toBe(true)
    expect(emittedModes(wrapper)).toEqual(['gestion']) // el segundo intento no emitió
  })
})
