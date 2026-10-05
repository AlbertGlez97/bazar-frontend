import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import AppModal from '../AppModal.vue'

afterEach(() => document.body.replaceChildren())

describe('opt-in modal focus', () => {
  it('focuses the form, contains both Tab directions and restores the trigger', async () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const wrapper = mount(AppModal, {
      attachTo: document.body,
      props: { modelValue: false, title: 'Correction', manageFocus: true },
      slots: { default: '<textarea aria-label="Reason"></textarea>' },
    })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    const dialog = document.querySelector('[role="dialog"]')!
    const reason = dialog.querySelector('textarea')!
    expect(document.activeElement).toBe(reason)
    const buttons = [...dialog.querySelectorAll('button')]
    const first = buttons[0]!, last = buttons.at(-1)!
    last.focus()
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    last.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(last)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
    await wrapper.setProps({ modelValue: false })
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
  })

  it('restores focus on Cancel and on unmount without affecting opt-out modals', async () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const wrapper = mount(AppModal, {
      attachTo: document.body,
      props: { modelValue: false, title: 'Correction', manageFocus: true },
    })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    const buttons = document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')
    expect(document.activeElement).toBe(buttons[0])
    buttons[1]!.click()
    await wrapper.setProps({ modelValue: false })
    expect(document.activeElement).toBe(trigger)
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    wrapper.unmount()
    expect(document.activeElement).toBe(trigger)
    const legacy = mount(AppModal, { attachTo: document.body, props: { modelValue: true, title: 'Existing modal' } })
    expect(document.activeElement).toBe(trigger)
    legacy.unmount()
  })
})
