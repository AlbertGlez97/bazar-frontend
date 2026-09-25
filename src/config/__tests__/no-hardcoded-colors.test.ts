import { describe, it, expect } from 'vitest'

// Guarda de identidad: los componentes y vistas usan tokens (var(--color-*)),
// nunca colores sueltos. Así un cambio de paleta se hace solo en main.css.
const sources = import.meta.glob<string>('../../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// #rgb / #rrggbb / #rrggbbaa, rgb()/rgba()/hsl()/hsla()
const HARD_CODED = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/g

describe('componentes sin colores fijos', () => {
  it('encuentra los componentes a revisar', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(30)
  })

  it.each(Object.entries(sources))('%s no fija colores', (path, source) => {
    const found = source.match(HARD_CODED) ?? []
    expect(found, `${path} hard-codes colors: ${found.join(', ')}`).toEqual([])
  })
})
