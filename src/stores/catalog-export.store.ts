import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CatalogExportSettings, CatalogSettingsPatch } from '@/types/catalog.types'
import {
  CATALOG_SETTINGS_STORAGE_KEY,
  CATALOG_SETTINGS_VERSION,
  normalizeSettings,
  serializeSettings,
  suggestedSettings,
} from '@/utils/catalog-export-settings'

/** Lee y VALIDA lo guardado; JSON roto, otra versión o almacenamiento bloqueado -> valores sugeridos. */
function readSaved(): CatalogExportSettings {
  try {
    const raw = localStorage.getItem(CATALOG_SETTINGS_STORAGE_KEY)
    return raw ? normalizeSettings(JSON.parse(raw)) : suggestedSettings()
  } catch {
    return suggestedSettings()
  }
}

function save(settings: CatalogExportSettings): void {
  try {
    localStorage.setItem(CATALOG_SETTINGS_STORAGE_KEY, serializeSettings(settings))
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): las opciones siguen valiendo en esta sesión.
  }
}

/**
 * Opciones del catálogo en Word. Se guardan al cambiar (con la versión del esquema) para no
 * volver a elegirlas; "Restaurar sugeridos" las deja como vienen de fábrica.
 */
export const useCatalogExportStore = defineStore('catalog-export', () => {
  const settings = ref<CatalogExportSettings>(readSaved())

  /** Cambia uno o varios ajustes; lo que quede inválido vuelve a su valor sugerido. */
  function set(partial: CatalogSettingsPatch) {
    settings.value = normalizeSettings({
      version: CATALOG_SETTINGS_VERSION,
      settings: { ...settings.value, ...partial, fields: { ...settings.value.fields, ...partial.fields } },
    })
    save(settings.value)
  }

  function reset() {
    settings.value = suggestedSettings()
    save(settings.value)
  }

  return { settings, set, reset }
})
