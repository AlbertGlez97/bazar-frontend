/**
 * Opciones del diálogo "Generar catálogo": valores SUGERIDOS, validación de lo que se
 * guardó en localStorage (con versión del esquema) y paso a las opciones del armado de datos
 * y del documento. PURO.
 */
import { APP_NAME } from '@/config/app'
import type {
  CatalogDataOptions,
  CatalogExportSettings,
  CatalogFilter,
  PhotoQualityChoice,
  StockMode,
} from '@/types/catalog.types'
import type { CatalogDocOptions } from '@/services/catalog-docx'
import { DEFAULT_LOW_STOCK_THRESHOLD } from '@/utils/catalog-data'

/** Súbelo cuando cambie la forma de las opciones: lo guardado con otra versión se descarta. */
export const CATALOG_SETTINGS_VERSION = 1
export const CATALOG_SETTINGS_STORAGE_KEY = 'la-marchanta-catalog-export'
export const BUSINESS_NAME_MAX = 120
export const MAX_LOW_STOCK_THRESHOLD = 999

export const STOCK_MODES: readonly StockMode[] = ['exact', 'availability', 'hidden']
export const PHOTO_QUALITIES: readonly PhotoQualityChoice[] = ['normal', 'high']

export function suggestedSettings(): CatalogExportSettings {
  return {
    businessName: APP_NAME,
    filter: { mode: 'all' },
    groupVariants: true,
    fields: { photo: true, brand: true, presentation: true, description: true, price: true, stock: true },
    stockMode: 'exact',
    lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
    columns: 2,
    pageBreakPerCategory: true,
    showDate: true,
    tableOfContents: false,
    photoQuality: 'normal',
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asBoolean = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)
const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

function asFilter(value: unknown, fallback: CatalogFilter): CatalogFilter {
  if (!isRecord(value)) return fallback
  switch (value.mode) {
    case 'all':
    case 'in-stock':
      return { mode: value.mode }
    case 'categories':
      return { mode: 'categories', categories: asStrings(value.categories) }
    case 'manual':
      return { mode: 'manual', ids: asStrings(value.ids) }
    default:
      return fallback
  }
}

/** Texto del nombre del negocio: sin espacios de más y topado; vacío -> el sugerido. */
export function cleanBusinessName(value: unknown, fallback: string = APP_NAME): string {
  if (typeof value !== 'string') return fallback
  const text = value.trim().split(/\s+/).join(' ').slice(0, BUSINESS_NAME_MAX).trim()
  return text === '' ? fallback : text
}

/**
 * Deja unas opciones válidas a partir de cualquier cosa. Cada campo inválido vuelve a su
 * valor sugerido; el resto se conserva. Sin versión o con otra versión -> TODO sugerido.
 */
export function normalizeSettings(input: unknown): CatalogExportSettings {
  const suggested = suggestedSettings()
  if (!isRecord(input) || input.version !== CATALOG_SETTINGS_VERSION || !isRecord(input.settings)) return suggested
  const raw = input.settings
  const fields = isRecord(raw.fields) ? raw.fields : {}
  const threshold = typeof raw.lowStockThreshold === 'number' && Number.isInteger(raw.lowStockThreshold)
    ? Math.min(MAX_LOW_STOCK_THRESHOLD, Math.max(0, raw.lowStockThreshold))
    : suggested.lowStockThreshold
  return {
    businessName: cleanBusinessName(raw.businessName, suggested.businessName),
    filter: asFilter(raw.filter, suggested.filter),
    groupVariants: asBoolean(raw.groupVariants, suggested.groupVariants),
    fields: {
      photo: asBoolean(fields.photo, suggested.fields.photo),
      brand: asBoolean(fields.brand, suggested.fields.brand),
      presentation: asBoolean(fields.presentation, suggested.fields.presentation),
      description: asBoolean(fields.description, suggested.fields.description),
      price: asBoolean(fields.price, suggested.fields.price),
      stock: asBoolean(fields.stock, suggested.fields.stock),
    },
    stockMode: STOCK_MODES.includes(raw.stockMode as StockMode) ? (raw.stockMode as StockMode) : suggested.stockMode,
    lowStockThreshold: threshold,
    columns: raw.columns === 1 || raw.columns === 2 || raw.columns === 3 ? raw.columns : suggested.columns,
    pageBreakPerCategory: asBoolean(raw.pageBreakPerCategory, suggested.pageBreakPerCategory),
    showDate: asBoolean(raw.showDate, suggested.showDate),
    tableOfContents: asBoolean(raw.tableOfContents, suggested.tableOfContents),
    photoQuality: PHOTO_QUALITIES.includes(raw.photoQuality as PhotoQualityChoice) ? (raw.photoQuality as PhotoQualityChoice) : suggested.photoQuality,
  }
}

/** Lo que se guarda: las opciones y la versión del esquema. */
export function serializeSettings(settings: CatalogExportSettings): string {
  return JSON.stringify({ version: CATALOG_SETTINGS_VERSION, settings })
}

/** Opciones del armado de datos. La existencia desaparece del dato si el engrane "existencia" está apagado. */
export function toDataOptions(settings: CatalogExportSettings): CatalogDataOptions {
  return {
    groupVariants: settings.groupVariants,
    stockMode: settings.fields.stock ? settings.stockMode : 'hidden',
    lowStockThreshold: settings.lowStockThreshold,
    filter: settings.filter,
  }
}

export function toDocOptions(settings: CatalogExportSettings, date: Date): CatalogDocOptions {
  return {
    businessName: cleanBusinessName(settings.businessName),
    showDate: settings.showDate,
    date,
    tableOfContents: settings.tableOfContents,
    pageBreakPerCategory: settings.pageBreakPerCategory,
    columns: settings.columns,
    fields: { ...settings.fields },
  }
}
