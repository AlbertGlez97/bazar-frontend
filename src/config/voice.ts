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
   * Qué le pasó a una petición, dicho según lo que respondió el servidor
   * (`describeApiError`, `src/utils/api-error.ts`). Un mensaje dice qué pasó y
   * qué hacer; el código HTTP se agrega aparte, para soporte.
   */
  apiErrors: {
    /** 401: el token venció; el interceptor ya cierra la sesión. */
    session: 'Tu sesión venció. Inicia sesión de nuevo para continuar.',
    /** 403 "Only socios…": la persona elegida no es socio. */
    notSocio: 'Solo los socios pueden crear o cambiar productos. Cambia de persona o pide a un socio que lo haga.',
    /**
     * 403 "Selection is not authorized…": el dispositivo o la persona guardados
     * ya no existen o ya no valen (se reinició la base, se revocó el acceso, el
     * token no coincide). Se arregla identificando el dispositivo otra vez.
     */
    contextLost: 'Este dispositivo o esta persona ya no está reconocida por el sistema (pasa si se reinició la base de datos o si alguien revocó el acceso). Vuelve a identificar el dispositivo para seguir.',
    /** Cualquier otro 403. */
    forbidden: 'No tienes permiso para hacer esto.',
    /** 400 sin un mensaje que se pueda mostrar. */
    invalid: 'Revisa los datos e intenta de nuevo.',
    /** 404 */
    notFound: 'Eso ya no existe. Actualiza la lista e intenta de nuevo.',
    /** 409 sin mensaje del servidor. */
    conflict: 'Los datos cambiaron mientras tanto. Actualiza e intenta de nuevo.',
    /** 5xx */
    server: 'El servidor tuvo un problema. Intenta de nuevo en un momento.',
    /** Validaciones conocidas del alta/edición de producto (400). */
    product: {
      name: 'Escribe el nombre del producto (hasta 200 caracteres).',
      price: 'El precio no es válido. Escribe un monto como 1,500.00 (máximo 21,474,836.47).',
      category: 'La categoría debe tener entre 1 y 100 caracteres, o déjala vacía.',
      purchaseCost: 'El costo de compra no es válido. Escribe un monto como 800.00.',
      /** 400 "purchaseCostMinor cannot be cleared once it has been set": ya tenía costo y se intentó vaciar. */
      purchaseCostLocked: 'Este producto ya tiene costo registrado: no se puede dejar vacío. Escribe un monto para actualizarlo.',
      stock: 'La existencia inicial debe ser un número entero, de 0 en adelante.',
      tipo: 'Elige si es pieza única o por cantidad.',
      supplier: 'El proveedor debe tener entre 1 y 200 caracteres, o déjalo vacío.',
      notes: 'Las notas son demasiado largas (máximo 2000 caracteres).',
    },
    /** Acciones del catálogo: qué no se pudo hacer, para el mensaje de cada acción. */
    catalog: {
      save: 'No pudimos guardar el producto.',
      deactivate: 'No pudimos desactivar el producto.',
      reactivate: 'No pudimos reactivar el producto.',
      load: 'No pudimos cargar tu catálogo.',
      search: 'No pudimos buscar.',
      page: 'No pudimos cambiar de página.',
      image: 'El producto quedó guardado, pero la foto no se pudo subir. Edítalo y vuelve a intentarlo.',
      readOnly: 'Solo los socios pueden cambiar el catálogo.',
      reidentify: 'Volver a identificar este dispositivo',
    },
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
    /** Defensivo: la opción solo aparece con exactamente una línea (D3). */
    blockedDebtInvalidCart: 'Esta opción solo está disponible con un producto a la vez en el carrito.',
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
    /**
     * Fiado/apartado registrado (D3/D4): NUNCA se parece a "Venta registrada"
     * — no hubo venta de contado, el producto se descontó del inventario al
     * crear la Deuda (independiente de /sales) y el saldo queda pendiente.
     */
    debtTitle: 'Fiado/apartado registrado',
    debtTypeFiado: 'Fiado',
    debtTypeApartado: 'Apartado',
    debtNotASale: 'No es una venta de contado: el producto ya se descontó del inventario, pero el pago queda pendiente.',
    pendingLabel: 'Saldo pendiente',
    initialAbonoLabel: 'Abono inicial registrado',
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
    // Desglose por producto y vendedor, con ganancia real (D4).
    byProduct: 'Por producto',
    columnProduct: 'Producto',
    columnUnits: 'Unidades',
    columnIncome: 'Ingreso',
    columnProfit: 'Ganancia',
    emptyProduct: 'Todavía no hay detalle de productos en este periodo.',
    // BE-15/D7: abonos recibidos y deudas liquidadas del periodo, más el total combinado.
    byAbonos: 'Abonos recibidos',
    columnDate: 'Fecha',
    columnDeudor: 'Deudor',
    columnDeudaType: 'Tipo',
    columnAmount: 'Monto',
    emptyAbonos: 'Todavía no hay abonos en este periodo.',
    byDeudasLiquidadas: 'Deudas liquidadas',
    columnSaldadaAt: 'Liquidada el',
    emptyDeudasLiquidadas: 'Todavía no hay deudas liquidadas en este periodo.',
    totalIngresadoLabel: 'Total ingresado',
    totalIngresadoHint: 'Ventas de contado + abonos reales del periodo.',
  },
  /** Inicio de Modo Gestión (solo socios): resumen del día (`GET /dashboard/summary`). */
  dashboard: {
    title: 'Inicio',
    lead: 'Un vistazo rápido a cómo va tu negocio hoy.',
    loading: 'Cargando tu resumen…',
    loadError: 'No pudimos cargar tu resumen. Intenta de nuevo en un momento.',
    forbidden: 'Este resumen es solo para socios.',
    retry: 'Intentar de nuevo',
    /** Un colaborador SÍ llega a "Inicio" (es la casa de Modo Gestión para cualquiera), pero los números son de socios. */
    notSocio: 'Los números del negocio (ventas, ganancias, deudas) son solo para socios. Mientras tanto, échale un ojo a tu catálogo de productos.',
    salesToday: 'Ventas de hoy',
    profitToday: 'Ganancia de hoy',
    incidents: 'Incidencias pendientes',
    debts: 'Deudas por cobrar',
    debtsPeople: (count: number) => (count === 1 ? '1 persona' : `${count} personas`),
    lowStock: 'Poca existencia',
    lowStockEmpty: 'Ningún producto está bajo de existencia.',
    lowStockMore: (extra: number) => (extra === 1 ? 'y 1 producto más' : `y ${extra} productos más`),
    viewReports: 'Ver reportes',
    viewProducts: 'Ver productos',
  },
  /** Lector de QR: textos fijos de la pantalla; las fallas de cámara salen de `cameraErrorMessage`. */
  scan: {
    title: 'Escanear producto',
    hint: 'Apunta la cámara al código QR del producto.',
    loading: 'Abriendo la cámara…',
    done: 'Listo',
    retry: 'Intentar de nuevo',
  },
  /** Código QR de un producto (se genera aquí mismo, sin servidor). */
  qr: {
    title: 'Código QR',
    hint: 'Es el que lee el escáner de la pantalla de venta.',
    imageAlt: (name: string) => `Código QR de ${name}`,
    download: 'Descargar QR (PNG)',
    generating: 'Preparando el código…',
    generateError: 'No pudimos generar el código QR. Cierra y vuelve a abrir el producto.',
    downloadError: 'No pudimos descargar el código QR. Intenta de nuevo.',
  },
  /** Impresión de códigos QR en hojas de etiquetas (OFITURIA A4, 72 por hoja). */
  labels: {
    select: 'Seleccionar',
    exitSelection: 'Salir de la selección',
    selectedCount: (count: number) => (count === 1 ? '1 seleccionado' : `${count} seleccionados`),
    selectAll: 'Seleccionar todos',
    selectingAll: (loaded: number, total: number) => `Seleccionando… ${loaded} de ${total}`,
    selectAllHint: 'Selecciona todos los productos activos que coinciden con tu búsqueda, de todas las páginas.',
    selectAllDone: (added: number) => (added === 1 ? 'Se seleccionó 1 producto.' : `Se seleccionaron ${added} productos.`),
    selectAllNothing: 'No hay más productos activos por seleccionar.',
    selectAllError: 'No pudimos seleccionar todos los productos.',
    clear: 'Limpiar selección',
    print: 'Imprimir códigos QR',
    checkboxLabel: (name: string) => `Seleccionar ${name} para imprimir su código QR`,
    inactiveHint: 'Un producto inactivo no tiene etiqueta.',
    dialogTitle: 'Imprimir códigos QR',
    summary: (labels: number, sheets: number) =>
      `${labels === 1 ? '1 etiqueta' : `${labels} etiquetas`} · 72 etiquetas por hoja: se generará${sheets === 1 ? '' : 'n'} ${sheets === 1 ? '1 hoja' : `${sheets} hojas`}.`,
    calibrationTitle: 'Ajuste de tu impresora',
    calibrationHint: 'Se guarda solo, para que no tengas que ajustarlo cada vez.',
    offsetTop: 'Margen superior (mm)',
    offsetLeft: 'Margen izquierdo (mm)',
    rowPitch: 'Alto de fila (mm)',
    rangeError: (min: number, max: number) => `Escribe un número entre ${min} y ${max}.`,
    reset: 'Restablecer',
    overflow: (mm: number) => `Con este alto de fila la última fila se sale ${mm} mm de la hoja: se cortará.`,
    helpTitle: 'Cómo imprimir',
    helpScale: 'Imprime al 100 % («Tamaño real»). No uses «Ajustar a la página»: cambia la escala y las etiquetas se desalinean.',
    helpCalibrate: 'Antes de gastar una hoja de etiquetas, imprime UNA en papel normal, ponla contra la luz sobre la hoja de etiquetas y mueve los márgenes hasta que coincidan. Un valor negativo mueve hacia arriba o la izquierda.',
    helpRowPitch: '12 filas de 25 mm suman 300 mm y una hoja A4 mide 297 mm: no caben. Por eso el alto de fila empieza en 24,75 mm (297 ÷ 12). Puedes escribir 25 si tu hoja lo pide, pero las últimas filas se correrán hasta 3 mm.',
    preview: 'Vista previa',
    download: 'Descargar PDF',
    working: 'Preparando tus etiquetas…',
    printError: 'No pudimos preparar tus etiquetas. Intenta de nuevo.',
    previewBlocked: 'Tu navegador bloqueó la ventana de la vista previa. Permite las ventanas emergentes o usa «Descargar PDF».',
  },
  /**
   * Pantalla "Códigos QR" (solo socios, Modo Gestión, D2): buscar productos y
   * armar la lista de impresión (copias por producto) antes de generar la hoja
   * de etiquetas. `VOICE.labels` cubre la calibración/generación (reutilizada
   * tal cual en el diálogo); este bloque es solo lo nuevo de esta pantalla.
   */
  codigosQr: {
    title: 'Códigos QR',
    lead: 'Busca tus productos, agrega cuántas etiquetas necesitas de cada uno y genera la hoja para imprimir.',
    searchLabel: 'Buscar producto',
    searchPlaceholder: 'Escribe el nombre del producto',
    searching: 'Buscando…',
    searchEmpty: 'No encontramos productos con ese nombre.',
    retry: 'Intentar de nuevo',
    add: 'Agregar',
    remove: 'Quitar',
    listTitle: 'Tu lista de impresión',
    listEmpty: 'Todavía no agregaste productos. Búscalos arriba y toca «Agregar».',
  },
  /**
   * Incidencias (P2, solo socios): conflictos de stock o fechas fuera de rango
   * que el servidor detecta solo, al procesar una venta. Se revisan y se
   * resuelven aquí; nunca se crean a mano. Detalle + resolver es un modal
   * sobre la lista (D2), no una ruta nueva.
   */
  incidencias: {
    title: 'Incidencias',
    lead: 'Revisa los conflictos de stock y las fechas fuera de rango que detectó el sistema, y anota cómo se resolvieron con el cliente.',
    loading: 'Cargando tus incidencias…',
    loadError: 'No pudimos cargar las incidencias. Intenta de nuevo en un momento.',
    forbidden: 'Las incidencias son solo para socios.',
    retry: 'Intentar de nuevo',
    empty: 'No hay incidencias con estos filtros.',
    filterTypeLabel: 'Tipo',
    filterTypeAll: 'Todos los tipos',
    typeConflictoStock: 'Conflicto de stock',
    typeIncidenciaFecha: 'Fecha fuera de rango',
    filterStatusLabel: 'Estado',
    filterStatusAll: 'Todas',
    statusPendiente: 'Pendiente',
    statusResuelta: 'Resuelta',
    searchLabel: 'Buscar por vendedor',
    searchPlaceholder: 'Nombre de quien vendió',
    sortLabel: 'Orden',
    sortDesc: 'Más recientes primero',
    sortAsc: 'Más antiguas primero',
    columnDate: 'Detectada',
    columnType: 'Tipo',
    columnStatus: 'Estado',
    columnReason: 'Motivo',
    viewDetail: 'Ver detalle',
    detailTitle: 'Detalle de la incidencia',
    detailLoading: 'Cargando el detalle…',
    detailLoadError: 'No pudimos cargar el detalle de esta incidencia.',
    saleTitle: 'Venta relacionada',
    saleMissing: 'No pudimos mostrar la venta relacionada.',
    resolutionNotesLabel: 'Notas de lo que se acordó con el cliente',
    resolutionNotesPlaceholder: 'Qué se acordó, por ejemplo: no se cobra la pieza faltante…',
    resolutionNotesRequired: 'Escribe qué se acordó (hasta 2000 caracteres).',
    resolutionNotesTooLong: 'Son demasiadas notas (máximo 2000 caracteres).',
    resolve: 'Marcar como resuelta',
    resolving: 'Guardando…',
    resolveError: 'No pudimos guardar la resolución.',
    alreadyResolved: 'Esta incidencia ya estaba resuelta (alguien más la resolvió mientras tanto). Se actualizó con lo más reciente.',
    resolvedByTitle: 'Resuelta',
    resolvedNotesTitle: 'Notas de la resolución',
    close: 'Cerrar',
  },
  /**
   * Registrar un fiado/apartado desde el cobro cuando el efectivo no alcanza
   * (D3: solo con una línea en el carrito). NO es una venta de contado: el
   * servidor descuenta el stock al crear la Deuda, sin pasar por /sales.
   */
  deuda: {
    offerTitle: 'Registrar como fiado/apartado',
    typeLabel: 'Tipo',
    typeFiado: 'Fiado (ya se entregó)',
    typeApartado: 'Apartado (se reserva)',
    nombreLabel: 'Nombre de quien debe',
    nombrePlaceholder: 'Nombre completo',
    nombreRequired: 'Escribe el nombre de quien debe.',
    telefonoLabel: 'Teléfono (opcional)',
    notasLabel: 'Notas (opcional)',
    notasPlaceholder: 'Ej. viene el sábado por su pieza',
    submit: 'Registrar',
    submitting: 'Registrando…',
    cancel: 'Cancelar',
    /** 400 genérico o sin clasificar de POST /deudas. */
    createError: 'No pudimos registrar el fiado/apartado. Revisa los datos e intenta de nuevo.',
    productDeactivated: 'Uno de los productos ya no está a la venta. Quítalo del carrito e intenta de nuevo.',
    productMissing: 'Uno de los productos ya no existe en tu catálogo. Quítalo del carrito e intenta de nuevo.',
    insufficientStock: 'Ya no hay suficientes piezas de este producto. Baja la cantidad e intenta de nuevo.',
    /**
     * BE-15: el abono inicial ahora va DENTRO de `POST /deudas` (transacción
     * atómica) — si por sí solo excede el total, no se crea nada (ni la
     * deuda). Reemplaza al viejo `abonoFailedWarning` de D4 (la llamada
     * separada a `createAbono` para el abono inicial ya no existe).
     */
    abonoInicialExceedsBalance: 'El abono inicial que escribiste es mayor al total de la deuda. Bájalo e intenta de nuevo.',
    /** D1: campo de abono inicial explícito del modal. */
    abonoInicialLabel: 'Abono inicial',
    abonoInicialHint: 'Lo que ya te pagaron al momento de registrar. Déjalo en $0.00 si no recibiste nada.',
    /** D2: sección opcional de calendario de cuotas planeadas (informativo, nunca obligatorio). */
    cuotasToggleLabel: '¿Quieres programar fechas de pago?',
    cuotasHint: 'Elige una o varias fechas; te sugerimos un monto parejo para cada una, pero puedes cambiarlo.',
    cuotasDatesLabel: 'Fechas de pago',
    cuotasRowLabel: (date: string) => `Cuota del ${date}`,
    /** Fila recién agregada, todavía sin fecha elegida en su calendario. */
    cuotasRowLabelPending: 'Monto de la cuota',
    /** D2 (rediseño de filas repetibles): un calendario + un monto por fila. */
    cuotasAddRowLabel: '+ Agregar fecha de pago',
    cuotasRemoveRowLabel: (date: string | null) => (date ? `Quitar la cuota del ${date}` : 'Quitar esta cuota'),
  },
  /**
   * Vista `/app/deudas` (solo socios, Modo Gestión): fiados/apartados
   * activos, con su calendario de cuotas y su historial de abonos. Detalle
   * como modal sobre la lista (mismo patrón que Incidencias): no hay ninguna
   * ruta `:id` en este proyecto.
   */
  deudasView: {
    title: 'Deudas',
    lead: 'Fiados y apartados: quién debe, cuánto y desde cuándo.',
    loading: 'Cargando tus deudas…',
    loadError: 'No pudimos cargar las deudas. Intenta de nuevo en un momento.',
    forbidden: 'Las deudas son solo para socios.',
    retry: 'Intentar de nuevo',
    empty: 'No hay deudas con estos filtros.',
    totalPendingLabel: 'Total pendiente por cobrar',
    totalPendingPeople: (count: number) => (count === 1 ? '1 persona' : `${count} personas`),
    filterAtrasadoLabel: 'Solo atrasadas',
    sortLabel: 'Orden',
    sortCreatedAt: 'Más recientes primero',
    sortSaldoPendiente: 'Mayor saldo primero',
    sortCuotaVencida: 'Más atrasada primero',
    searchLabel: 'Buscar por nombre',
    searchPlaceholder: 'Nombre de quien debe',
    statusPendiente: 'Activa',
    statusSaldada: 'Liquidada',
    atrasadaBadge: 'Atrasada',
    columnDeudor: 'Deudor',
    columnSaldo: 'Saldo pendiente',
    columnTotal: 'Total',
    viewDetail: 'Ver detalle',
    detailTitle: 'Detalle de la deuda',
    detailLoading: 'Cargando el detalle…',
    detailLoadError: 'No pudimos cargar el detalle de esta deuda.',
    productLabel: 'Producto',
    quantityLabel: 'Cantidad',
    abonosTitle: 'Historial de abonos',
    abonosEmpty: 'Todavía no hay abonos registrados.',
    cuotasTitle: 'Calendario de cuotas',
    cuotasEmpty: 'No se programaron fechas de pago para esta deuda.',
    registerAbonoTitle: 'Registrar abono',
    registerAbonoLabel: 'Monto del abono',
    registerAbonoRequired: 'Escribe un monto mayor a $0.00.',
    registerAbonoNotaLabel: 'Nota (opcional)',
    registerAbono: 'Registrar abono',
    registeringAbono: 'Registrando…',
    registerAbonoError: 'No pudimos registrar el abono.',
    close: 'Cerrar',
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

/**
 * Falla al cargar el resumen de Inicio (mismo patrón que `reportLoadErrorMessage`:
 * red primero, después el 403 con su propio texto). No es un alias genérico
 * porque el texto de "solo para socios" es el de `VOICE.dashboard`, no el de
 * `VOICE.reports`.
 */
export function dashboardLoadErrorMessage(cause: unknown): string {
  if (isNetworkError(cause)) return VOICE.networkError
  const status = (cause as { response?: { status?: number } } | null)?.response?.status
  return status === 403 ? VOICE.dashboard.forbidden : VOICE.dashboard.loadError
}

/**
 * Compara las ventas de hoy con las de ayer. Sin ventas ayer no hay
 * porcentaje que calcular (dividir entre 0), así que se dice el hecho en vez
 * de inventar una cifra; si además hoy tampoco hubo, no hay nada que comparar.
 */
export function dashboardVsYesterdayMessage(todayMinor: number, yesterdayMinor: number): string {
  if (yesterdayMinor === 0) return todayMinor === 0 ? 'Sin ventas, igual que ayer.' : 'Ayer no hubo ventas.'
  if (todayMinor === yesterdayMinor) return 'Igual que ayer.'
  const percent = Math.round(((todayMinor - yesterdayMinor) / yesterdayMinor) * 100)
  return `${percent > 0 ? '+' : ''}${percent}% vs. ayer`
}

/**
 * Aviso de que la ganancia de hoy no cuenta partidas sin costo capturado
 * (mismo espíritu que el aviso de ganancia parcial de Reportes: nunca se
 * estima, se dice el hueco). Cadena vacía cuando no hay ninguna partida así.
 */
export function dashboardPartialProfitMessage(lineasSinCosto: number): string {
  if (lineasSinCosto <= 0) return ''
  const linea = lineasSinCosto === 1 ? 'línea' : 'líneas'
  const incluye = lineasSinCosto === 1 ? 'incluye' : 'incluyen'
  return `Ganancia calculada solo sobre lo que ya tiene costo registrado — ${lineasSinCosto} ${linea} de hoy sin costo capturado no se ${incluye} en este número.`
}

/** Falla al cargar la lista o el detalle de Incidencias: red, permiso o genérica. Mismo patrón que `reportLoadErrorMessage`. */
export function incidenciaLoadErrorMessage(cause: unknown): string {
  if (isNetworkError(cause)) return VOICE.networkError
  const status = (cause as { response?: { status?: number } } | null)?.response?.status
  return status === 403 ? VOICE.incidencias.forbidden : VOICE.incidencias.loadError
}

/**
 * Falla al resolver una incidencia. El 409 ("ya estaba resuelta") es el único
 * caso donde no se culpa a la red ni al servidor: alguien más (otra pestaña, otro
 * socio) la resolvió mientras tanto. Nunca "des-resuelve" ni reintenta sola.
 */
export function incidenciaResolveErrorMessage(cause: unknown): string {
  if (isNetworkError(cause)) return VOICE.networkError
  const status = (cause as { response?: { status?: number } } | null)?.response?.status
  return status === 409 ? VOICE.incidencias.alreadyResolved : VOICE.incidencias.resolveError
}

/** `true` si el 400 al resolver es por el campo `resolutionNotes` (409 no es esto, ver `incidenciaResolveErrorMessage`). */
export function isIncidenciaNotesValidationError(cause: unknown): boolean {
  return (cause as { response?: { status?: number } } | null)?.response?.status === 400
}
