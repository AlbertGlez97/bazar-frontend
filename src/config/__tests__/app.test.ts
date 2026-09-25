import { describe, it, expect } from 'vitest'
import { APP_NAME, APP_DESCRIPTION } from '@/config/app'
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

  it('index.html no conserva la marca anterior ni promesas falsas', () => {
    expect(indexHtml).not.toMatch(/finanzas|e2ee|cifrado/i)
  })

  it('vite.config.ts sustituye los placeholders con las constantes', () => {
    expect(viteConfigSource).toContain("from './src/config/app'")
    expect(viteConfigSource).toContain("replaceAll('%APP_NAME%', APP_NAME)")
    expect(viteConfigSource).toContain("replaceAll('%APP_DESCRIPTION%', APP_DESCRIPTION)")
  })

  it('el manifest PWA usa las constantes y no la marca anterior', () => {
    expect(viteConfigSource).toMatch(/\bname:\s+APP_NAME\b/)
    expect(viteConfigSource).toMatch(/\bshort_name:\s+APP_NAME\b/)
    expect(viteConfigSource).toMatch(/\bdescription:\s+APP_DESCRIPTION\b/)
    expect(viteConfigSource).not.toMatch(/finanzas|e2ee|cifrado/i)
  })
})
