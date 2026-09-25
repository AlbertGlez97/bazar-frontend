import { describe, it, expect } from 'vitest'
import { APP_NAME, APP_DESCRIPTION, THEME_COLOR, BACKGROUND_COLOR } from '@/config/app'
// `?raw` lee los archivos de build como texto sin depender de tipos de Node.
import indexHtml from '../../../index.html?raw'
import viteConfigSource from '../../../vite.config.ts?raw'

// index.html y vite.config.ts no pueden importar el módulo desde el bundle de
// la app; comparten el nombre a través de estos guardas para que no se
// dupliquen literales que se desincronicen de APP_NAME.
describe('APP_NAME / APP_DESCRIPTION', () => {
  it('son textos no vacíos', () => {
    expect(APP_NAME.trim()).not.toBe('')
    expect(APP_DESCRIPTION.trim()).not.toBe('')
  })

  it('index.html toma nombre y descripción de placeholders, no de literales', () => {
    expect(indexHtml).toContain('<title>%APP_NAME%</title>')
    expect(indexHtml).toContain('name="apple-mobile-web-app-title" content="%APP_NAME%"')
    expect(indexHtml).toContain('name="description" content="%APP_DESCRIPTION%"')
  })

  it('la marca es La Marchanta', () => {
    expect(APP_NAME).toBe('La Marchanta')
  })

  it('la descripción es honesta: sin promesas de cifrado ni de funciones que no existen', () => {
    expect(APP_DESCRIPTION).not.toMatch(/e2ee|cifrad|offline|sin internet|reportes/i)
  })

  it('index.html no conserva la marca anterior ni promesas falsas', () => {
    expect(indexHtml).not.toMatch(/finanzas|e2ee|cifrado|bazar/i)
  })

  it('index.html toma el color de marca de un placeholder, no de un literal', () => {
    expect(indexHtml).toContain('name="theme-color" content="%THEME_COLOR%"')
    expect(indexHtml).toContain('rel="mask-icon" href="/favicon.svg" color="%THEME_COLOR%"')
    expect(indexHtml).not.toMatch(/#[0-9a-f]{6}/i)
  })

  it('index.html carga solo dos familias de Google Fonts, con preconnect y display=swap', () => {
    expect(indexHtml).toContain('<link rel="preconnect" href="https://fonts.googleapis.com" />')
    expect(indexHtml).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />')
    const href = /fonts\.googleapis\.com\/css2\?([^"]+)"/.exec(indexHtml)?.[1] ?? ''
    expect(href).toContain('display=swap')
    expect(href.match(/family=/g)).toHaveLength(2)
    expect(href).toContain('family=Bricolage+Grotesque')
    expect(href).toContain('family=Figtree')
  })

  it('vite.config.ts sustituye los placeholders con las constantes', () => {
    expect(viteConfigSource).toContain("from './src/config/app'")
    expect(viteConfigSource).toContain("replaceAll('%APP_NAME%', APP_NAME)")
    expect(viteConfigSource).toContain("replaceAll('%APP_DESCRIPTION%', APP_DESCRIPTION)")
    expect(viteConfigSource).toContain("replaceAll('%THEME_COLOR%', THEME_COLOR)")
  })

  it('el manifest PWA toma theme_color y background_color de las constantes', () => {
    expect(viteConfigSource).toMatch(/\btheme_color:\s+THEME_COLOR\b/)
    expect(viteConfigSource).toMatch(/\bbackground_color:\s+BACKGROUND_COLOR\b/)
    expect(viteConfigSource).not.toMatch(/(theme|background)_color:\s+'#/)
  })

  it('las constantes de color son #rrggbb', () => {
    expect(THEME_COLOR).toMatch(/^#[0-9a-f]{6}$/i)
    expect(BACKGROUND_COLOR).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('el manifest PWA usa las constantes y no la marca anterior', () => {
    expect(viteConfigSource).toMatch(/\bname:\s+APP_NAME\b/)
    expect(viteConfigSource).toMatch(/\bshort_name:\s+APP_NAME\b/)
    expect(viteConfigSource).toMatch(/\bdescription:\s+APP_DESCRIPTION\b/)
    expect(viteConfigSource).not.toMatch(/finanzas|e2ee|cifrado|bazar/i)
  })
})
