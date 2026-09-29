import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { MANAGE_CATALOG_VIEW_STORAGE_KEY, useManageCatalogViewStore } from '../manageCatalogView.store'
import { isManageCatalogView } from '@/types/manage-catalog-view.types'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => vi.restoreAllMocks())

describe('isManageCatalogView', () => {
  it('solo acepta "grid" y "list"', () => {
    expect(isManageCatalogView('grid')).toBe(true)
    expect(isManageCatalogView('list')).toBe(true)
    for (const bad of ['', 'GRID', 'tabla', null, undefined, 1, {}, ['list']]) {
      expect(isManageCatalogView(bad)).toBe(false)
    }
  })
})

describe('preferencia de vista del catálogo de gestión', () => {
  it('la clave de localStorage está documentada, es del dispositivo y distinta de la de venta', () => {
    expect(MANAGE_CATALOG_VIEW_STORAGE_KEY).toBe('la-marchanta-manage-catalog-view')
  })

  it('sin preferencia guardada el valor por defecto es la cuadrícula', () => {
    expect(useManageCatalogViewStore().view).toBe('grid')
  })

  it('arrancar sin preferencia no escribe nada en localStorage', () => {
    useManageCatalogViewStore()
    expect(localStorage.getItem(MANAGE_CATALOG_VIEW_STORAGE_KEY)).toBeNull()
  })

  it('lee una preferencia válida guardada', () => {
    localStorage.setItem(MANAGE_CATALOG_VIEW_STORAGE_KEY, 'list')
    expect(useManageCatalogViewStore().view).toBe('list')
  })

  it.each(['', 'GRID', 'tabla', '{"view":"list"}', 'null'])('un valor guardado inválido (%j) se trata como "sin preferencia"', (raw) => {
    localStorage.setItem(MANAGE_CATALOG_VIEW_STORAGE_KEY, raw)
    expect(useManageCatalogViewStore().view).toBe('grid')
  })

  it('cambiar la vista la guarda', () => {
    const store = useManageCatalogViewStore()
    store.setView('list')
    expect(store.view).toBe('list')
    expect(localStorage.getItem(MANAGE_CATALOG_VIEW_STORAGE_KEY)).toBe('list')
    store.setView('grid')
    expect(localStorage.getItem(MANAGE_CATALOG_VIEW_STORAGE_KEY)).toBe('grid')
  })

  it('la preferencia sobrevive a "recargar" (un store nuevo la lee)', () => {
    useManageCatalogViewStore().setView('list')
    setActivePinia(createPinia())
    expect(useManageCatalogViewStore().view).toBe('list')
  })

  it('ignora un valor inválido al cambiar: no rompe ni guarda basura', () => {
    const store = useManageCatalogViewStore()
    store.setView('tabla' as never)
    expect(store.view).toBe('grid')
    expect(localStorage.getItem(MANAGE_CATALOG_VIEW_STORAGE_KEY)).toBeNull()
  })

  it('no comparte clave con la vista de venta', async () => {
    const { SALE_CATALOG_VIEW_STORAGE_KEY } = await import('../saleCatalogView.store')
    expect(MANAGE_CATALOG_VIEW_STORAGE_KEY).not.toBe(SALE_CATALOG_VIEW_STORAGE_KEY)
  })

  describe('localStorage no disponible (modo privado, cuota, permisos)', () => {
    it('leer lanza: sigue con la cuadrícula, sin romper', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
      expect(useManageCatalogViewStore().view).toBe('grid')
    })

    it('guardar lanza: la vista cambia igual, solo se pierde la persistencia', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
      const store = useManageCatalogViewStore()
      expect(() => store.setView('list')).not.toThrow()
      expect(store.view).toBe('list')
    })
  })
})
