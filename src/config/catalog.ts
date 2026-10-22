/** Mismo umbral por defecto que usa el resumen del dashboard para "poca existencia" (stock <= umbral). */
export const LOW_STOCK_UMBRAL = 2

/** Máximos de los datos descriptivos del producto (los mismos que valida el servidor). */
export const PRODUCT_TEXT_LIMITS = { brand: 40, presentation: 40, description: 200, category: 100 } as const
