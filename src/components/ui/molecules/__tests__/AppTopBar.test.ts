import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppTopBar from '../AppTopBar.vue'
import source from '../AppTopBar.vue?raw'

const mountBar = (props: Record<string, unknown> = {}) =>
  mount(AppTopBar, { props: { title: 'Vender', ...props } })

describe('AppTopBar', () => {
  it('muestra el título de la pantalla', () => {
    expect(mountBar().get('.app-top-bar__title').text()).toBe('Vender')
  })

  it('el botón Ayuda lleva texto (no solo un ícono) y avisa al tocarlo', async () => {
    const wrapper = mountBar()
    const help = wrapper.get('.app-top-bar__help')

    expect(help.text()).toContain('Ayuda')
    await help.trigger('click')
    expect(wrapper.emitted('help')).toHaveLength(1)
  })

  it('el botón Ayuda declara que abre un diálogo y si está abierto', () => {
    const closed = mountBar().get('.app-top-bar__help')
    const open = mountBar({ helpOpen: true }).get('.app-top-bar__help')

    expect(closed.attributes('aria-haspopup')).toBe('dialog')
    expect(closed.attributes('aria-expanded')).toBe('false')
    expect(open.attributes('aria-expanded')).toBe('true')
  })

  it('sin showHelp no hay botón Ayuda (la propia pantalla de ayuda)', () => {
    expect(mountBar({ showHelp: false }).find('.app-top-bar__help').exists()).toBe(false)
  })

  it('socio: botón de menú a la izquierda con aria-expanded y nombre accesible', async () => {
    const wrapper = mountBar({ showMenu: true })
    const menu = wrapper.get('.app-top-bar__menu')

    expect(menu.attributes('aria-label')).toBe('Menú')
    expect(menu.attributes('aria-haspopup')).toBe('dialog')
    expect(menu.attributes('aria-expanded')).toBe('false')
    await menu.trigger('click')
    expect(wrapper.emitted('menu')).toHaveLength(1)
    expect(mountBar({ showMenu: true, menuOpen: true }).get('.app-top-bar__menu').attributes('aria-expanded')).toBe('true')
  })

  it('el menú va antes que el título (izquierda) y Ayuda después', () => {
    const html = mountBar({ showMenu: true, showLogout: true }).html()

    expect(html.indexOf('app-top-bar__menu')).toBeLessThan(html.indexOf('app-top-bar__title'))
    expect(html.indexOf('app-top-bar__title')).toBeLessThan(html.indexOf('app-top-bar__help'))
  })

  it('colaborador: sin menú; con "Salir" visible que emite logout', async () => {
    const wrapper = mountBar({ showMenu: false, showLogout: true })

    expect(wrapper.find('.app-top-bar__menu').exists()).toBe(false)
    const logout = wrapper.get('.app-top-bar__logout')
    expect(logout.text()).toContain('Salir')
    await logout.trigger('click')
    expect(wrapper.emitted('logout')).toHaveLength(1)
  })

  it('sin showLogout no hay botón Salir', () => {
    expect(mountBar().find('.app-top-bar__logout').exists()).toBe(false)
  })

  it('es el encabezado de la página y todos sus botones tienen nombre accesible', () => {
    const wrapper = mountBar({ showMenu: true, showLogout: true })

    expect(wrapper.find('header.app-top-bar').exists()).toBe(true)
    for (const button of wrapper.findAll('button')) {
      expect((button.attributes('aria-label') ?? button.text()).length).toBeGreaterThan(0)
    }
  })

  describe('contrato de CSS', () => {
    const style = source.slice(source.indexOf('<style')).replace(/<style[^>]*>/, '')
    // Reglas agrupadas ("a, b { ... }") cuentan para cada uno de sus selectores.
    const rule = (selector: string) =>
      [...style.matchAll(/([^{}]+)\{([^}]*)\}/g)]
        .filter(([, selectors]) => selectors!.split(',').map((part) => part.trim()).includes(selector))
        .map(([, , body]) => body)
        .join(';')
    const rem = (body: string, property: string) => Number(body.match(new RegExp(`${property}:\\s*([\\d.]+)rem`))?.[1] ?? 0)

    it('cada botón mide al menos 44 px (2.75rem) de alto y de ancho', () => {
      for (const selector of ['.app-top-bar__menu', '.app-top-bar__help', '.app-top-bar__logout']) {
        const body = rule(selector)
        expect(rem(body, 'min-height'), `${selector} min-height`).toBeGreaterThanOrEqual(2.75)
        expect(rem(body, 'min-width'), `${selector} min-width`).toBeGreaterThanOrEqual(2.75)
      }
    })

    it('el título se recorta con puntos suspensivos en vez de empujar los botones', () => {
      const title = rule('.app-top-bar__title')
      expect(title).toMatch(/text-overflow:\s*ellipsis/)
      expect(title).toMatch(/min-width:\s*0/)
    })

    it('la barra se queda arriba al desplazarse', () => {
      expect(rule('.app-top-bar')).toMatch(/position:\s*sticky/)
    })
  })
})
