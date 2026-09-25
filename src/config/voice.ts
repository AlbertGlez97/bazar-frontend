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
    /** No se intentó cobrar: falta algo (la UI apaga el botón, esto es la red de seguridad). */
    blockedEmptyCart: 'La venta está vacía. Agrega un producto para poder cobrar.',
    blockedMissingContext: 'Falta saber quién vende o en qué dispositivo. Vuelve a elegirlo e intenta de nuevo.',
    conflict: 'Otra venta se llevó la última pieza de un producto justo antes que esta, así que no se cobró. Un socio la revisará en incidencias.',
  },
  /** Pantallas de resultado del cobro (cada una con un solo botón principal). */
  saleResult: {
    successTitle: 'Venta registrada',
    totalLabel: 'Total',
    changeLabel: 'Cambio a entregar',
    noChange: 'Sin cambio',
    newSale: 'Nueva venta',
    savedTitle: 'Listo, ya quedó',
    savedBody: 'Sin señal, pero tu venta está guardada y se manda sola cuando haya internet.',
    conflictTitle: 'Esta venta no se pudo cobrar',
    conflictAction: 'Si ya cobraste, devuelve el dinero y no entregues el producto. Avisa a un socio.',
    conflictDetail: 'Detalle para el socio',
    newSaleAfterConflict: 'Entendido, nueva venta',
    rejectedTitle: 'No pudimos registrar la venta',
    back: 'Regresar a la venta',
    authNeededTitle: 'Tu venta está guardada',
    login: 'Iniciar sesión',
    failedToSaveTitle: 'No se guardó la venta',
    retry: 'Intentar de nuevo',
    blockedTitle: 'Todavía no se puede cobrar',
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

/** Cuenta lo que falta para poder cobrar; vacío si ya se puede. Es la razón que se muestra junto al botón "Cobrar" deshabilitado. */
export function saleChargeHint(state: {
  itemCount: number
  totalMinor: number
  cashMinor: number
  missingMinor: number
}): string {
  if (state.itemCount === 0) return 'Agrega un producto para poder cobrar.'
  // Un total de $0 (producto regalado) se cobra sin efectivo.
  if (state.cashMinor === 0 && state.totalMinor > 0) return 'Escribe el efectivo recibido para poder cobrar.'
  if (state.missingMinor > 0) return `Faltan $${minorToDisplay(state.missingMinor)} para poder cobrar.`
  return ''
}

/**
 * Aviso suave de que el catálogo que se ve es la copia guardada en el
 * dispositivo (sin internet o sin poder actualizar). No alarma: la venta sigue.
 */
export function catalogSnapshotMessage(savedAtIso: string, now: Date = new Date()): string {
  const saved = new Date(savedAtIso)
  if (Number.isNaN(saved.getTime())) return 'Estás viendo el catálogo guardado en este dispositivo.'

  const time = saved.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
  // "de la 1:05" pero "de las 10:05"
  const article = saved.getHours() % 12 === 1 ? 'la' : 'las'
  const sameDay = saved.toDateString() === now.toDateString()
  if (sameDay) return `Estás viendo el catálogo guardado de ${article} ${time}.`

  const day = saved.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
  return `Estás viendo el catálogo guardado del ${day}, a ${article} ${time}.`
}

/** Mientras la cola se está enviando; cadena vacía si no hay nada que enviar. */
export function salesSyncingMessage(count: number): string {
  if (count <= 0) return ''
  return count === 1 ? 'Enviando 1 venta…' : `Enviando ${count} ventas…`
}

/** Motivos por los que el carrito rechaza un cambio (espejo de `CartRefusal` en cart.store). */
export type SaleCartRefusal =
  | 'out-of-stock'
  | 'already-in-cart'
  | 'max-stock'
  | 'min-quantity'
  | 'not-in-cart'
  | 'cart-full'

/** Aviso corto y amable cuando el carrito no acepta el cambio; nunca un texto técnico. */
export function saleCartRefusalMessage(reason: SaleCartRefusal, productName?: string): string {
  const name = productName?.trim()
  switch (reason) {
    case 'out-of-stock':
      return name ? `${name} está agotado.` : 'Ese producto está agotado.'
    case 'already-in-cart':
      return name ? `${name} es una pieza única y ya está en tu venta.` : 'Esa pieza única ya está en tu venta.'
    case 'max-stock':
      return name ? `Ya no hay más piezas de ${name}.` : 'Ya no hay más piezas de ese producto.'
    case 'min-quantity':
      return 'Para quitar el producto toca «Quitar».'
    case 'not-in-cart':
      return 'Ese producto ya no está en tu venta.'
    case 'cart-full':
      return 'Tu venta ya tiene demasiados productos. Cóbrala y empieza otra.'
    default:
      return 'No pudimos hacer ese cambio. Intenta de nuevo.'
  }
}
