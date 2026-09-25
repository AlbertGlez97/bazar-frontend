import { describe, it, expect } from 'vitest'
import { THEME_COLOR, BACKGROUND_COLOR } from '@/config/app'
// `?raw` lee el CSS como texto: los tokens se validan tal como están escritos.
import mainCss from '../../assets/main.css?raw'

// ── Lectura de tokens ────────────────────────────────────────────────────
// Acepta `--token: #hex;` y `--token: var(--otro);` (los semánticos apuntan a
// la escala cruda). Los valores rgba()/color-mix() no se leen: no son pares
// texto/fondo.
const rootBlocks = [...mainCss.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]).join('\n')
const tokens = new Map<string, string>()
for (const m of rootBlocks.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
  tokens.set(m[1], m[2].trim())
}

function resolve(name: string, seen: string[] = []): string {
  const raw = tokens.get(name)
  if (raw === undefined) throw new Error(`Token ${name} is not defined in main.css`)
  const ref = /^var\((--[\w-]+)\)$/.exec(raw)
  if (ref) {
    if (seen.includes(ref[1])) throw new Error(`Circular token reference: ${[...seen, name, ref[1]].join(' -> ')}`)
    return resolve(ref[1], [...seen, name])
  }
  if (!/^#[0-9a-f]{6}$/i.test(raw)) throw new Error(`Token ${name} is not a #rrggbb color: ${raw}`)
  return raw.toLowerCase()
}

// ── WCAG 2.x ─────────────────────────────────────────────────────────────
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// ── Pares documentados (doc/brand-guidelines.md) ─────────────────────────
// Única tabla de pares: si se añade un par a la guía, se añade aquí.
// AA: 4.5 para texto normal, 3 para texto grande y componentes de UI.
const AA_TEXT = 4.5
const AA_UI = 3

const pairs: Array<[fg: string, bg: string, min: number]> = [
  // Texto sobre fondos neutros
  ['--color-text', '--color-bg', AA_TEXT],
  ['--color-text', '--color-surface', AA_TEXT],
  ['--color-text', '--color-surface-alt', AA_TEXT],
  ['--color-text-muted', '--color-bg', AA_TEXT],
  ['--color-text-muted', '--color-surface', AA_TEXT],
  ['--color-text-muted', '--color-surface-alt', AA_TEXT],
  ['--color-text-subtle', '--color-bg', AA_TEXT],
  ['--color-text-subtle', '--color-surface', AA_TEXT],
  // Marca
  ['--color-on-primary', '--color-primary', AA_TEXT],
  ['--color-on-primary', '--color-primary-hover', AA_TEXT],
  ['--color-primary', '--color-surface', AA_TEXT],
  ['--color-primary', '--color-bg', AA_TEXT],
  ['--color-primary-hover', '--color-primary-soft', AA_TEXT],
  ['--color-on-accent', '--color-accent', AA_TEXT],
  ['--color-text', '--color-accent-soft', AA_TEXT],
  // Estados
  ['--color-success', '--color-success-soft', AA_TEXT],
  ['--color-on-primary', '--color-success', AA_TEXT],
  ['--color-danger', '--color-danger-soft', AA_TEXT],
  ['--color-danger', '--color-surface', AA_TEXT],
  ['--color-on-primary', '--color-danger', AA_TEXT],
  ['--color-warning', '--color-warning-soft', AA_TEXT],
  ['--color-info', '--color-info-soft', AA_TEXT],
  ['--color-on-primary', '--color-info', AA_TEXT],
  // Detalle decorativo y avatares (texto blanco encima)
  ['--color-rosa', '--color-surface', AA_UI],
  ['--color-on-primary', '--color-avatar-1', AA_TEXT],
  ['--color-on-primary', '--color-avatar-2', AA_TEXT],
  ['--color-on-primary', '--color-avatar-3', AA_TEXT],
  ['--color-on-primary', '--color-avatar-4', AA_TEXT],
  ['--color-on-primary', '--color-avatar-5', AA_TEXT],
  ['--color-on-primary', '--color-avatar-6', AA_TEXT],
  // Barra lateral
  ['--color-sidebar-text', '--color-sidebar-bg', AA_TEXT],
  ['--color-sidebar-active', '--color-sidebar-bg', AA_TEXT],
  // Componentes de UI (no texto): 3:1
  ['--color-border-strong', '--color-surface', AA_UI],
  ['--color-border-strong', '--color-bg', AA_UI],
  ['--color-focus-ring', '--color-bg', AA_UI],
  ['--color-focus-ring', '--color-surface', AA_UI],
  ['--color-primary', '--color-sidebar-bg', AA_UI],
]

describe('brand tokens: contraste WCAG AA', () => {
  it.each(pairs)('%s sobre %s llega a %s:1', (fg, bg, min) => {
    const ratio = contrastRatio(resolve(fg), resolve(bg))
    expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min)
  })

  it('todo token del par existe y es un #rrggbb', () => {
    for (const [fg, bg] of pairs) {
      expect(() => resolve(fg)).not.toThrow()
      expect(() => resolve(bg)).not.toThrow()
    }
  })
})

describe('brand tokens: una sola fuente para el color de marca', () => {
  it('THEME_COLOR (manifest y <meta theme-color>) es --color-primary', () => {
    expect(THEME_COLOR.toLowerCase()).toBe(resolve('--color-primary'))
  })

  it('BACKGROUND_COLOR (splash del manifest) es --color-bg', () => {
    expect(BACKGROUND_COLOR.toLowerCase()).toBe(resolve('--color-bg'))
  })

  it('define las dos familias tipográficas con fallbacks del sistema', () => {
    expect(tokens.get('--font-display')).toMatch(/^'Bricolage Grotesque',.*sans-serif$/)
    expect(tokens.get('--font-body')).toMatch(/^'Figtree',.*sans-serif$/)
  })
})
