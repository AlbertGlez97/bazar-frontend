import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppAccordion from '../AppAccordion.vue'

const items = [
  { id: 'one', title: 'Primero' },
  { id: 'two', title: 'Segundo' },
  { id: 'three', title: 'Tercero' },
]

function mountAccordion(props: Record<string, unknown> = {}) {
  return mount(AppAccordion, {
    props: { items, idPrefix: 'acc', ...props },
    slots: { panel: '<template #panel="{ item }"><p class="body">Contenido {{ item.title }}</p></template>' },
    attachTo: document.body,
  })
}
const trigger = (wrapper: ReturnType<typeof mountAccordion>, id: string) => wrapper.get(`[data-item-id="${id}"]`)

describe('AppAccordion', () => {
  it('renders one native button per item inside a heading, wired to a labelled region', () => {
    const wrapper = mountAccordion({ defaultOpen: 'one' })
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(3)
    buttons.forEach((button) => expect(button.element.closest('h3')).not.toBeNull())
    const first = trigger(wrapper, 'one')
    expect(first.attributes('aria-expanded')).toBe('true')
    expect(first.attributes('aria-controls')).toBe('acc-panel-one')
    const region = wrapper.get('#acc-panel-one')
    expect(region.attributes('role')).toBe('region')
    expect(region.attributes('aria-labelledby')).toBe(first.attributes('id'))
    expect(trigger(wrapper, 'two').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('opens one item at a time (uncontrolled) and closes the open one when toggled again', async () => {
    const wrapper = mountAccordion({ defaultOpen: 'one' })
    await trigger(wrapper, 'two').trigger('click')
    expect(trigger(wrapper, 'two').attributes('aria-expanded')).toBe('true')
    expect(trigger(wrapper, 'one').attributes('aria-expanded')).toBe('false')
    await trigger(wrapper, 'two').trigger('click')
    expect(wrapper.findAll('[aria-expanded="true"]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('hides closed panels from assistive technology and the tab order', () => {
    const wrapper = mountAccordion({ defaultOpen: 'one' })
    expect(wrapper.get('#acc-panel-one').attributes('inert')).toBeUndefined()
    expect(wrapper.get('#acc-panel-two').attributes('inert')).toBeDefined()
    wrapper.unmount()
  })

  it('is controlled through v-model and only emits when the user toggles', async () => {
    const wrapper = mountAccordion({ modelValue: 'two' })
    expect(trigger(wrapper, 'two').attributes('aria-expanded')).toBe('true')
    await trigger(wrapper, 'three').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['three']])
    // Still controlled: the parent did not accept the change.
    expect(trigger(wrapper, 'two').attributes('aria-expanded')).toBe('true')
    await wrapper.setProps({ modelValue: 'three' })
    expect(trigger(wrapper, 'three').attributes('aria-expanded')).toBe('true')
    await trigger(wrapper, 'three').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
    wrapper.unmount()
  })

  it('follows a controlled value of null as "everything closed"', () => {
    const wrapper = mountAccordion({ modelValue: null })
    expect(wrapper.findAll('[aria-expanded="true"]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('moves focus between triggers with Arrow keys, Home and End', async () => {
    const wrapper = mountAccordion()
    const buttons = wrapper.findAll('button')
    buttons[0]!.element.focus()
    await buttons[0]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(buttons[1]!.element)
    await buttons[1]!.trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(buttons[2]!.element)
    await buttons[2]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(buttons[0]!.element)
    await buttons[0]!.trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(buttons[2]!.element)
    await buttons[2]!.trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(buttons[0]!.element)
    wrapper.unmount()
  })

  it('uses native buttons, so Enter and Space are activation keys by default', () => {
    const wrapper = mountAccordion()
    wrapper.findAll('button').forEach((button) => expect(button.attributes('type')).toBe('button'))
    wrapper.unmount()
  })

  it('renders the panel slot for every item and a custom title slot', () => {
    const wrapper = mount(AppAccordion, {
      props: { items, idPrefix: 'acc', defaultOpen: 'one' },
      slots: {
        title: '<template #title="{ item }"><em class="custom">{{ item.title }}!</em></template>',
        panel: '<template #panel="{ item }"><p class="body">Contenido {{ item.id }}</p></template>',
      },
    })
    expect(wrapper.findAll('.custom')).toHaveLength(3)
    expect(wrapper.findAll('.body')).toHaveLength(3)
    wrapper.unmount()
  })

  it('declares its motion with tokens and a reduced-motion override', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync('src/components/ui/molecules/AppAccordion.vue', 'utf8')
    expect(source).toMatch(/grid-template-rows:\s*0fr/)
    expect(source).toMatch(/grid-template-rows:\s*1fr/)
    expect(source).toMatch(/var\(--motion-/)
    expect(source).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })
})
