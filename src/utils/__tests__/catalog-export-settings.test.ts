import { describe, expect, it } from 'vitest'
import { APP_NAME } from '@/config/app'
import {
  BUSINESS_NAME_MAX,
  CATALOG_SETTINGS_VERSION,
  MAX_LOW_STOCK_THRESHOLD,
  cleanBusinessName,
  normalizeSettings,
  serializeSettings,
  suggestedSettings,
  toDataOptions,
  toDocOptions,
} from '../catalog-export-settings'

const wrap = (settings: unknown, version: unknown = CATALOG_SETTINGS_VERSION) => ({ version, settings })

describe('valores sugeridos', () => {
  it('son los pedidos: agrupar prendido, existencia exacta, 2 columnas, categoría en página nueva, fecha sí, índice no, foto Normal', () => {
    const s = suggestedSettings()
    expect(s).toMatchObject({
      businessName: APP_NAME, filter: { mode: 'all' }, groupVariants: true, stockMode: 'exact', lowStockThreshold: 3,
      columns: 2, pageBreakPerCategory: true, showDate: true, tableOfContents: false, photoQuality: 'normal',
    })
    expect(s.fields).toEqual({ photo: true, brand: true, presentation: true, description: true, price: true, stock: true })
  })

  it('cada llamada devuelve un objeto nuevo (nadie comparte estado)', () => {
    expect(suggestedSettings()).not.toBe(suggestedSettings())
    expect(suggestedSettings().fields).not.toBe(suggestedSettings().fields)
  })
})

describe('normalizeSettings', () => {
  it('conserva lo válido', () => {
    const custom = {
      ...suggestedSettings(), businessName: 'Bazar Lupe', filter: { mode: 'categories' as const, categories: ['Ropa'] }, groupVariants: false,
      stockMode: 'availability' as const, lowStockThreshold: 5, columns: 3 as const, photoQuality: 'high' as const, tableOfContents: true,
      fields: { photo: false, brand: true, presentation: false, description: true, price: true, stock: false },
    }
    expect(normalizeSettings(wrap(custom))).toEqual(custom)
  })

  it.each([
    ['sin versión', { settings: suggestedSettings() }],
    ['otra versión', wrap(suggestedSettings(), CATALOG_SETTINGS_VERSION + 1)],
    ['versión como texto', wrap(suggestedSettings(), '1')],
    ['null', null],
    ['un número', 42],
    ['un arreglo', []],
    ['sin settings', { version: CATALOG_SETTINGS_VERSION }],
    ['settings que no es objeto', wrap('x')],
  ])('%s -> todo sugerido', (_name, input) => {
    expect(normalizeSettings(input)).toEqual(suggestedSettings())
  })

  it('un campo inválido vuelve a su valor sugerido y el resto se conserva', () => {
    const result = normalizeSettings(wrap({
      businessName: 42, filter: { mode: 'raro' }, groupVariants: 'sí', stockMode: 'otro', lowStockThreshold: 2.5, columns: 4,
      pageBreakPerCategory: false, showDate: null, tableOfContents: true, photoQuality: 'ultra', fields: { photo: false, brand: 'x' },
    }))
    const suggested = suggestedSettings()
    expect(result).toEqual({
      ...suggested, pageBreakPerCategory: false, tableOfContents: true, fields: { ...suggested.fields, photo: false },
    })
  })

  it('topa el umbral entre 0 y el máximo', () => {
    expect(normalizeSettings(wrap({ lowStockThreshold: -4 })).lowStockThreshold).toBe(0)
    expect(normalizeSettings(wrap({ lowStockThreshold: 99999 })).lowStockThreshold).toBe(MAX_LOW_STOCK_THRESHOLD)
  })

  it('el filtro descarta lo que no son textos', () => {
    expect(normalizeSettings(wrap({ filter: { mode: 'manual', ids: ['a', 3, null, 'b'] } })).filter).toEqual({ mode: 'manual', ids: ['a', 'b'] })
    expect(normalizeSettings(wrap({ filter: { mode: 'categories', categories: 'Ropa' } })).filter).toEqual({ mode: 'categories', categories: [] })
    expect(normalizeSettings(wrap({ filter: { mode: 'in-stock' } })).filter).toEqual({ mode: 'in-stock' })
  })

  it('serializa y recupera lo mismo', () => {
    const settings = { ...suggestedSettings(), columns: 1 as const, businessName: 'Tienda' }
    expect(normalizeSettings(JSON.parse(serializeSettings(settings)))).toEqual(settings)
  })
})

describe('nombre del negocio', () => {
  it('junta espacios, topa el largo y, vacío, vuelve al sugerido', () => {
    expect(cleanBusinessName('  Bazar   de  Lupe ')).toBe('Bazar de Lupe')
    expect(cleanBusinessName('x'.repeat(500))).toHaveLength(BUSINESS_NAME_MAX)
    expect(cleanBusinessName('   ')).toBe(APP_NAME)
    expect(cleanBusinessName(undefined)).toBe(APP_NAME)
  })
})

describe('paso a las opciones del armado y del documento', () => {
  it('la existencia apagada oculta el texto de existencia', () => {
    const settings = { ...suggestedSettings(), stockMode: 'exact' as const, fields: { ...suggestedSettings().fields, stock: false } }
    expect(toDataOptions(settings).stockMode).toBe('hidden')
    expect(toDataOptions(suggestedSettings())).toEqual({ groupVariants: true, stockMode: 'exact', lowStockThreshold: 3, filter: { mode: 'all' } })
  })

  it('las opciones del documento llevan el nombre limpio, la fecha y los datos elegidos', () => {
    const date = new Date(2026, 9, 21)
    const options = toDocOptions({ ...suggestedSettings(), businessName: '  Mi   Bazar ' }, date)
    expect(options).toMatchObject({ businessName: 'Mi Bazar', date, columns: 2, showDate: true, tableOfContents: false, pageBreakPerCategory: true })
    expect(options.fields).toEqual(suggestedSettings().fields)
  })
})
