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
   * Identificar el dispositivo (POST /devices/identify). Tres situaciones
   * distintas, con textos distintos: el identificador ya se usó (409), los datos
   * no coinciden con ningún dispositivo (403) o no se pudo verificar.
   */
  device: {
    /** 409: el identificador es de un solo uso y ya se gastó (o el equipo se revocó). */
    alreadyUsed: 'Este identificador ya fue usado. Pide a un socio que te genere uno nuevo.',
    /** 403: identificador o nombre que no coinciden con ningún dispositivo del negocio. */
    notRegistered: 'Este dispositivo no está registrado con nosotros todavía. Contacta a soporte.',
    /** Cualquier otra falla al verificar (red, servidor). */
    verifyFailed: 'No pudimos verificar el dispositivo. Intenta de nuevo en un momento.',
  },
  /**
   * Cuenta ligada a una persona que ya no puede entrar (miembro desactivado): se
   * dice qué pasó y a quién acudir; no hay nada que elegir ni reintentar.
   */
  accountInactive: {
    title: 'Tu acceso está desactivado',
    body: 'Tu usuario existe, pero tu acceso al negocio fue desactivado. Habla con un socio para que lo reactive.',
    signOut: 'Cerrar sesión',
  },
  /** Pantalla de ajustes (engrane de la barra lateral). */
  settings: {
    title: 'Ajustes',
    lead: 'Tu cuenta y, si eres socio, tu equipo y los dispositivos del negocio.',
  },
  /** Dispositivos (solo socios): lista, registrar, revocar y reemitir. */
  devices: {
    title: 'Dispositivos',
    lead: 'Las tablets y teléfonos que usan tu negocio. Registra uno nuevo, o revoca o reemite el acceso de uno que ya existe.',
    register: 'Registrar dispositivo',
    loading: 'Cargando tus dispositivos…',
    loadError: 'No pudimos cargar tus dispositivos. Intenta de nuevo en un momento.',
    retry: 'Intentar de nuevo',
    forbidden: 'Solo un socio puede administrar los dispositivos.',
    notFound: 'Ese dispositivo ya no existe. Actualizamos la lista.',
    badName: 'Escribe el nombre del dispositivo.',
    badEmail: 'Escribe un correo válido, por ejemplo nombre@dominio.com',
    invalid: 'Revisa los datos e intenta de nuevo.',
    /** 502: el correo no salió, así que el servidor no cambió nada (con o sin acceso anterior). */
    emailFailed: 'No pudimos enviar el correo con el código, así que no se hizo ningún cambio. Intenta de nuevo, o hazlo sin correo y comparte el código tú mismo.',
  },
  /** Mi equipo (solo socios): lista de personas y alta (POST /members). */
  team: {
    title: 'Mi equipo',
    lead: 'Las personas que trabajan contigo. Agrega a un socio o a un colaborador y recibirá su acceso por correo.',
    add: 'Agregar persona',
    empty: 'Todavía no hay personas en tu equipo.',
    loading: 'Cargando tu equipo…',
    loadError: 'No pudimos cargar tu equipo. Intenta de nuevo en un momento.',
    forbidden: 'Esta pantalla es solo para socios.',
    retry: 'Intentar de nuevo',
    badName: 'Escribe el nombre.',
    badLastName: 'Escribe los apellidos.',
    badEmail: 'Escribe un correo válido, por ejemplo nombre@dominio.com',
    badCommission: 'Escribe un porcentaje entre 0 y 100, con hasta 2 decimales. Ejemplo: 10 o 12.5.',
    createInvalid: 'Revisa los datos e intenta de nuevo.',
    createForbidden: 'Solo un socio puede agregar personas.',
    createUsername: 'No pudimos asignarle un usuario a esa persona. Intenta de nuevo en un momento.',
    createEmailFailed: 'No pudimos enviar el correo con las credenciales, así que no se creó a la persona. Intenta de nuevo.',
  },
  /**
   * Cambiar mi contraseña (POST /auth/change-password). Las tres respuestas del
   * servidor se explican con texto propio y nunca con el crudo (viene en inglés).
   */
  changePassword: {
    /** 403: la contraseña actual no coincide (a propósito no es un 401). */
    wrongCurrent: 'La contraseña actual no es correcta.',
    /** 400: la nueva es igual a la actual. */
    sameAsCurrent: 'La contraseña nueva debe ser distinta a la actual.',
    /** 400: largo fuera de 10-128 caracteres. */
    badLength: 'Usa entre 10 y 128 caracteres.',
    /** 400 que no supimos clasificar. */
    invalidNew: 'No pudimos aceptar esa contraseña nueva. Usa entre 10 y 128 caracteres y que sea distinta a la actual.',
    success: 'Listo, tu contraseña cambió. Úsala la próxima vez que inicies sesión.',
  },
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
    cashUnclear: 'No entendimos ese monto. Escríbelo así: 1,000.50 (coma para los miles, punto para los centavos).',
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
  /** Reportes de ventas (solo socios, Modo Gestión) y sus descargas. */
  reports: {
    title: 'Reportes de ventas',
    lead: 'Elige un periodo para ver cuánto se vendió y quién vendió. Después baja el detalle en PDF o Excel.',
    periodLabel: 'Periodo',
    presets: { hoy: 'Hoy', ayer: 'Ayer', semana: 'Esta semana', mes: 'Este mes' },
    from: 'Desde',
    to: 'Hasta',
    apply: 'Actualizar',
    loading: 'Cargando tu reporte…',
    loadError: 'No pudimos cargar el reporte. Intenta de nuevo en un momento.',
    forbidden: 'Este reporte es solo para socios.',
    retry: 'Intentar de nuevo',
    empty: 'Todavía no hay ventas en este periodo.',
    totalLabel: 'Total vendido',
    byPerson: 'Por persona',
    columnPerson: 'Persona',
    columnRole: 'Rol',
    columnTotal: 'Total vendido',
    columnShare: '% del total',
    downloadPdf: 'Descargar PDF',
    downloadExcel: 'Descargar Excel',
    preparing: 'Preparando tu archivo…',
    downloadError: 'No pudimos preparar tu archivo. Intenta de nuevo en un momento.',
    mismatch: 'Mientras preparábamos tu archivo se registraron ventas y sus cifras ya no coinciden con las de la pantalla. Toca «Actualizar» y descárgalo otra vez.',
    truncated: 'Este periodo tiene más ventas de las que caben en un archivo, así que el detalle puede estar incompleto. Elige un periodo más corto.',
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
 * Mensaje (y gravedad) de una falla al identificar el dispositivo. El 409 usa el
 * mensaje que manda el servidor cuando es un texto no vacío (ya viene en español
 * y distingue "ya usado" de "revocado"); si no, el de respaldo. Se muestra como
 * aviso, no como error, y nunca incluye el identificador que se escribió.
 */
export function deviceIdentifyError(cause: unknown): { message: string; type: 'warning' | 'error' } {
  const response = (cause as { response?: { status?: number; data?: { message?: unknown } } } | null)?.response
  if (response?.status === 409) {
    const message = response.data?.message
    return {
      message: typeof message === 'string' && message.trim() ? message : VOICE.device.alreadyUsed,
      type: 'warning',
    }
  }
  return {
    message: response?.status === 403 ? VOICE.device.notRegistered : VOICE.device.verifyFailed,
    type: 'error',
  }
}

/**
 * Qué salió mal al cambiar la contraseña y en qué campo mostrarlo. El 403 va en
 * la contraseña actual (y no cierra la sesión); el 400 en la nueva, con el motivo
 * cuando el servidor lo deja adivinar; lo demás es red o falla genérica.
 */
export function changePasswordError(
  cause: unknown,
): { field: 'currentPassword' | 'newPassword' | null; message: string } {
  if (isNetworkError(cause)) return { field: null, message: VOICE.networkError }
  const response = (cause as { response?: { status?: number; data?: { message?: unknown } } }).response
  if (response?.status === 403) return { field: 'currentPassword', message: VOICE.changePassword.wrongCurrent }
  if (response?.status === 400) {
    const raw = response.data?.message
    const text = (Array.isArray(raw) ? raw.join(' ') : typeof raw === 'string' ? raw : '').toLowerCase()
    if (/different|same|distinct/.test(text)) return { field: 'newPassword', message: VOICE.changePassword.sameAsCurrent }
    if (/characters|length|longer|shorter/.test(text)) return { field: 'newPassword', message: VOICE.changePassword.badLength }
    return { field: 'newPassword', message: VOICE.changePassword.invalidNew }
  }
  return { field: null, message: VOICE.genericError }
}

/** Campos del alta de una persona que el servidor puede señalar. */
export type CreateMemberField = 'nombre' | 'apellidos' | 'correo' | 'commission'

/**
 * Qué salió mal al agregar a una persona: los campos que el servidor señala (un
 * 400 trae una lista de mensajes en inglés con el nombre de cada propiedad) y, si
 * no hay ninguno reconocible, un mensaje general. Nunca el texto crudo. El 502
 * dice "no se creó" porque el servidor revierte todo cuando el correo no sale.
 */
export function createMemberError(
  cause: unknown,
): { fields: Partial<Record<CreateMemberField, string>>; message: string | null } {
  if (isNetworkError(cause)) return { fields: {}, message: VOICE.networkError }
  const response = (cause as { response?: { status?: number; data?: { message?: unknown } } }).response
  switch (response?.status) {
    case 403: return { fields: {}, message: VOICE.team.createForbidden }
    case 409: return { fields: {}, message: VOICE.team.createUsername }
    case 502: return { fields: {}, message: VOICE.team.createEmailFailed }
    case 400: {
      // Cada mensaje de validación empieza con el nombre de su propiedad
      // ("nombre must be…"); el del correo es un texto en español propio. Se mira
      // el inicio de cada mensaje, no cualquier parte: "nombre@dominio.com" dentro
      // del mensaje del correo no significa que el nombre esté mal.
      const raw = response.data?.message
      const messages = (Array.isArray(raw) ? raw : [raw])
        .filter((m): m is string => typeof m === 'string')
        .map((m) => m.trim().toLowerCase())
      const fields: Partial<Record<CreateMemberField, string>> = {}
      for (const message of messages) {
        if (/^correo\b|^escribe un correo|\bemail\b/.test(message)) fields.correo = VOICE.team.badEmail
        else if (/^nombre\b/.test(message)) fields.nombre = VOICE.team.badName
        else if (/^apellidos\b/.test(message)) fields.apellidos = VOICE.team.badLastName
        else if (/^commissionratebps\b/.test(message)) fields.commission = VOICE.team.badCommission
      }
      return Object.keys(fields).length
        ? { fields, message: null }
        : { fields: {}, message: VOICE.team.createInvalid }
    }
    default: return { fields: {}, message: VOICE.genericError }
  }
}

/** Campos del formulario de dispositivo que el servidor puede señalar. */
export type DeviceAdminField = 'name' | 'correoEnvio'

/**
 * Qué salió mal al administrar un dispositivo (listar, registrar, revocar,
 * reemitir): los campos que el servidor señala en un 400 (por el inicio de cada
 * mensaje: el del correo es un texto en español propio, el del nombre empieza por
 * "name") o un mensaje general. Nunca el texto crudo.
 */
export function deviceAdminError(
  cause: unknown,
): { fields: Partial<Record<DeviceAdminField, string>>; message: string | null } {
  if (isNetworkError(cause)) return { fields: {}, message: VOICE.networkError }
  const response = (cause as { response?: { status?: number; data?: { message?: unknown } } }).response
  switch (response?.status) {
    case 403: return { fields: {}, message: VOICE.devices.forbidden }
    case 404: return { fields: {}, message: VOICE.devices.notFound }
    case 502: return { fields: {}, message: VOICE.devices.emailFailed }
    case 400: {
      const raw = response.data?.message
      const messages = (Array.isArray(raw) ? raw : [raw])
        .filter((m): m is string => typeof m === 'string')
        .map((m) => m.trim().toLowerCase())
      const fields: Partial<Record<DeviceAdminField, string>> = {}
      for (const message of messages) {
        if (/^escribe un correo|^correoenvio\b|\bemail\b/.test(message)) fields.correoEnvio = VOICE.devices.badEmail
        else if (/^name\b/.test(message)) fields.name = VOICE.devices.badName
      }
      return Object.keys(fields).length
        ? { fields, message: null }
        : { fields: {}, message: VOICE.devices.invalid }
    }
    default: return { fields: {}, message: VOICE.genericError }
  }
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

/** Rango de fechas que no se puede consultar: qué pasa y qué hacer (el servidor respondería 200 con ceros a un rango invertido). */
export function reportRangeMessage(problem: 'incomplete' | 'inverted' | 'future'): string {
  switch (problem) {
    case 'incomplete':
      return 'Escribe las dos fechas para ver el reporte.'
    case 'inverted':
      return 'La fecha inicial es posterior a la final. Cámbialas para ver el reporte.'
    case 'future':
      return 'La fecha final no puede ser de mañana en adelante. Elige hasta hoy.'
  }
}

/** Falla al cargar un reporte: red, permiso o genérica. Nunca el texto crudo del servidor (viene en inglés). */
export function reportLoadErrorMessage(cause: unknown): string {
  if (isNetworkError(cause)) return VOICE.networkError
  const status = (cause as { response?: { status?: number } } | null)?.response?.status
  return status === 403 ? VOICE.reports.forbidden : VOICE.reports.loadError
}

/**
 * Falla al preparar un archivo. Solo es "red" si fue una petición de Axios que no
 * obtuvo respuesta (al reunir el detalle de ventas); cualquier otra falla
 * (generar el PDF/Excel, cargar su módulo) no es culpa del internet de nadie.
 */
export function reportDownloadErrorMessage(cause: unknown): string {
  const failure = cause as { isAxiosError?: boolean; response?: unknown } | null
  return failure?.isAxiosError && !failure.response ? VOICE.networkError : VOICE.reports.downloadError
}

/** Confirma la descarga con un hecho concreto: el nombre del archivo. */
export function reportDownloadDoneMessage(filename: string): string {
  return `Listo, se descargó ${filename}.`
}
