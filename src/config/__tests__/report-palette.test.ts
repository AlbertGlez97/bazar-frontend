import { describe, expect, it } from 'vitest'
// `?raw` lee el CSS como texto: los colores de los archivos se atan a los tokens tal como están escritos.
import mainCss from '../../assets/main.css?raw'
import { REPORT_COLORS, REPORT_COLOR_TOKENS, toArgb, type ReportColor } from '../report-palette'

const tokens = new Map<string, string>()
const rootBlocks = [...mainCss.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]).join('\n')
for (const m of rootBlocks.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens.set(m[1], m[2].trim())

function resolve(name: string): string {
  const raw = tokens.get(name)
  if (raw === undefined) throw new Error(`Token ${name} is not defined in main.css`)
  const ref = /^var\((--[\w-]+)\)$/.exec(raw)
  return (ref ? resolve(ref[1]) : raw).toLowerCase()
}

describe('report palette (PDF and Excel)', () => {
  it.each(Object.entries(REPORT_COLOR_TOKENS))('%s equals the value of %s in main.css', (key, token) => {
    expect(REPORT_COLORS[key as ReportColor].toLowerCase()).toBe(resolve(token))
  })

  it('every palette color has a documented token, and vice versa', () => {
    expect(Object.keys(REPORT_COLORS).sort()).toEqual(Object.keys(REPORT_COLOR_TOKENS).sort())
  })

  it('toArgb makes an opaque uppercase ARGB string for ExcelJS', () => {
    expect(toArgb('#b8501c')).toBe('FFB8501C')
    expect(toArgb('#ffffff')).toBe('FFFFFFFF')
  })
})
