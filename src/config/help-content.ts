import type { HelpArticle } from '@/types/help.types'

export const CASH_HELP: HelpArticle = {
  id: 'efectivo',
  title: 'Recibir efectivo, combinar billetes y dar cambio',
  category: 'Vender',
  audience: 'all',
  keywords: ['cobrar', 'dinero', 'selección', 'billetes', 'monedas', 'justo'],
  intro: 'Efectivo recibido es el dinero que entrega el cliente, no el precio de la venta. La app calcula cuánto falta o cuánto cambio debes entregar.',
  steps: [
    'Revisa el total antes de capturar el dinero. Si el cliente entrega exactamente ese importe, toca Justo.',
    'Puedes escribir el importe en Efectivo recibido, o tocar los billetes de $20, $50, $100, $200, $500 y $1,000 y las monedas de $1, $2, $5 y $10.',
    'Cada toque agrega una pieza a su propia selección. Por ejemplo: dos toques en $100 y uno en $50 suman $250. Los contadores muestran cuántas piezas elegiste.',
    'El selector no suma sobre el importe escrito manualmente: al empezar a tocar billetes, el importe corresponde a las piezas seleccionadas. Escribir otro importe o usar Justo puede limpiar esos contadores.',
    'Limpiar selección borra el efectivo y los contadores de billetes y monedas; no quita productos del carrito.',
    'Cuando el efectivo cubra el total, revisa el cambio y toca Cobrar una sola vez. Espera el resultado antes de iniciar otra venta.',
  ],
  tips: [
    'Usa punto para centavos: 125.50. La coma sirve para miles: 1,250.50. No uses 125,50: es ambiguo y bloquea el cobro.',
    'Si el efectivo es insuficiente, revisa cuánto falta. No cambies el precio del producto para cuadrar el dinero recibido.',
  ],
}

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    id: 'acceso', title: 'Entrar por primera vez y elegir quién atiende', category: 'Comenzar', audience: 'all',
    keywords: ['login', 'contraseña', 'registro', 'solicitud', 'dispositivo', 'miembro'],
    intro: 'Para operar necesitas una cuenta aprobada y un dispositivo y una persona identificados. La solicitud de un negocio nuevo no inicia una sesión automáticamente.',
    steps: [
      'Si el negocio aún no está registrado, envía su solicitud desde la página de registro y espera la aprobación. No repitas la solicitud para intentar saltar la espera.',
      'En la pantalla de inicio de sesión, introduce las credenciales autorizadas del negocio.',
      'Si se solicita, identifica la tablet o teléfono con su acceso de dispositivo. Un socio administra estos accesos en Ajustes → Dispositivos.',
      'En un acceso compartido, elige la persona que realmente atiende en esa sesión. Una cuenta ligada a una persona usa su identidad asignada.',
      'Si el acceso o la persona está inactivo, pide al responsable que revise la situación. No selecciones otra identidad para eludir el bloqueo.',
    ],
    tips: ['No hay recuperación de contraseña desde una opción Olvidé mi contraseña. Consulta al responsable si no puedes entrar; Cambiar mi contraseña requiere una sesión abierta.'],
  },
  {
    id: 'modos', title: 'Modo Venta, Modo Gestión y permisos', category: 'Comenzar', audience: 'all',
    keywords: ['socio', 'colaborador', 'inicio', 'menú', 'ayuda'],
    intro: 'Los modos organizan las pantallas; el rol determina qué acciones puedes realizar. Cambiar a Gestión no convierte a un colaborador en socio.',
    steps: [
      'Usa Venta en el selector lateral para ir directamente a Vender. No necesitas tocar Vender una segunda vez.',
      'Usa Gestión para ir a Inicio y administrar. En una pantalla pequeña y táctil puede aparecer un aviso; confirma solo si necesitas continuar.',
      'En Venta verás Vender como referencia y como enlace para regresar desde Ajustes. En Gestión verás las secciones disponibles para tu rol.',
      'Los colaboradores pueden consultar Productos; crear o editar productos y revisar Reportes, Deudas e Incidencias son tareas de socios.',
      'El engrane del pie abre Ajustes. Ayuda, en la cabecera, está disponible para ambos roles y modos.',
    ],
    tips: ['Antes de cambiar de pantalla durante un cobro, termina o revisa tu trabajo. La ayuda de efectivo junto al carrito se abre sin salir de la venta.'],
  },
  {
    id: 'primera-venta', title: 'Hacer una primera venta de contado', category: 'Vender', audience: 'all',
    keywords: ['buscar', 'categoría', 'cuadrícula', 'lista', 'cobrar'],
    intro: 'Una venta de contado reúne productos, verifica cantidades y registra el efectivo. No basta con agregar productos para que la venta quede cobrada.',
    steps: [
      'Entra a Modo Venta. Busca el producto por su nombre y, si conviene, filtra por categoría.',
      'Elige Cuadrícula para ver las tarjetas o Lista para ver filas compactas. Las dos vistas muestran los mismos productos.',
      'Toca un producto disponible para agregarlo al carrito. Una tarjeta Agotado no se puede agregar.',
      'Revisa los productos, sus cantidades y el total. En celular, avanza al paso de cobro cuando hayas terminado de elegir.',
      'Captura Efectivo recibido, comprueba el cambio y toca Cobrar. Espera el mensaje final: no asumas éxito por ver un botón deshabilitado.',
      'Si el resultado indica pendiente, sin conexión o una respuesta incierta, consulta la sección Sin conexión antes de repetir el cobro.',
    ],
    tips: ['El precio proviene del catálogo. El carrito no ofrece un cambio de precio por venta.'],
  },
  {
    id: 'carrito', title: 'Cambiar cantidades, quitar y vaciar el carrito', category: 'Vender', audience: 'all',
    keywords: ['cantidad', 'única', 'quitar', 'vaciar', 'menos', 'más'],
    intro: 'Revisa el carrito antes de cobrar. La cantidad de piezas puede ser distinta del número de productos diferentes.',
    steps: [
      'Para un producto por cantidad, vuelve a tocarlo en el catálogo o usa el control de aumentar cantidad del carrito.',
      'No puedes superar la existencia disponible. Un producto de pieza única se agrega una sola vez.',
      'Usa el control de disminuir para corregir la cantidad. El mínimo es una pieza; para retirar el producto por completo, toca Quitar.',
      'En pantallas pequeñas puedes abrir Ver productos para comprobar las líneas sin perder de vista el cobro.',
      'Vaciar pide confirmación y elimina todos los productos y el efectivo capturado. Cancela la confirmación si solo querías corregir una línea.',
    ],
    tips: ['Limpiar selección en el efectivo no equivale a Vaciar: conserva los productos.'],
  },
  CASH_HELP,
  {
    id: 'escanear', title: 'Agregar un producto con su código QR', category: 'Vender', audience: 'all',
    keywords: ['codigo qr', 'cámara', 'escanear', 'etiqueta', 'uuid'],
    intro: 'El lector reconoce etiquetas QR de productos de La Marchanta. No es un lector de cualquier código comercial de barras.',
    steps: [
      'En Vender abre el lector de QR y permite el acceso a la cámara cuando el navegador lo solicite.',
      'Apunta a una etiqueta QR generada para un producto del negocio. El código contiene el identificador del producto.',
      'Mantén el código completo dentro del encuadre, con buena iluminación y sin reflejos.',
      'Revisa el producto encontrado y el carrito. Si el producto está agotado o no se reconoce, búscalo por nombre y verifica la etiqueta.',
    ],
    tips: ['Un código de barras de fabricante o un QR con una dirección web no sustituye al QR del producto. Si la cámara no abre, revisa sus permisos en el navegador.'],
  },
  {
    id: 'sin-conexion', title: 'Sin conexión, ventas pendientes y respuestas inciertas', category: 'Vender', audience: 'all',
    keywords: ['offline', 'internet', 'sincronización', 'pendiente', 'reintentar', 'duplicado'],
    intro: 'La app puede guardar trabajo pendiente y usar una copia del catálogo. La información local no garantiza que una operación ya fue aceptada.',
    steps: [
      'Comprueba si el catálogo indica que usa una copia guardada: sus existencias pueden no estar actualizadas.',
      'Al cobrar, lee el resultado. Una operación guardada o pendiente debe sincronizarse; no equivale a una confirmación definitiva.',
      'Si se corta la conexión o no sabes si se recibió el cobro, no repitas la venta por impulso. Revisa el indicador de pendientes y el resultado disponible.',
      'Vuelve a conectarte y revisa la sincronización. Si aparece Reintentar, úsalo para el pendiente indicado, no para crear otro cobro idéntico.',
      'Los fiados y apartados guardados de otra sesión necesitan la cuenta y el dispositivo originales. Vuelve a ese contexto para sincronizarlos.',
    ],
    tips: ['Guardar una venta sin conexión no confirma su aceptación ni asegura que la existencia siga disponible. Un conflicto puede requerir revisión de un socio.'],
  },
]

/** Audit evidence is never rendered or indexed as reader-facing help text. */
export const HELP_EVIDENCE: Readonly<Record<string, readonly string[]>> = {
  acceso: ['src/views/SelectContextView.vue', 'src/stores/auth.store.ts'],
  modos: ['src/layouts/AppLayout.vue', 'src/layouts/nav-items.ts'],
  'primera-venta': ['src/views/sales/SaleView.vue', 'src/components/ui/organisms/SaleCatalogPicker.vue'],
  carrito: ['src/components/ui/organisms/SaleCart.vue', 'src/stores/cart.store.ts'],
  efectivo: ['src/components/ui/molecules/CashInput.vue', 'src/components/ui/molecules/CashDenominationPad.vue', 'src/utils/money.ts'],
  escanear: ['src/views/sales/SaleView.vue'],
  'sin-conexion': ['src/stores/sales-queue.store.ts', 'src/services/sales-sync.ts'],
}
