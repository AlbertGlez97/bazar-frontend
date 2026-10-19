// Etiqueta 35 x 25 mm: nombre y presentación sin cambiar el QR ni la calibración.
import { describe, expect, it } from 'vitest'
import { DEFAULT_CALIBRATION, LABEL_MARGIN_MM, LABEL_WIDTH_MM, NAME_MAX_LINES, planLabelSheet, type LabelInput } from '../label-sheet-plan'

const ID = '01a0ddd7-7f00-744a-8b23-000000000001'
const oneMmPerChar = (text: string) => text.length
const plan = (item: Partial<LabelInput>, measure = oneMmPerChar) =>
  planLabelSheet([{ id: ID, name: 'Playera lisa', ...item }], DEFAULT_CALIBRATION, measure)

describe('etiqueta con presentación', () => {
  it('sin presentación todo queda como antes (nombre hasta 2 renglones)', () => {
    const label = plan({ name: 'Playera de algodón peinado extra suave' }).labels[0]
    expect(label.textLines.length).toBe(2)
  })

  it('con presentación: el nombre en 1 renglón y la presentación en el último', () => {
    const lines = plan({ presentation: 'Azul · 28' }).labels[0].textLines.map((l) => l.text)
    expect(lines).toEqual(['Playera lisa', 'Azul · 28'])
  })

  it('nunca pasa de los 2 renglones que el diseño reserva', () => {
    const label = plan({ name: 'Nombre larguísimo '.repeat(10), presentation: 'Presentación '.repeat(10) }).labels[0]
    expect(label.textLines.length).toBeLessThanOrEqual(NAME_MAX_LINES)
  })

  it('un nombre largo se corta con puntos suspensivos para dejar lugar a la presentación', () => {
    const lines = plan({ name: 'Nombre larguísimo '.repeat(5), presentation: 'XL' }).labels[0].textLines.map((l) => l.text)
    expect(lines[0].endsWith('...')).toBe(true)
    expect(lines[1]).toBe('XL')
  })

  it('el QR, la celda y la calibración no cambian con o sin presentación', () => {
    const without = plan({}).labels[0]
    const withIt = plan({ presentation: 'XL' }).labels[0]
    expect(withIt.qr).toEqual(without.qr)
    expect(withIt.cell).toEqual(without.cell)
    expect(plan({ presentation: 'XL' }).calibration).toEqual(DEFAULT_CALIBRATION)
  })

  it('todo el texto cabe dentro de la etiqueta de 35 x 25 mm', () => {
    const p = plan({ name: 'Nombre larguísimo '.repeat(10), presentation: 'Presentación '.repeat(10) })
    const label = p.labels[0]
    const bottom = label.textLines.at(-1)!.y + p.layout.linePitchMm
    expect(bottom).toBeLessThanOrEqual(label.cell.y + label.cell.h - LABEL_MARGIN_MM + 0.01)
    for (const line of label.textLines) expect(oneMmPerChar(line.text)).toBeLessThanOrEqual(LABEL_WIDTH_MM - 2 * LABEL_MARGIN_MM)
  })

  it('una presentación en blanco o nula se ignora', () => {
    expect(plan({ presentation: '   ' }).labels[0].textLines).toEqual(plan({}).labels[0].textLines)
    expect(plan({ presentation: null }).labels[0].textLines).toEqual(plan({}).labels[0].textLines)
  })
})
