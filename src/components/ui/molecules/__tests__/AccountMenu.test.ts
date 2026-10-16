import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import AccountMenu from '../AccountMenu.vue'
import source from '../AccountMenu.vue?raw'

// "Mi cuenta" de la barra superior del colaborador en celular: un panel pequeño
// con "Cambiar contraseña" y "Cerrar sesión". Presentacional: avisa lo que se
// toca; quien lo usa navega o cierra la sesión.

afterEach(() => {
  document.body.innerHTML = ''
})

function mountMenu(props: Record<string, unknown> = {}) {
  return mount(AccountMenu, { attachTo: document.body, props: { online: true, ...props } })
}

const trigger = (w: ReturnType<typeof mountMenu>) => w.get('.account-menu__trigger')
const panel = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
const action = (name: string) => document.body.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)

async function open(w: ReturnType<typeof mountMenu>) {
  await trigger(w).trigger('click')
  await nextTick()
}

describe('AccountMenu', () => {
  it('el botón dice "Mi cuenta" con texto y declara que abre un diálogo, cerrado al inicio', () => {
    const wrapper = mountMenu()

    expect(trigger(wrapper).text()).toContain('Mi cuenta')
    expect(trigger(wrapper).attributes('aria-haspopup')).toBe('dialog')
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('false')
    expect(panel()).toBeNull()
    wrapper.unmount()
  })

  it('al tocarlo abre el panel con "Cambiar contraseña" y "Cerrar sesión" y aria-expanded en true', async () => {
    const wrapper = mountMenu()
    await open(wrapper)

    expect(trigger(wrapper).attributes('aria-expanded')).toBe('true')
    expect(panel()).not.toBeNull()
    expect(action('change-password')!.textContent).toContain('Cambiar contraseña')
    expect(action('logout')!.textContent).toContain('Cerrar sesión')
    wrapper.unmount()
  })

  it('"Cambiar contraseña" avisa y cierra el panel', async () => {
    const wrapper = mountMenu()
    await open(wrapper)

    action('change-password')!.click()
    await nextTick()

    expect(wrapper.emitted('change-password')).toHaveLength(1)
    expect(panel()).toBeNull()
    wrapper.unmount()
  })

  it('"Cerrar sesión" avisa y cierra el panel', async () => {
    const wrapper = mountMenu()
    await open(wrapper)

    action('logout')!.click()
    await nextTick()

    expect(wrapper.emitted('logout')).toHaveLength(1)
    expect(panel()).toBeNull()
    wrapper.unmount()
  })

  it('sin conexión, "Cambiar contraseña" no avisa para navegar: dice con una frase corta que necesita internet', async () => {
    const wrapper = mountMenu({ online: false })
    await open(wrapper)

    action('change-password')!.click()
    await nextTick()

    expect(wrapper.emitted('change-password')).toBeUndefined()
    const notice = panel()!.querySelector('[role="status"]')
    expect(notice?.textContent).toBe('Necesitas internet para cambiar tu contraseña.')
    expect(panel()).not.toBeNull()
    wrapper.unmount()
  })

  it('sin conexión, "Cerrar sesión" sigue funcionando', async () => {
    const wrapper = mountMenu({ online: false })
    await open(wrapper)

    action('logout')!.click()

    expect(wrapper.emitted('logout')).toHaveLength(1)
    wrapper.unmount()
  })

  it('el aviso de internet no queda pegado: al volver a abrir el panel ya no está', async () => {
    const wrapper = mountMenu({ online: false })
    await open(wrapper)
    action('change-password')!.click()
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    await open(wrapper)

    expect(panel()!.querySelector('[role="status"]')).toBeNull()
    wrapper.unmount()
  })

  it('cierra con Escape y devuelve el foco al botón "Mi cuenta"', async () => {
    const wrapper = mountMenu()
    ;(trigger(wrapper).element as HTMLElement).focus()
    await open(wrapper)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    await nextTick()

    expect(panel()).toBeNull()
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger(wrapper).element)
    wrapper.unmount()
  })

  it('cierra con un clic fuera', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    const wrapper = mountMenu()
    await open(wrapper)

    outside.click()
    await nextTick()

    expect(panel()).toBeNull()
    wrapper.unmount()
  })

  it('atrapa el foco: Tab desde el último elemento vuelve al primero', async () => {
    const wrapper = mountMenu()
    await open(wrapper)
    const items = [...panel()!.querySelectorAll<HTMLElement>('button')]
    items.at(-1)!.focus()

    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))

    expect(document.activeElement).toBe(items[0])
    wrapper.unmount()
  })

  describe('contrato de CSS', () => {
    const style = source.slice(source.indexOf('<style')).replace(/<style[^>]*>/, '').replace(/\/\*[\s\S]*?\*\//g, '')
    const rule = (selector: string) =>
      [...style.matchAll(/([^{}]+)\{([^}]*)\}/g)]
        .filter(([, selectors]) => selectors!.split(',').map((part) => part.trim()).includes(selector))
        .map(([, , body]) => body)
        .join(';')
    const rem = (body: string, property: string) => Number(body.match(new RegExp(`${property}:\\s*([\\d.]+)rem`))?.[1] ?? 0)

    it('el botón "Mi cuenta" y cada acción del panel miden al menos 44 px (2.75rem) de alto', () => {
      expect(rem(rule('.account-menu__trigger'), 'min-height')).toBeGreaterThanOrEqual(2.75)
      expect(rem(rule('.account-menu__item'), 'min-height')).toBeGreaterThanOrEqual(2.75)
    })
  })
})
