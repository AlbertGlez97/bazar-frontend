// Voz de La Marchanta: textos compartidos y patrones para mensajes nuevos.
// Principios y ejemplos en doc/brand-guidelines.md (sección "Voz"). Regla de
// oro: un mensaje dice qué pasó y qué hacer, y el toque cálido nunca va a costa
// de la claridad.
import { minorToDisplay } from '@/utils/money'

export const VOICE = {
  /** Fallo genérico del servidor o desconocido */
  genericError: 'Algo salió mal de nuestro lado. Intenta de nuevo en un momento.',
  /** La petición no llegó al servidor (sin internet, servidor caído) */
  networkError: 'No pudimos conectarnos. Revisa tu internet e intenta de nuevo.',
  /**
   * Ventas. Las claves sin prefijo hablan a quien está cobrando ahora (el
   * carrito sigue ahí y se puede corregir); las `sync*` describen una venta
   * que ya se había hecho y se rechazó al sincronizar: no invitan a editar un
   * carrito que ya no existe. Nunca se muestra el texto crudo del servidor
   * (viene en inglés y con ids).
   */
  sale: {
    insufficientStock: 'Ya no hay suficientes piezas de uno de los productos. Baja la cantidad o quítalo del carrito e intenta de nuevo.',
    cashInsufficient: 'El efectivo recibido no alcanza para el total actual. Revisa el monto y vuelve a cobrar.',
    productDeactivated: 'Uno de los productos ya no está a la venta. Quítalo del carrito e intenta de nuevo.',
    productMissing: 'Uno de los productos ya no existe en tu catálogo. Quítalo del carrito e intenta de nuevo.',
    payloadConflict: 'Esta venta ya se había guardado con otros datos y no pudimos volver a enviarla. Avisa a un socio para revisarla.',
    rejectedGeneric: 'No pudimos registrar esta venta. Revisa el carrito e intenta de nuevo.',
    /** 401/403: la venta NO se pierde, queda guardada en el dispositivo. */
    authNeeded: 'Tu sesión ya no es válida, pero la venta sigue guardada en este dispositivo. Inicia sesión de nuevo para enviarla.',
    /** No se pudo ni guardar en el dispositivo (IndexedDB no disponible). */
    failedToSave: 'No pudimos guardar esta venta en el dispositivo. Anótala aparte y conserva el carrito hasta tener internet.',
    syncInsufficientStock: 'Cuando esta venta llegó al servidor, uno de los productos ya no tenía piezas suficientes. Un socio puede revisarla.',
    syncCashInsufficient: 'El precio de algún producto cambió y el efectivo recibido ya no alcanzaba para el total. Un socio puede revisarla.',
    syncProductDeactivated: 'Uno de los productos de esta venta se desactivó antes de que llegara al servidor. Un socio puede revisarla.',
    syncProductMissing: 'Uno de los productos de esta venta ya no existe en el catálogo. Un socio puede revisarla.',
    syncPayloadConflict: 'Esta venta ya se había guardado con otros datos y no pudimos volver a enviarla. Un socio puede revisarla.',
    syncRejectedGeneric: 'El servidor no pudo registrar esta venta. Un socio puede revisarla.',
    /** 201/200 `rechazada_por_conflicto`: perdió la carrera por la última pieza. */
    conflict: 'Otra venta se llevó la última pieza de un producto justo antes que esta, así que no se cobró. Un socio la revisará en incidencias.',
  },
  /** Lector de QR: textos fijos de la pantalla; las fallas de cámara salen de `cameraErrorMessage`. */
  scan: {
    title: 'Escanear producto',
    hint: 'Apunta la cámara al código QR del producto.',
    loading: 'Abriendo la cámara…',
    done: 'Listo',
    retry: 'Intentar de nuevo',
  },
} as const

/** Códigos de falla del lector (los de `QrScannerError` más el contexto inseguro). */
export type CameraFailure =
  | 'permission-denied'
  | 'no-camera'
  | 'camera-busy'
  | 'insecure-context'
  | 'unsupported'
  | 'unknown'

const CAMERA_MESSAGES: Record<CameraFailure, string> = {
  'permission-denied': 'Necesitamos tu permiso para usar la cámara. Actívalo en los ajustes del navegador y vuelve a intentar.',
  'no-camera': 'No encontramos una cámara en este dispositivo. Busca el producto por su nombre.',
  'camera-busy': 'Otra aplicación está usando la cámara. Ciérrala e intenta de nuevo.',
  'insecure-context': 'La cámara solo funciona en una conexión segura. Abre la app desde su dirección oficial.',
  unsupported: 'Este navegador no puede leer códigos QR. Usa otro navegador o busca el producto por su nombre.',
  unknown: 'No pudimos abrir la cámara. Intenta de nuevo en un momento.',
}

/** Mensaje amable para cada falla de la cámara; cualquier valor desconocido cae en el genérico. */
export function cameraErrorMessage(failure: CameraFailure): string {
  return CAMERA_MESSAGES[failure] ?? CAMERA_MESSAGES.unknown
}

/** QR leído que no corresponde a ningún producto del catálogo: sin culpar y con salida. */
export function saleScanUnknownMessage(): string {
  return 'No reconocemos ese código. Prueba con otro producto o búscalo por su nombre.'
}

/** Confirmación al agregar un producto leído con la cámara. */
export function saleScanAddedMessage(productName: string): string {
  return `${productName.trim()}: agregado a tu venta.`
}

/** Sin `response` de Axios la petición nunca obtuvo respuesta: es un problema de red. */
export function isNetworkError(cause: unknown): boolean {
  return !(cause as { response?: unknown } | null)?.response
}

/**
 * Patrón para confirmar una venta cobrada (aún no hay vista de ventas; las
 * futuras deben usar esto en vez de un "¡Éxito!" genérico): un hecho concreto
 * primero (qué se anotó y cuánto) y después el dato útil (cambio, a nombre de
 * quién). Sin signos de exclamación de relleno.
 */
export function saleSuccessMessage(sale: {
  totalMinor: number
  changeMinor?: number | null
  sellerName?: string
}): string {
  const parts = [`Venta anotada: $${minorToDisplay(sale.totalMinor)}.`]
  if (sale.changeMinor && sale.changeMinor > 0) {
    parts.push(`Cambio: $${minorToDisplay(sale.changeMinor)}.`)
  }
  if (sale.sellerName?.trim()) {
    parts.push(`Quedó a nombre de ${sale.sellerName.trim()}.`)
  }
  return parts.join(' ')
}

/**
 * Venta guardada en el dispositivo por falta de internet. Debe sentirse como
 * éxito (la venta ES válida y se enviará sola), no como error: hecho concreto,
 * cambio y qué pasa después.
 */
export function saleSavedOfflineMessage(sale: { totalMinor: number; changeMinor?: number | null }): string {
  const parts = [`Venta guardada: $${minorToDisplay(sale.totalMinor)}.`]
  if (sale.changeMinor && sale.changeMinor > 0) {
    parts.push(`Cambio: $${minorToDisplay(sale.changeMinor)}.`)
  }
  parts.push('Se enviará sola en cuanto haya internet.')
  return parts.join(' ')
}

/** Resultado 201/200 `rechazada_por_conflicto`: NUNCA se muestra como venta cobrada. */
export function saleConflictMessage(): string {
  return VOICE.sale.conflict
}

/** Indicador calmado de la cola; cadena vacía cuando no hay nada que avisar. */
export function salesPendingMessage(count: number): string {
  if (count <= 0) return ''
  return count === 1
    ? '1 venta pendiente de sincronizar'
    : `${count} ventas pendientes de sincronizar`
}

/** Ventas que el servidor no aceptó y necesitan que una persona las revise. */
export function salesNeedReviewMessage(count: number): string {
  if (count <= 0) return ''
  return count === 1
    ? '1 venta necesita que la revises'
    : `${count} ventas necesitan que las revises`
}
