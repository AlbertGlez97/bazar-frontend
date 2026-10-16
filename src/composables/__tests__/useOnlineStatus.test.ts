import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useOnlineStatus } from '../useOnlineStatus'

afterEach(() => vi.restoreAllMocks())

function mountWithComposable() {
  let result!: ReturnType<typeof useOnlineStatus>
  const wrapper = mount(defineComponent({
    setup() {
      result = useOnlineStatus()
      return () => null
    },
  }))
  return { wrapper, online: result }
}

describe('useOnlineStatus', () => {
  it('arranca con lo que dice el navegador', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { wrapper, online } = mountWithComposable()

    expect(online.value).toBe(false)
    wrapper.unmount()
  })

  it('sigue los eventos online y offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const { wrapper, online } = mountWithComposable()

    window.dispatchEvent(new Event('offline'))
    await nextTick()
    expect(online.value).toBe(false)

    window.dispatchEvent(new Event('online'))
    await nextTick()
    expect(online.value).toBe(true)
    wrapper.unmount()
  })

  it('deja de escuchar al desmontar', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const { wrapper, online } = mountWithComposable()
    wrapper.unmount()

    window.dispatchEvent(new Event('offline'))
    await nextTick()

    expect(online.value).toBe(true)
  })
})
