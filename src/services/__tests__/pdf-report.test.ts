import { describe, expect, it } from 'vitest'
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
// `?raw` lee el CSS como texto: los colores del PDF se atan a los tokens tal como están escritos.
import mainCss from '../../assets/main.css?raw'
import { buildPdfDefinition, PDF_COLORS, PDF_COLOR_TOKENS } from '../pdf-report'
import { buildSalesReport } from '@/utils/sales-report'
import type { SalesReport } from '@/types/report.types'
import type { Sale } from '@/types/sale.types'

const FROM = '2026-09-24T06:00:00.000Z'
const TO = '2026-09-25T05:59:59.999Z'

function sale(id: string, memberId: string, receivedAt: string, totalMinor: number, cashMinor: number, quantities: number[]): Sale {
  return {
    id, memberId, deviceId: 'd-1', occurredAt: receivedAt, receivedAt, currency: 'MXN', status: 'completada',
    totalMinor, cashReceivedMinor: cashMinor, changeMinor: cashMinor - totalMinor, conflictReason: null, conflictDetectedAt: null,
    items: quantities.map((quantity, i) => ({ id: `${id}-${i}`, productId: `p${i}`, quantity, unitPriceMinor: 1, subtotalMinor: quantity, createdAt: receivedAt })),
  }
}

function makeReport(overrides: { sales?: Sale[]; period?: { from: string; to: string }; truncated?: boolean; forceMismatch?: boolean } = {}): SalesReport {
  const sales = overrides.sales ?? [
    sale('s-2', 'm-carlos', '2026-09-24T20:05:00.000Z', 125000, 150000, [2, 1]),
    sale('s-1', 'm-ana', '2026-09-24T18:00:00.000Z', 5050, 10000, [1]),
  ]
  const total = sales.reduce((sum, s) => sum + (s.totalMinor ?? 0), 0)
  const range = overrides.period ?? { from: FROM, to: TO }
  return buildSalesReport({
    period: { ...range, totalSoldMinor: overrides.forceMismatch ? total + 100 : total, saleCount: sales.length },
    byMember: {
      ...range,
      items: [
        { memberId: 'm-ana', memberName: 'Ana', role: 'socio', totalSoldMinor: 0 },
        { memberId: 'm-carlos', memberName: 'Carlos Núñez', role: 'colaborador', totalSoldMinor: 0 },
      ],
    },
    sales,
    businessName: 'La Marchanta',
    generatedAt: '2026-09-25T04:00:00.000Z', // 24/09/2026 22:00 en hora de negocio
    truncated: overrides.truncated,
  })
}

// ── Utilidades para leer la definición ───────────────────────────────────
type Node = Record<string, unknown>

function walk(node: unknown, visit: (n: Node) => void) {
  if (Array.isArray(node)) { node.forEach((n) => walk(n, visit)); return }
  if (node && typeof node === 'object') {
    visit(node as Node)
    Object.values(node as Node).forEach((child) => walk(child, visit))
  }
}

function texts(node: unknown): string[] {
  const out: string[] = []
  const collect = (value: unknown) => {
    if (typeof value === 'string') out.push(value)
    else walk(value, (n) => { if (typeof n.text === 'string') out.push(n.text) })
  }
  collect(node)
  walk(node, (n) => { if (Array.isArray(n.text)) n.text.forEach(collect) })
  return out
}

function tables(def: TDocumentDefinitions): Array<{ body: Content[][]; widths?: unknown; node: Node }> {
  const found: Array<{ body: Content[][]; widths?: unknown; node: Node }> = []
  walk(def.content, (n) => {
    const table = n.table as { body?: Content[][]; widths?: unknown } | undefined
    if (table?.body) found.push({ body: table.body, widths: table.widths, node: n })
  })
  return found
}

const rowTexts = (row: Content[]) => row.map((cell) => texts(cell).join(''))
const findTable = (def: TDocumentDefinitions, firstHeader: string) =>
  tables(def).find((t) => rowTexts(t.body[0])[0] === firstHeader)!

describe('buildPdfDefinition — document', () => {
  it('is an A4 portrait document with the bundled Roboto font (works offline)', () => {
    const def = buildPdfDefinition(makeReport())
    expect(def.pageSize).toBe('A4')
    expect(def.pageOrientation).toBe('portrait')
    expect(def.defaultStyle?.font).toBe('Roboto')
    expect(def.info?.title).toBe('Ventas del 24/09/2026 - La Marchanta')
  })

  it('prints business name, the range and the generation date in the header', () => {
    const all = texts(buildPdfDefinition(makeReport()).content)
    expect(all).toContain('La Marchanta')
    expect(all).toContain('Ventas del 24/09/2026')
    expect(all).toContain('Generado el 24/09/2026 22:00')
  })

  it('says "del ... al ..." for a multi-day range', () => {
    const report = makeReport({ period: { from: '2026-09-20T06:00:00.000Z', to: '2026-09-27T05:59:59.999Z' } })
    expect(texts(buildPdfDefinition(report).content)).toContain('Ventas del 20/09/2026 al 26/09/2026')
  })

  it('puts page numbers in the footer ("Página 1 de 3")', () => {
    const def = buildPdfDefinition(makeReport())
    expect(typeof def.footer).toBe('function')
    const footer = (def.footer as (page: number, pages: number) => Content)(1, 3)
    expect(texts(footer).join(' ')).toContain('Página 1 de 3')
  })

  it('uses only the documented palette', () => {
    const json = JSON.stringify(buildPdfDefinition(makeReport()))
    const used = new Set(json.match(/#[0-9a-fA-F]{6}/g)?.map((c) => c.toLowerCase()))
    const palette = new Set(Object.values(PDF_COLORS).map((c) => c.toLowerCase()))
    for (const color of used) expect(palette.has(color), `${color} is not in PDF_COLORS`).toBe(true)
  })
})

describe('buildPdfDefinition — sales table', () => {
  const def = buildPdfDefinition(makeReport())
  const table = findTable(def, 'Fecha')

  it('has the columns Fecha / Persona / Artículos / Total / Efectivo / Cambio and repeats the header row per page', () => {
    expect(rowTexts(table.body[0])).toEqual(['Fecha', 'Persona', 'Artículos', 'Total', 'Efectivo', 'Cambio'])
    expect((table.node.table as { headerRows?: number }).headerRows).toBe(1)
  })

  it('lists sales oldest first with business-time dates and formatted amounts', () => {
    expect(rowTexts(table.body[1])).toEqual(['24/09/2026 12:00', 'Ana', '1', '$50.50', '$100.00', '$49.50'])
    expect(rowTexts(table.body[2])).toEqual(['24/09/2026 14:05', 'Carlos Núñez', '3', '$1,250.00', '$1,500.00', '$250.00'])
  })

  it('ends with a totals row summed from the rows', () => {
    const last = rowTexts(table.body[table.body.length - 1])
    expect(last).toEqual(['Total', '2 ventas', '4', '$1,300.50', '$1,600.00', '$299.50'])
    expect(table.body).toHaveLength(1 + 2 + 1)
  })

  it('right-aligns the numeric columns', () => {
    const cell = table.body[1][3] as unknown as Node
    expect(cell.alignment).toBe('right')
  })

  it('singular "1 venta" in the totals row', () => {
    const one = buildPdfDefinition(makeReport({ sales: [sale('s-1', 'm-ana', '2026-09-24T18:00:00.000Z', 1000, 1000, [1])] }))
    const totals = rowTexts(findTable(one, 'Fecha').body.at(-1)!)
    expect(totals[1]).toBe('1 venta')
  })
})

describe('buildPdfDefinition — per person and final total', () => {
  const def = buildPdfDefinition(makeReport())

  it('has a per-person table sorted by total with role and share', () => {
    const table = findTable(def, 'Persona')
    expect(rowTexts(table.body[0])).toEqual(['Persona', 'Rol', 'Ventas', 'Total vendido', '% del total'])
    expect(rowTexts(table.body[1])).toEqual(['Carlos Núñez', 'Colaborador', '1', '$1,250.00', '96.1 %'])
    expect(rowTexts(table.body[2])).toEqual(['Ana', 'Socio', '1', '$50.50', '3.9 %'])
  })

  it('ends with the total sold, big, after the tables', () => {
    // Lo último del documento es la cifra final, después de las dos tablas.
    expect(texts(def.content).slice(-3)).toEqual(['Total vendido', '$1,300.50', '2 ventas · 4 artículos'])
  })
})

describe('buildPdfDefinition — notes and edge cases', () => {
  it('does not crash on an empty report: says there are no sales and still prints $0.00', () => {
    const def = buildPdfDefinition(makeReport({ sales: [] }))
    const all = texts(def.content)
    expect(all).toContain('Todavía no hay ventas en este periodo.')
    expect(tables(def).some((t) => rowTexts(t.body[0])[0] === 'Fecha')).toBe(false)
    expect(all).toContain('$0.00')
  })

  it('adds the truncated warning only when the detail was cut', () => {
    const cut = texts(buildPdfDefinition(makeReport({ truncated: true })).content).join(' ')
    const whole = texts(buildPdfDefinition(makeReport()).content).join(' ')
    expect(cut).toContain('límite de ventas')
    expect(whole).not.toContain('límite de ventas')
  })

  it('adds the consistency note only when detail and report disagree', () => {
    const mismatch = texts(buildPdfDefinition(makeReport({ forceMismatch: true })).content).join(' ')
    const ok = texts(buildPdfDefinition(makeReport()).content).join(' ')
    expect(mismatch).toContain('no coincide con el reporte del periodo')
    expect(mismatch).toContain('$1,301.50') // lo que dijo el reporte
    expect(ok).not.toContain('no coincide')
  })

  it('keeps accents and the peso sign as real characters', () => {
    const all = texts(buildPdfDefinition(makeReport()).content).join(' ')
    expect(all).toContain('Núñez')
    expect(all).toContain('Artículos')
    expect(all).toContain('$1,250.00')
  })

  it('names without a match print "Sin nombre"', () => {
    const def = buildPdfDefinition(makeReport({ sales: [sale('s-9', 'm-ghost', '2026-09-24T18:00:00.000Z', 100, 100, [1])] }))
    expect(rowTexts(findTable(def, 'Fecha').body[1])[1]).toBe('Sin nombre')
  })
})

describe('PDF palette', () => {
  const tokens = new Map<string, string>()
  const rootBlocks = [...mainCss.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]).join('\n')
  for (const m of rootBlocks.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens.set(m[1], m[2].trim())

  function resolve(name: string): string {
    const raw = tokens.get(name)
    if (raw === undefined) throw new Error(`Token ${name} is not defined in main.css`)
    const ref = /^var\((--[\w-]+)\)$/.exec(raw)
    return (ref ? resolve(ref[1]) : raw).toLowerCase()
  }

  it.each(Object.entries(PDF_COLOR_TOKENS))('%s equals the value of %s in main.css', (key, token) => {
    expect(PDF_COLORS[key as keyof typeof PDF_COLORS].toLowerCase()).toBe(resolve(token))
  })

  it('every palette color has a documented token', () => {
    expect(Object.keys(PDF_COLORS).sort()).toEqual(Object.keys(PDF_COLOR_TOKENS).sort())
  })
})
