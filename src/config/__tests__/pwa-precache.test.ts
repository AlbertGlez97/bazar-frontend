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
