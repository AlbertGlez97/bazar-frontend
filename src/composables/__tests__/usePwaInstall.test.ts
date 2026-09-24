import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { usePwaInstall } from '@/composables/usePwaInstall'

// jsdom no implementa matchMedia — mock necesario para el composable
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockReturnValue({ matches: false }),
})

// Componente envoltorio para usar el composable dentro de un contexto Vue
const TestComponent = defineComponent({
  setup() {
    return usePwaInstall()
  },
  template: '<div />',
})

// Fake BeforeInstallPromptEvent
function makeFakePromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt') as any
  event.preventDefault = vi.fn()
  event.platforms = ['web']
  event.userChoice = Promise.resolve({ outcome, platform: 'web' })
  event.prompt     = vi.fn().mockResolvedValue(undefined)
  return event
}

describe('usePwaInstall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Resetear estado global del composable entre tests
    // Disparar appinstalled para resetear el installEvent
    window.dispatchEvent(new Event('appinstalled'))
  })

  it('retorna las propiedades esperadas', () => {
    const wrapper = shallowMount(TestComponent)
    const vm = wrapper.vm as any
    expect(vm.canPrompt).toBeDefined()
    expect(vm.platform).toBeDefined()
    expect(vm.isInstalled).toBeDefined()
    expect(typeof vm.promptInstall).toBe('function')
  })

  it('detecta la plataforma como desktop en jsdom', () => {
    const wrapper = shallowMount(TestComponent)
    const vm = wrapper.vm as any
    // jsdom no tiene iOS/Android UA
    expect(['desktop', 'unknown']).toContain(vm.platform)
  })

  it('canPrompt es false inicialmente (sin evento)', () => {
    const wrapper = shallowMount(TestComponent)
    const vm = wrapper.vm as any
    expect(vm.canPrompt).toBe(false)
  })

  it('canPrompt es true después de disparar beforeinstallprompt', async () => {
    const wrapper = shallowMount(TestComponent)
    const fakeEvent = makeFakePromptEvent()
    window.dispatchEvent(fakeEvent)
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as any
    expect(vm.canPrompt).toBe(true)
  })

  it('promptInstall retorna "unsupported" si no hay installEvent', async () => {
    const wrapper = shallowMount(TestComponent)
    const vm = wrapper.vm as any
    const result = await vm.promptInstall()
    expect(result).toBe('unsupported')
  })

  it('promptInstall retorna el outcome del userChoice', async () => {
    const wrapper = shallowMount(TestComponent)
    const fakeEvent = makeFakePromptEvent('accepted')
    window.dispatchEvent(fakeEvent)
    await wrapper.vm.$nextTick()

    const vm = wrapper.vm as any
    const result = await vm.promptInstall()
    expect(result).toBe('accepted')
  })

  it('promptInstall resetea installEvent después de usarlo', async () => {
    const wrapper = shallowMount(TestComponent)
    const fakeEvent = makeFakePromptEvent('dismissed')
    window.dispatchEvent(fakeEvent)
    await wrapper.vm.$nextTick()

    const vm = wrapper.vm as any
    await vm.promptInstall()
    expect(vm.canPrompt).toBe(false)
  })
})
