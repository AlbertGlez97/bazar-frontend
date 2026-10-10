import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import AppDrawer from '../AppDrawer.vue'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

/** A host with an opener button so focus return can be observed. */
function host(options: { returnFocus?: boolean } = {}) {
  const open = ref(false)
  const opener = ref<HTMLElement | null>(null)
  const Host = defineComponent({
    setup() {
      return () => h('div', [
        h('button', { id: 'opener', ref: opener, onClick: () => { open.value = true } }, 'Abrir'),
        h(AppDrawer, {
          modelValue: open.value,
          'onUpdate:modelValue': (value: boolean) => { open.value = value },
          title: 'Ayuda rápida',
          closeLabel: 'Cerrar ayuda',
          returnFocus: options.returnFocus ? opener.value : undefined,
        }, {
          default: () => [h('a', { href: '#a', id: 'first-link' }, 'Uno'), h('button', { id: 'last-button', type: 'button' }, 'Dos')],
          footer: () => h('a', { href: '#f', id: 'footer-link' }, 'Pie'),
        }),
      ])
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  return { wrapper, open }
}

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
const press = (key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  document.dispatchEvent(event)
  return event
}
async function openIt() {
  const result = host()
  const opener = document.getElementById('opener')!
  opener.focus()
  opener.click()
  await nextTick()
  await nextTick()
  return { ...result, opener }
}

describe('AppDrawer', () => {
  it('renders nothing while closed and a labelled modal dialog while open (teleported to body)', async () => {
    const { wrapper } = host()
    expect(dialog()).toBeNull()
    document.getElementById('opener')!.click()
    await nextTick()
    const el = dialog()!
    expect(el).not.toBeNull()
    expect(el.getAttribute('aria-modal')).toBe('true')
    const label = document.getElementById(el.getAttribute('aria-labelledby')!)
    expect(label?.textContent).toContain('Ayuda rápida')
    expect(wrapper.element.contains(el)).toBe(false)
    wrapper.unmount()
  })

  it('moves initial focus inside the drawer', async () => {
    const { wrapper } = await openIt()
    expect(dialog()!.contains(document.activeElement)).toBe(true)
    wrapper.unmount()
  })

  it('closes with Escape and returns focus to the opener', async () => {
    const { wrapper, open, opener } = await openIt()
    press('Escape')
    await nextTick()
    await nextTick()
    expect(open.value).toBe(false)
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(opener)
    wrapper.unmount()
  })

  it('closes from the close button and from the backdrop, never from a click inside', async () => {
    const { wrapper, open } = await openIt()
    dialog()!.click()
    await nextTick()
    expect(open.value).toBe(true)
    document.body.querySelector<HTMLElement>('.app-drawer__backdrop')!.click()
    await nextTick()
    expect(open.value).toBe(false)
    document.getElementById('opener')!.click()
    await nextTick()
    document.body.querySelector<HTMLButtonElement>('button[aria-label="Cerrar ayuda"]')!.click()
    await nextTick()
    expect(open.value).toBe(false)
    wrapper.unmount()
  })

  it('traps Tab and Shift+Tab inside the dialog', async () => {
    const { wrapper } = await openIt()
    const focusables = [...dialog()!.querySelectorAll<HTMLElement>('button, a[href]')]
    const first = focusables[0]!
    const last = focusables.at(-1)!
    last.focus()
    const forward = press('Tab')
    expect(forward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
    first.focus()
    const backward = press('Tab', { shiftKey: true })
    expect(backward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
    // In the middle the browser keeps its own order.
    focusables[1]!.focus()
    expect(press('Tab').defaultPrevented).toBe(false)
    wrapper.unmount()
  })

  it('pulls stray focus back in when Tab is pressed outside the dialog', async () => {
    const { wrapper } = await openIt()
    ;(document.activeElement as HTMLElement).blur()
    const event = press('Tab')
    expect(event.defaultPrevented).toBe(true)
    expect(dialog()!.contains(document.activeElement)).toBe(true)
    wrapper.unmount()
  })

  it('locks the body scroll while open and restores the previous value', async () => {
    document.body.style.overflow = 'scroll'
    const { wrapper } = await openIt()
    expect(document.body.style.overflow).toBe('hidden')
    press('Escape')
    await nextTick()
    expect(document.body.style.overflow).toBe('scroll')
    wrapper.unmount()
  })

  it('restores scroll and stops listening when unmounted while open', async () => {
    const { wrapper } = await openIt()
    wrapper.unmount()
    expect(document.body.style.overflow).toBe('')
    expect(press('Escape').defaultPrevented).toBe(false)
  })

  it('returns focus to an explicit element when the opener did not take focus (Safari)', async () => {
    const { wrapper, open } = host({ returnFocus: true })
    await nextTick()
    const opener = document.getElementById('opener')!
    // Nothing was focused when the drawer opened, as in browsers that do not focus buttons on click.
    ;(document.activeElement as HTMLElement | null)?.blur()
    expect(document.activeElement).toBe(document.body)
    open.value = true
    await nextTick()
    await nextTick()
    open.value = false
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(opener)
    wrapper.unmount()
  })

  it('declares slide and fade with tokens, a phone sheet and a reduced-motion override', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync('src/components/ui/organisms/AppDrawer.vue', 'utf8')
    expect(source).toMatch(/translateX\(/)
    expect(source).toMatch(/var\(--motion-slow\)/)
    expect(source).toMatch(/@media \(max-width: 767px\)/)
    expect(source).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })
})
