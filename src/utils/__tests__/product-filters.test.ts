import { describe, expect, it } from 'vitest'
import {
  activeFilterChips,
  clearFilter,
  countActiveFilters,
  emptyProductFilters,
  parseProductFilters,
  serializeProductFilters,
  toProductListParams,
} from '../product-filters'
import { LOW_STOCK_UMBRAL } from '@/config/catalog'

describe('emptyProductFilters', () => {
  it('arranca con todo apagado', () => {
    expect(emptyProductFilters()).toEqual({
      pocaExistencia: false, agotados: false, inactivos: false, tipo: undefined, sinCosto: false,
    })
  })
  it('devuelve un objeto nuevo cada vez', () => {
    expect(emptyProductFilters()).not.toBe(emptyProductFilters())
  })
})

describe('parseProductFilters (query de la URL → filtros)', () => {
  it('sin query: todo apagado', () => {
    expect(parseProductFilters({})).toEqual(emptyProductFilters())
  })
  it('lee cada parámetro', () => {
    expect(parseProductFilters({
      pocaExistencia: '1', agotados: '1', inactivos: '1', tipo: 'cantidad', sinCosto: '1',
    }, { allowInactive: true })).toEqual({
      pocaExistencia: true, agotados: true, inactivos: true, tipo: 'cantidad', sinCosto: true,
    })
  })
  it('solo "1" enciende un interruptor', () => {
    expect(parseProductFilters({ agotados: 'true', sinCosto: '0', pocaExistencia: '' })).toEqual(emptyProductFilters())
  })
  it('ignora un tipo desconocido', () => {
    expect(parseProductFilters({ tipo: 'otro' }).tipo).toBeUndefined()
  })
  it('con un parámetro repetido se queda con el primero', () => {
    expect(parseProductFilters({ agotados: ['1', '0'], tipo: ['unica', 'cantidad'] })).toMatchObject({ agotados: true, tipo: 'unica' })
  })
  it('descarta "inactivos" si quien mira no puede verlos (colaborador)', () => {
    expect(parseProductFilters({ inactivos: '1' }).inactivos).toBe(false)
    expect(parseProductFilters({ inactivos: '1' }, { allowInactive: false }).inactivos).toBe(false)
  })
  it('conserva "inactivos" para un socio', () => {
    expect(parseProductFilters({ inactivos: '1' }, { allowInactive: true }).inactivos).toBe(true)
  })
})

describe('serializeProductFilters (filtros → query de la URL)', () => {
  it('sin filtros activos no escribe nada', () => {
    expect(serializeProductFilters(emptyProductFilters())).toEqual({})
  })
  it('escribe solo lo activo', () => {
    expect(serializeProductFilters({ ...emptyProductFilters(), agotados: true, tipo: 'unica' }))
      .toEqual({ agotados: '1', tipo: 'unica' })
  })
  it('es la inversa de parseProductFilters', () => {
    const filters = { pocaExistencia: true, agotados: false, inactivos: true, tipo: 'cantidad' as const, sinCosto: true }
    expect(parseProductFilters(serializeProductFilters(filters), { allowInactive: true })).toEqual(filters)
  })
})

describe('countActiveFilters', () => {
  it('cuenta los filtros encendidos', () => {
    expect(countActiveFilters(emptyProductFilters())).toBe(0)
    expect(countActiveFilters({ pocaExistencia: true, agotados: true, inactivos: false, tipo: 'unica', sinCosto: false })).toBe(3)
    expect(countActiveFilters({ pocaExistencia: true, agotados: true, inactivos: true, tipo: 'cantidad', sinCosto: true })).toBe(5)
  })
})

describe('activeFilterChips', () => {
  it('sin filtros no hay chips', () => {
    expect(activeFilterChips(emptyProductFilters())).toEqual([])
  })
  it('un chip por filtro activo, con su etiqueta', () => {
    expect(activeFilterChips({ pocaExistencia: true, agotados: true, inactivos: true, tipo: 'unica', sinCosto: true })).toEqual([
      { key: 'pocaExistencia', label: 'Poca existencia' },
      { key: 'agotados', label: 'Agotados' },
      { key: 'inactivos', label: 'Mostrar inactivos' },
      { key: 'tipo', label: 'Única' },
      { key: 'sinCosto', label: 'Sin costo de compra' },
    ])
  })
  it('el chip de tipo dice cuál es', () => {
    expect(activeFilterChips({ ...emptyProductFilters(), tipo: 'cantidad' })).toEqual([{ key: 'tipo', label: 'Por cantidad' }])
  })
})

describe('clearFilter', () => {
  it('apaga solo el filtro indicado, sin tocar el original', () => {
    const filters = { pocaExistencia: true, agotados: true, inactivos: false, tipo: 'unica' as const, sinCosto: false }
    expect(clearFilter(filters, 'agotados')).toEqual({ ...filters, agotados: false })
    expect(clearFilter(filters, 'tipo')).toEqual({ ...filters, tipo: undefined })
    expect(filters.agotados).toBe(true)
  })
})

describe('toProductListParams (filtros → parámetros de GET /products)', () => {
  it('sin filtros manda todo apagado de forma explícita (para apagar lo guardado en el store)', () => {
    expect(toProductListParams(emptyProductFilters())).toEqual({
      includeInactive: false, umbral: undefined, agotados: undefined, sinCosto: undefined, tipo: undefined,
    })
    expect(toProductListParams(emptyProductFilters())).toHaveProperty('umbral')
  })
  it('traduce cada filtro al parámetro del servidor', () => {
    expect(toProductListParams({ pocaExistencia: true, agotados: true, inactivos: true, tipo: 'unica', sinCosto: true })).toEqual({
      includeInactive: true, umbral: LOW_STOCK_UMBRAL, agotados: true, sinCosto: true, tipo: 'unica',
    })
  })
})

describe('filtro por marca', () => {
  it('arranca sin marca', () => {
    expect(emptyProductFilters().marca).toBeUndefined()
  })
  it('se lee de la URL, recortada y sin espacios de más', () => {
    expect(parseProductFilters({ marca: '  Casa   Vieja ' }).marca).toBe('Casa Vieja')
  })
  it('una marca vacía o en blanco es "sin filtro"', () => {
    expect(parseProductFilters({ marca: '' }).marca).toBeUndefined()
    expect(parseProductFilters({ marca: '   ' }).marca).toBeUndefined()
  })
  it('más de 40 caracteres se descarta (el servidor lo rechazaría con 400)', () => {
    expect(parseProductFilters({ marca: 'x'.repeat(41) }).marca).toBeUndefined()
    expect(parseProductFilters({ marca: 'x'.repeat(40) }).marca).toBe('x'.repeat(40))
  })
  it('con el parámetro repetido gana el primero', () => {
    expect(parseProductFilters({ marca: ['Nike', 'Puma'] }).marca).toBe('Nike')
  })
  it('se escribe en la URL solo si está activa', () => {
    expect(serializeProductFilters({ ...emptyProductFilters(), marca: 'Nike' })).toEqual({ marca: 'Nike' })
    expect(serializeProductFilters(emptyProductFilters())).toEqual({})
  })
  it('es un chip con su nombre, y cuenta como filtro activo', () => {
    const filters = { ...emptyProductFilters(), marca: 'Nike' }
    expect(activeFilterChips(filters)).toEqual([{ key: 'marca', label: 'Marca: Nike' }])
    expect(countActiveFilters(filters)).toBe(1)
  })
  it('se apaga solo ese filtro', () => {
    const filters = { ...emptyProductFilters(), marca: 'Nike', agotados: true }
    expect(clearFilter(filters, 'marca')).toEqual({ ...emptyProductFilters(), agotados: true })
  })
  it('viaja al servidor como `brand`; apagado va `undefined` explícito', () => {
    expect(toProductListParams({ ...emptyProductFilters(), marca: 'Nike' })).toHaveProperty('brand', 'Nike')
    const off = toProductListParams(emptyProductFilters())
    expect('brand' in off).toBe(true)
    expect(off.brand).toBeUndefined()
  })
})
