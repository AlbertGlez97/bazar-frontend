import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCatalogExportStore } from '../catalog-export.store'
import { CATALOG_SETTINGS_STORAGE_KEY, CATALOG_SETTINGS_VERSION, suggestedSettings } from '@/utils/catalog-export-settings'

/** "Sesión nueva" (recargar): otro Pinia, la misma localStorage. */
function newSession() {
  setActivePinia(createPinia())
  return useCatalogExportStore()
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('catalog export store', () => {
  it('arranca con los valores sugeridos', () => {
    expect(newSession().settings).toEqual(suggestedSettings())
  })

  it('guarda cada cambio con la versión del esquema y lo recupera tras recargar', () => {
    const store = newSession()
    store.set({ columns: 3, stockMode: 'availability', filter: { mode: 'categories', categories: ['Ropa'] } })
    store.set({ fields: { photo: false } })
    store.set({ businessName: 'Bazar Lupe' })

    const saved = JSON.parse(localStorage.getItem(CATALOG_SETTINGS_STORAGE_KEY)!)
    expect(saved.version).toBe(CATALOG_SETTINGS_VERSION)

    const after = newSession().settings
    expect(after).toMatchObject({ columns: 3, stockMode: 'availability', businessName: 'Bazar Lupe', filter: { mode: 'categories', categories: ['Ropa'] } })
    expect(after.fields).toEqual({ ...suggestedSettings().fields, photo: false })
  })

  it('un cambio parcial de datos por producto no pierde los demás', () => {
    const store = newSession()
    store.set({ fields: { brand: false } })
    store.set({ fields: { price: false } })
    expect(store.settings.fields).toEqual({ ...suggestedSettings().fields, brand: false, price: false })
  })

  it('"Restaurar sugeridos" vuelve a los valores de fábrica y lo guarda', () => {
    const store = newSession()
    store.set({ columns: 1, tableOfContents: true, businessName: 'Otro' })
    store.reset()
    expect(store.settings).toEqual(suggestedSettings())
    expect(newSession().settings).toEqual(suggestedSettings())
  })

  it('si la versión guardada no coincide, vuelve a los sugeridos', () => {
    localStorage.setItem(
      CATALOG_SETTINGS_STORAGE_KEY,
      JSON.stringify({ version: CATALOG_SETTINGS_VERSION + 1, settings: { ...suggestedSettings(), columns: 3 } }),
    )
    expect(newSession().settings.columns).toBe(2)
  })

  it.each(['{no es json', 'null', '[]', '"hola"', ''])('lo guardado ilegible (%j) vuelve a los sugeridos', (raw) => {
    localStorage.setItem(CATALOG_SETTINGS_STORAGE_KEY, raw)
    expect(newSession().settings).toEqual(suggestedSettings())
  })

  it('valida lo que lee: lo inválido a sugerido, lo bueno se conserva', () => {
    localStorage.setItem(
      CATALOG_SETTINGS_STORAGE_KEY,
      JSON.stringify({ version: CATALOG_SETTINGS_VERSION, settings: { columns: 9, photoQuality: 'high' } }),
    )
    expect(newSession().settings).toMatchObject({ columns: 2, photoQuality: 'high' })
  })

  it('lo que se escribe mal desde el diálogo se corrige al guardar', () => {
    const store = newSession()
    store.set({ lowStockThreshold: -3, businessName: '   ' })
    expect(store.settings.lowStockThreshold).toBe(0)
    expect(store.settings.businessName).toBe(suggestedSettings().businessName)
  })

  it('sigue funcionando en memoria si localStorage no está disponible', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado') })
    const store = newSession()
    expect(store.settings).toEqual(suggestedSettings())
    expect(() => store.set({ columns: 1 })).not.toThrow()
    expect(store.settings.columns).toBe(1)
    expect(() => store.reset()).not.toThrow()
  })
})
