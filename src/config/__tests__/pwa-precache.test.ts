import { describe, it, expect } from 'vitest'
import viteConfig from '../../../vite.config.ts?raw'

// El lector de QR necesita su .wasm para funcionar SIN internet: si el service
// worker no lo precachea, la cámara abriría pero no leería nada offline.
describe('precaché del service worker', () => {
  const patterns = /globPatterns:\s*\[\s*'([^']+)'/.exec(viteConfig)?.[1] ?? ''

  it('el patrón de precaché incluye los .wasm del lector de QR', () => {
    expect(patterns).toMatch(/\bwasm\b/)
  })

  it('sigue precacheando js, css y html', () => {
    for (const ext of ['js', 'css', 'html']) expect(patterns).toContain(ext)
  })
})

// pdfmake, sus fuentes y exceljs suman ~2.8 MB: solo los usan los socios en Modo
// Gestión y con internet, así que NO se precachean (cada instalación de la app
// los bajaría de balde). Se cachean la primera vez que se usan.
describe('librerías de exportación fuera del precaché', () => {
  const ignores = /globIgnores:\s*\[([^\]]*)\]/.exec(viteConfig)?.[1] ?? ''

  it.each(['pdfmake', 'vfs_fonts', 'exceljs'])('%s no se precachea', (name) => {
    expect(ignores).toContain(`assets/${name}`)
  })

  it('se cachean en runtime al usarse por primera vez (CacheFirst; los archivos llevan hash)', () => {
    expect(viteConfig).toMatch(/cacheName:\s*'export-libs'/)
  })

  it('los nombres de los chunks siguen a los módulos que se cargan por import() dinámico', async () => {
    const { default: pdfSource } = await import('../../services/pdf-report.ts?raw')
    const { default: excelSource } = await import('../../services/excel-report.ts?raw')
    expect(pdfSource).toContain("import('pdfmake/build/pdfmake')")
    expect(pdfSource).toContain("import('pdfmake/build/vfs_fonts')")
    expect(excelSource).toContain("import('exceljs')")
  })
})
