import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { SALE_CATALOG_VIEW_STORAGE_KEY, useSaleCatalogViewStore } from '../saleCatalogView.store'
import { isSaleCatalogView } from '@/types/sale-catalog-view.types'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => vi.restoreAllMocks())

describe('isSaleCatalogView', () => {
  it('solo acepta "grid" y "list"', () => {
    expect(isSaleCatalogView('grid')).toBe(true)
    expect(isSaleCatalogView('list')).toBe(true)
    for (const bad of ['', 'GRID', 'tabla', null, undefined, 1, {}, ['list']]) {
      expect(isSaleCatalogView(bad)).toBe(false)
    }
  })
})

describe('preferencia de vista del catálogo de venta', () => {
  it('la clave de localStorage está documentada y es del dispositivo', () => {
    expect(SALE_CATALOG_VIEW_STORAGE_KEY).toBe('la-marchanta-sale-catalog-view')
  })

  it('sin preferencia guardada el valor por defecto es la cuadrícula', () => {
    expect(useSaleCatalogViewStore().view).toBe('grid')
  })

  it('arrancar sin preferencia no escribe nada en localStorage', () => {
    useSaleCatalogViewStore()
    expect(localStorage.getItem(SALE_CATALOG_VIEW_STORAGE_KEY)).toBeNull()
  })

  it('lee una preferencia válida guardada', () => {
    localStorage.setItem(SALE_CATALOG_VIEW_STORAGE_KEY, 'list')
    expect(useSaleCatalogViewStore().view).toBe('list')
  })

  it.each(['', 'GRID', 'tabla', '{"view":"list"}', 'null'])('un valor guardado inválido (%j) se trata como "sin preferencia"', (raw) => {
    localStorage.setItem(SALE_CATALOG_VIEW_STORAGE_KEY, raw)
    expect(useSaleCatalogViewStore().view).toBe('grid')
  })

  it('cambiar la vista la guarda', () => {
    const store = useSaleCatalogViewStore()
    store.setView('list')
    expect(store.view).toBe('list')
    expect(localStorage.getItem(SALE_CATALOG_VIEW_STORAGE_KEY)).toBe('list')
    store.setView('grid')
    expect(localStorage.getItem(SALE_CATALOG_VIEW_STORAGE_KEY)).toBe('grid')
  })

  it('la preferencia sobrevive a "recargar" (un store nuevo la lee)', () => {
    useSaleCatalogViewStore().setView('list')
    setActivePinia(createPinia())
    expect(useSaleCatalogViewStore().view).toBe('list')
  })

  it('ignora un valor inválido al cambiar: no rompe ni guarda basura', () => {
    const store = useSaleCatalogViewStore()
    store.setView('tabla' as never)
    expect(store.view).toBe('grid')
    expect(localStorage.getItem(SALE_CATALOG_VIEW_STORAGE_KEY)).toBeNull()
  })

  describe('localStorage no disponible (modo privado, cuota, permisos)', () => {
    it('leer lanza: sigue con la cuadrícula, sin romper', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
      expect(useSaleCatalogViewStore().view).toBe('grid')
    })

    it('guardar lanza: la vista cambia igual, solo se pierde la persistencia', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
      const store = useSaleCatalogViewStore()
      expect(() => store.setView('list')).not.toThrow()
      expect(store.view).toBe('list')
    })
  })
})
