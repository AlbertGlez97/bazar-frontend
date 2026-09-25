import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, effectScope, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { mockDevice, type MockDevice } from '@/test/mockDevice'
import {
  SMALL_SCREEN_MAX_WIDTH,
  SMALL_SCREEN_QUERY,
  detectDeviceCapabilities,
  suggestUiMode,
  useDeviceCapabilities,
} from '../useDeviceCapabilities'

let device: MockDevice | null = null

afterEach(() => {
  device?.restore()
  device = null
})

/** Monta un componente que usa el composable, como en la app real. */
function mountWithComposable() {
  let result!: ReturnType<typeof useDeviceCapabilities>
  const wrapper = mount(defineComponent({
    setup() {
      result = useDeviceCapabilities()
      return () => null
    },
  }))
  return { wrapper, ...result }
}

describe('constantes', () => {
  it('el breakpoint es 900 px y la consulta es estrictamente menor', () => {
    expect(SMALL_SCREEN_MAX_WIDTH).toBe(900)
    expect(SMALL_SCREEN_QUERY).toBe('(max-width: 899.98px)')
  })
})

describe('detectDeviceCapabilities', () => {
  it('sin matchMedia (jsdom) ni puntos táctiles: ni táctil ni pantalla pequeña', () => {
    expect(typeof window.matchMedia).toBe('undefined')
    expect(detectDeviceCapabilities()).toEqual({ isTouchDevice: false, isSmallScreen: false })
  })

  it('puntero grueso cuenta como táctil', () => {
    device = mockDevice({ touch: true })
    expect(detectDeviceCapabilities().isTouchDevice).toBe(true)
  })

  it('maxTouchPoints > 0 cuenta como táctil aunque el puntero no sea grueso', () => {
    device = mockDevice({ touch: false, touchPoints: 5 })
    expect(detectDeviceCapabilities().isTouchDevice).toBe(true)
  })

  it('viewport menor a 900 px cuenta como pantalla pequeña', () => {
    device = mockDevice({ small: true })
    expect(detectDeviceCapabilities()).toEqual({ isTouchDevice: false, isSmallScreen: true })
  })
})

describe('suggestUiMode', () => {
  it('táctil y pequeña: venta', () => {
    expect(suggestUiMode({ isTouchDevice: true, isSmallScreen: true })).toBe('venta')
  })

  it.each([
    { isTouchDevice: true, isSmallScreen: false },
    { isTouchDevice: false, isSmallScreen: true },
    { isTouchDevice: false, isSmallScreen: false },
  ])('%o: gestion', (capabilities) => {
    expect(suggestUiMode(capabilities)).toBe('gestion')
  })

  it('sin argumentos lee el dispositivo actual', () => {
    device = mockDevice({ touch: true, small: true })
    expect(suggestUiMode()).toBe('venta')
  })
})

describe('useDeviceCapabilities', () => {
  it('expone el estado inicial del dispositivo', () => {
    device = mockDevice({ touch: true, small: false })
    const { isTouchDevice, isSmallScreen, wrapper } = mountWithComposable()
    expect(isTouchDevice.value).toBe(true)
    expect(isSmallScreen.value).toBe(false)
    wrapper.unmount()
  })

  it('reacciona a cambios de media query (girar, redimensionar)', async () => {
    device = mockDevice({ touch: false, small: false })
    const { isTouchDevice, isSmallScreen, wrapper } = mountWithComposable()

    device.set({ small: true })
    await nextTick()
    expect(isSmallScreen.value).toBe(true)
    expect(isTouchDevice.value).toBe(false)

    device.set({ touch: true, small: false })
    await nextTick()
    expect(isSmallScreen.value).toBe(false)
    expect(isTouchDevice.value).toBe(true)
    wrapper.unmount()
  })

  it('quita los listeners al desmontar', () => {
    device = mockDevice({ touch: false, small: false })
    const { wrapper } = mountWithComposable()
    expect(device.listenerCount()).toBe(2)
    wrapper.unmount()
    expect(device.listenerCount()).toBe(0)
  })

  it('en un effectScope también limpia al pararlo', () => {
    device = mockDevice()
    const scope = effectScope()
    scope.run(() => useDeviceCapabilities())
    expect(device.listenerCount()).toBe(2)
    scope.stop()
    expect(device.listenerCount()).toBe(0)
  })

  it('sin matchMedia no falla y deja ambos en false', () => {
    const { isTouchDevice, isSmallScreen, wrapper } = mountWithComposable()
    expect(isTouchDevice.value).toBe(false)
    expect(isSmallScreen.value).toBe(false)
    wrapper.unmount()
  })
})
