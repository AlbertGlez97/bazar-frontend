import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PwaUpdatePrompt from '../PwaUpdatePrompt.vue'
import { usePwaUpdateStore } from '@/stores/pwaUpdate.store'

afterEach(() => document.body.replaceChildren())

describe('explicit PWA update', () => {
  it('stays available until the user activates the supported updater', async () => {
    const store = usePwaUpdateStore()
    const update = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(PwaUpdatePrompt)
    expect(wrapper.find('button').exists()).toBe(false)
    store.notifyUpdate(update)
    await flushPromises()
    expect(update).not.toHaveBeenCalled()
    expect(wrapper.get('button').text()).toBe('Actualizar ahora')
    expect(wrapper.get('button').element.tagName).toBe('BUTTON')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(update).toHaveBeenCalledExactlyOnceWith(true)
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await store.update()
    expect(update).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('keeps a failed update actionable and reports the failure', async () => {
    const store = usePwaUpdateStore()
    const update = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
    store.notifyUpdate(update)
    const wrapper = mount(PwaUpdatePrompt)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudo actualizar')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(update).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
})
