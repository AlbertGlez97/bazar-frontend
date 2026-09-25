# Guía de marca: La Marchanta

Guía corta y práctica para que las vistas nuevas se vean y suenen igual que las actuales. La fuente de verdad del color es `src/assets/main.css`; la del nombre y el color de marca del manifest, `src/config/app.ts`.

## 1. Qué es la marca

"Marchanta" es como los vendedores de mercado le dicen, con cariño, a quien les compra: *"¿qué le damos, marchanta?"*. El producto es para dueños de changarros, bazares y tianguis: gente que vende de tú a tú y con confianza, no una corporación fría.

- **Se siente**: cálida, directa, con humor de verdad y sin disfraz.
- **No es**: sombreros, charros, "picante" para gringos, ni la fintech azul de siempre.
- **Referencia visual**: un puesto de mercado real. Toldo a rayas, papel de estraza, barro cocido, nopal, maíz. Colores vivos pero no saturados, y una tipografía con carácter que sigue siendo legible.

## 2. Color

Los componentes usan solo **tokens semánticos** (`var(--color-*)`). Ningún `.vue` fija un hex ni un `rgb()`: lo vigila `src/config/__tests__/no-hardcoded-colors.test.ts`. La escala cruda (`--crema-*`, `--terracota-*`, ...) solo se usa dentro de `main.css`.

### Escala cruda

| Familia | Tokens (hex) | Papel |
|---|---|---|
| Crema (papel de estraza) | `50 #fffdf9` `100 #faf4e8` `200 #f2e8d5` `300 #eadfcb` `400 #e3d5bc` `600 #8c7a62` | Neutros cálidos |
| Café | `600 #75604e` `700 #6a5443` `900 #2b1d14` | Texto y superficie oscura |
| Terracota | `100 #f9e3d2` `600 #b8501c` `700 #983e12` | Color de marca, acciones |
| Maíz / mostaza | `100 #fbebc0` `400 #f0b429` `800 #8a5300` | Acento cálido |
| Nopal | `100 #dff0df` `700 #2f6b3f` | Éxito, secundario |
| Chile | `100 #fbe4e1` `700 #b3261e` | Errores y acciones destructivas |
| Talavera | `100 #ddeff4` `700 #1d6a82` | Solo informativo, con moderación |
| Rosa mexicano | `600 #d81b75` | Detalle decorativo. Nunca es color de acción |

### Tokens semánticos y contraste (WCAG AA)

Mínimos: 4.5:1 texto normal, 3:1 texto grande y componentes de UI. Las cifras salen de `brand-tokens.test.ts`, que lee `main.css` y **falla** si un par baja del mínimo. Si añades un par nuevo, agrégalo a la tabla `pairs` de ese test.

| Uso | Primer plano | Fondo | Ratio |
|---|---|---|---|
| Texto | `--color-text` `#2b1d14` | `--color-bg` `#faf4e8` | 14.88 |
| Texto | `--color-text` | `--color-surface` `#fffdf9` | 16.04 |
| Texto | `--color-text` | `--color-surface-alt` `#f2e8d5` | 13.41 |
| Texto secundario | `--color-text-muted` `#6a5443` | `--color-bg` | 6.47 |
| Texto secundario | `--color-text-muted` | `--color-surface-alt` | 5.83 |
| Placeholder, notas | `--color-text-subtle` `#75604e` | `--color-bg` | 5.42 |
| Placeholder, notas | `--color-text-subtle` | `--color-surface` | 5.84 |
| Botón primario | `--color-on-primary` `#ffffff` | `--color-primary` `#b8501c` | 5.00 |
| Botón primario (hover) | `--color-on-primary` | `--color-primary-hover` `#983e12` | 6.92 |
| Enlace / texto de marca | `--color-primary` | `--color-surface` | 4.92 |
| Enlace / texto de marca | `--color-primary` | `--color-bg` | 4.56 |
| Marca suave | `--color-primary-hover` | `--color-primary-soft` `#f9e3d2` | 5.59 |
| Acento | `--color-on-accent` `#2b1d14` | `--color-accent` `#f0b429` | 8.74 |
| Acento suave | `--color-text` | `--color-accent-soft` `#fbebc0` | 13.77 |
| Éxito | `--color-success` `#2f6b3f` | `--color-success-soft` `#dff0df` | 5.36 |
| Éxito sólido | `--color-on-primary` | `--color-success` | 6.37 |
| Error | `--color-danger` `#b3261e` | `--color-danger-soft` `#fbe4e1` | 5.38 |
| Error sólido | `--color-on-primary` | `--color-danger` | 6.54 |
| Aviso | `--color-warning` `#8a5300` | `--color-warning-soft` `#fbebc0` | 5.35 |
| Informativo | `--color-info` `#1d6a82` | `--color-info-soft` `#ddeff4` | 5.16 |
| Rosa (decorativo) | `--color-rosa` `#d81b75` | `--color-surface` | 4.77 |
| Sidebar | `--color-sidebar-text` `#eadfcb` | `--color-sidebar-bg` `#2b1d14` | 12.35 |
| Sidebar, activo | `--color-sidebar-active` `#f0b429` | `--color-sidebar-bg` | 8.74 |
| Borde de campo (UI) | `--color-border-strong` `#8c7a62` | `--color-surface` | 4.07 |
| Anillo de foco (UI) | `--color-focus-ring` `#983e12` | `--color-bg` | 6.32 |

Además: `--color-border` (`#e3d5bc`) es solo decorativo (divisores de tarjetas); todo control interactivo usa `--color-border-strong`. Los fondos suaves y los bordes translúcidos se derivan con `color-mix()` de los mismos tokens, y el texto que va encima siempre es el del par documentado. El rosa mexicano no lleva texto pequeño: solo detalles (subrayado ondulado, chip, badge).

**Reglas**
- La acción principal de una pantalla es terracota. Máximo una por vista.
- Chile (rojo) solo comunica error o acción destructiva; nunca decora.
- Talavera y rosa aparecen poco: si una pantalla tiene los dos, sobra uno.
- El color nunca es la única señal: acompáñalo de texto o icono.
- El tema del navegador y el `theme_color` del manifest son `--color-primary`; el `background_color` es `--color-bg` (`THEME_COLOR` y `BACKGROUND_COLOR` en `src/config/app.ts`, comprobado por test).

### Espaciado, radios y sombras

Tokens en `main.css`: `--spacing-xs..2xl` (4, 8, 16, 24, 32, 48 px), `--radius-sm/md/lg/xl/full` (6, 10, 16, 20, pastilla), `--shadow-sm/md/lg/pop` (tinte café, no negro puro). Foco visible: `outline: 3px solid var(--color-focus-ring)` con `outline-offset: 2px` (global, con `:focus-visible`).

## 3. Tipografía

| Token | Familia | Uso |
|---|---|---|
| `--font-display` | **Bricolage Grotesque** 700 / 800 | Logotipo, `h1`–`h3`, cifras destacadas |
| `--font-body` | **Figtree** 400 / 500 / 600 / 700 | Todo lo demás |

**Por qué**
- *Bricolage Grotesque*: grotesca con personalidad (terminales y proporciones un poco "rotuladas", como el letrero pintado de un puesto), pero moderna y nítida a tamaños grandes. Da carácter sin caer en tipografía "mexicana" de folleto turístico.
- *Figtree*: geométrica amable, muy legible en pantallas pequeñas y con números claros (importantes para precios y totales).
- Dos familias, cuatro pesos en total: carga ligera y jerarquía suficiente.

**Carga** (`index.html`): `preconnect` a `fonts.googleapis.com` y `fonts.gstatic.com`, una sola hoja con `display=swap` y solo los pesos usados. Google sirve por subconjuntos, así que el latino (con `ñ` y acentos) es lo único que se descarga. El service worker ya cachea Google Fonts (`vite.config.ts`, `CacheFirst` un año). Sin red se usa el fallback del sistema: `'Trebuchet MS', 'Segoe UI', system-ui` para títulos y `'Segoe UI', system-ui` para texto.

`h1`–`h3` ya heredan `--font-display` desde `main.css`; no lo repitas en cada vista. Texto de interfaz: mínimo 14 px, 12 px solo para notas secundarias.

## 4. Logotipo

Componente: `src/components/ui/atoms/BrandLogo.vue` (exportado desde `@/components`). Archivos: `public/favicon.svg` y los PNG de `public/icons/`.

**Idea**: un puesto de mercado. La losa terracota lleva un **toldo** de cuatro franjas maíz y crema con festón, y debajo una **M** gruesa. El nombre va en Bricolage Grotesque 800, con espaciado ligeramente cerrado. El mismo toldo aparece como franja decorativa (`.brand-awning`) en las pantallas públicas y de acceso.

**Uso**
- `<BrandLogo />` completo (isotipo + nombre) sobre fondos claros; `tone="inverse"` sobre fondos oscuros (barra lateral); `variant="mark"` solo isotipo (barra colapsada, espacios cuadrados).
- Si el logo va dentro de un enlace, el enlace lleva `aria-label` con el nombre (`APP_NAME`) y un anillo de foco visible. El isotipo es decorativo (`aria-hidden`).
- **Zona de respeto**: al menos la mitad del alto del isotipo libre en todos los lados.
- **Tamaño mínimo**: isotipo de 24 px; logo completo de 96 px de ancho.
- **No**: recolorear las franjas, rotar, añadir sombras, estirar, poner el nombre en otra tipografía ni usar el isotipo sobre terracota (se pierde la losa).
- Dónde se usa: `AuthLayout` (enlace a `/`), `PublicLayout` (landing, registro, selección de contexto; enlace a `/` y pie), `AppLayout` (enlace a `/app`, expandido y colapsado).

**Iconos PWA**: se generan a partir de `public/favicon.svg` (renderizado a PNG con Edge). `192.png` y `512.png` llevan la losa a sangre con esquinas redondeadas y fondo transparente. `maskable-512.png` y `apple-touch-180.png` llevan la losa centrada (62 % y 73 % del lienzo, dentro de la zona segura de máscara) sobre café `#2b1d14`, para que las franjas crema se distingan. Si cambias el diseño, regenera los cuatro y revísalos a la vista.

## 5. Voz

**Principios**
1. **Claridad primero.** Un error dice qué pasó y qué hacer. La gracia nunca tapa la información.
2. **De tú, siempre.** Cercano y directo (tuteo neutro de México, sin voseo: "recarga", no "recargá").
3. **Frases cortas, verbo primero.** "Escribe tu usuario." mejor que "El usuario es requerido".
4. **Un toque mexicano por pantalla, como mucho.** "Pásale", "¿Le entramos?", "Échale un ojo". Sin albures ni modismos que un cliente de otra región no entienda.
5. **Honesta.** No prometemos lo que no existe. Hoy un socio no puede dar de alta dispositivos, así que jamás sugerimos que puede; el final honesto es "Contacta a soporte." Nada de testimonios, cifras ni funciones inventadas.
6. **Sin exclamaciones de relleno ni "¡Éxito!".** Se confirma con un hecho concreto.

**Ejemplos**

| Situación | Sí | No |
|---|---|---|
| Login | "Pásale" / "Entra con el usuario y la contraseña de tu negocio." | "Bienvenido de vuelta. Ingresa tus credenciales para continuar" |
| Campo vacío | "Escribe tu usuario." | "El usuario es requerido" |
| Credenciales malas | "Ese usuario o contraseña no coincide. Revísalos e intenta de nuevo." | "Error 401" |
| Dispositivo no autorizado | "Este dispositivo no está registrado con nosotros todavía. Contacta a soporte." | "Solicita a un socio que lo autorice desde ajustes" (no existe) |
| Error de red | "No pudimos conectarnos. Revisa tu internet e intenta de nuevo." | "Error de red" |
| Sin resultados | "No encontramos productos por aquí." | "No se encontraron resultados." |
| Éxito de guardado | "Listo, ya quedó en tu catálogo." | "¡Éxito! Operación completada." |
| **Venta cobrada (patrón)** | "Venta anotada: $250.00. Cambio: $50.00. Quedó a nombre de Carlos." | "¡Éxito! La venta se registró correctamente." |
| Venta guardada sin internet | "Listo, ya quedó. Sin señal, pero tu venta está guardada y se manda sola cuando haya internet." | "Error de red: la venta no se envió." |
| Venta que no se pudo cobrar (conflicto) | "Esta venta no se pudo cobrar. Otra venta se llevó la última pieza... Si ya cobraste, devuelve el dinero y no entregues el producto. Avisa a un socio." | "Error 409: conflicto de inventario." |
| Tocar algo que no se puede | "Radio vintage es una pieza única y ya está en tu venta." / "Ya no hay más piezas de Café." | "already-in-cart" / "Stock máximo alcanzado" |
| QR que no es de un producto | "No reconocemos ese código. Prueba con otro producto o búscalo por su nombre." | "QR inválido." |
| Cámara sin permiso | "Necesitamos tu permiso para usar la cámara. Actívalo en los ajustes del navegador y vuelve a intentar." | "NotAllowedError" |

**Patrón de venta cobrada**: hecho concreto primero (qué se anotó y cuánto), luego el dato útil (cambio, a nombre de quién). Ya existe como función: `saleSuccessMessage()` en `src/config/voice.ts`, con tests. Las vistas de venta deben usarla en vez de escribir el texto a mano. La pantalla de venta confirma con un título de hecho, **sin exclamaciones** ("Venta registrada"), y deja el resumen de `saleSuccessMessage()` como línea pequeña.

**Tono calmado sin internet**: quedar sin señal no es un error de quien vende. La venta guardada en el dispositivo se comunica como un logro ("Listo, ya quedó") y explica qué pasa después ("se manda sola"). El indicador de la cola habla de "ventas pendientes de sincronizar" (única aparición permitida de "sincronizar", en una pastilla pequeña), nunca de "fallo". Lo que el servidor rechazó al enviar se separa como nota aparte ("N ventas necesitan que las revises") y jamás culpa a la persona: se explica con un motivo amable y se descarta con "Entendido" una vez leído. El texto crudo del servidor (en inglés, con ids) no se muestra nunca.

**Textos compartidos**: `VOICE.genericError` (fallo desconocido), `VOICE.networkError` y `isNetworkError()` (sin respuesta del servidor) en `src/config/voice.ts`.

## 6. Formularios

El **formulario de registro de negocio** (`BusinessRegistrationForm`) es el primero que usa **VeeValidate + Zod**. Esquema: `src/validation/business-registration.schema.ts`; prueba de reglas: `src/validation/__tests__/`.

- **Contrato** (`POST /business-registration`): `{ nombreNegocio 1..200, nombre 1..100, apellidos 1..100, correo válido ≤254, telefono? 1..30 }`. Un campo desconocido es 400, por eso `telefono` se omite del cuerpo cuando está en blanco.
- **Cuándo aparece cada error**: al salir del campo (blur). Si el campo ya tiene error, se revalida mientras se escribe, para que desaparezca en cuanto se corrige. Tras el primer intento de envío, todo se valida al escribir. El envío se rechaza mientras haya errores y el foco va al primer campo inválido. Cada mensaje es específico de su regla y vive junto al esquema.
- **Accesibilidad**: label asociado con `useFieldId`; con error el campo lleva `aria-invalid="true"` y `aria-describedby` apuntando al mensaje (AppInput lo hace solo, y conserva una pista propia).
- **Pendiente**: botón deshabilitado con spinner, campos bloqueados, texto "Enviando tu solicitud…" (`role="status"`) y guarda contra doble envío.
- **Errores del servidor**: un 400 que habla del correo se muestra bajo el campo con el texto de la marca (el del servidor viene en inglés); cualquier otro, un aviso con `VOICE.genericError` o `VOICE.networkError`. `message` puede ser string o arreglo.
- **Teléfono (opcional, México)**: se normalizan espacios, guiones, puntos y paréntesis y debe cumplir `^(?:(?:\+?52)1?)?[2-9]\d{9}$`, es decir 10 dígitos con clave de área que empieza en 2-9, con `+52`/`52` opcional y el "1" móvil heredado tolerado. Fuente: el Plan Técnico Fundamental de Numeración del IFT, que desde el 3 de agosto de 2019 impone la marcación nacional uniforme a 10 dígitos y elimina los prefijos 01/044/045 y el "1" móvil (Infobae, 20 jun 2019; Wikipedia, *Telephone numbers in Mexico*). Se contrastó con `libphonenumber-js` (`isValidPhoneNumber(x, 'MX')`) en 18 casos y coincide, salvo el "+52 1" heredado que la librería ya rechaza y aquí se tolera. No se añadió la librería (~cientos de KB con metadata) porque una expresión de 10 dígitos basta. Lo que se envía es lo que la persona escribió, recortado.

**Recomendación: VeeValidate + Zod es el estándar para formularios NUEVOS.** Da un esquema tipado que se prueba sin montar la UI, mensajes en un solo lugar y modos de validación probados, en vez de repetir `validateX()` a mano en cada vista. **No se migran los existentes** (`LoginView`, `ProductForm`, `DeviceIdentifyForm`): su validación manual funciona y está cubierta por tests; se migran solo cuando se toquen por otra razón. (El formulario de contacto simulado de la landing se eliminó, así que no queda nada por migrar ahí.)

**Versiones**: `vee-validate` 4.15.1 (última estable) no soporta Standard Schema (solo la beta 5.x), así que se usa `@vee-validate/zod` (`toTypedSchema`), que exige `zod` ^3.24: `zod` 3.25.76. Cuando vee-validate 5 sea estable, el adaptador sobra y se puede pasar a `zod` 4.

## 7. Interacción

Tres piezas que se repiten en toda la app: el selector de modo, el aviso no bloqueante y el tamaño mínimo de lo que se toca.

### Modo Venta y Modo Gestión

Dos presentaciones de la misma app, no dos apps. **Venta** es la vista de mostrador: táctil, grande y visual. **Gestión** es la de administrar (editar, desactivar, dar de alta).

- **Solo se sugiere, nunca se decide.** La primera vez, un dispositivo táctil de pantalla pequeña (`pointer: coarse` o `maxTouchPoints > 0`, y viewport de menos de 900 px) arranca en Venta; todo lo demás, en Gestión. La sugerencia se guarda en ese momento y, desde entonces, **manda la preferencia guardada**: nunca se pisa con una nueva sugerencia. Un valor guardado inválido se trata como si no hubiera.
- **Se puede cambiar cuando quieras** con el selector de la barra lateral (bajo el logo). Con la barra colapsada se vuelve una columna de íconos de 44x44 px con nombre accesible ("Modo Venta", "Modo Gestión"). Cambiar a Venta no avisa jamás; cambiar a Gestión avisa solo en un dispositivo táctil de pantalla pequeña (ver el patrón de abajo).
- **Nunca ambiguo**: la cabecera muestra siempre una etiqueta con el modo activo ("Modo Venta" en maíz, "Modo Gestión" en gris). Es texto y color, no solo color.
- **Qué cambia en el catálogo** (`ProductCatalogGrid` recibe `mode`; la vista lee el store y se lo pasa):

| | Gestión (como siempre) | Venta |
|---|---|---|
| Tarjetas | Normales | Grandes: imagen 4:3, nombre y precio grandes (precio en `--font-display`) |
| Disponibilidad | "Disponible" / "Agotado" / "N en existencia" | Solo "Disponible" / "Agotado" |
| Acciones (editar, desactivar, reactivar) | Solo socios | Ocultas para todos, socios incluidos |
| "Mostrar inactivos" y "+ Nuevo producto" | Solo socios | Ocultos; el catálogo se pide solo con productos activos |
| Buscador | Normal | Grande (56 px) y siempre visible arriba |
| Paginación | Normal | Botones de 44x44 px |

  La regla de colaborador (sin acciones de gestión) es independiente del modo y sigue igual en ambos. Costo y proveedor no se muestran en ningún modo.

### Aviso no bloqueante

Cuando una acción **es válida pero probablemente no es lo que la persona quiere**, se avisa; no se prohíbe. El patrón:

1. **Avisa** con una pregunta clara en el título, no con un error.
2. **Explica** por qué en dos o tres frases cortas, en tono cálido y de tú, sin regañar ni asustar.
3. **Da dos salidas explícitas y del mismo tamaño**: seguir ("Entiendo, quiero seguir") o cancelar ("Mejor no"). El botón principal (terracota) es la opción segura; la otra va como secundaria, igual de visible.
4. **Nunca bloquea**: seguir siempre funciona. La decisión es de la persona.
5. **Cancelar no hace nada**: Escape y tocar fuera equivalen a "Mejor no". No se muestra la X de cerrar si es un objetivo chico en el dispositivo que lo dispara.

Úsalo cuando el costo de equivocarse es incomodidad (una vista mal adaptada), no pérdida de datos. Para acciones destructivas usa la confirmación de siempre ("Sí, desactivar"), donde chile marca el riesgo.

**Ejemplo (Modo Gestión desde un celular)**

> **¿Seguro que quieres entrar a Gestión?**
> Estás en una pantalla chica y táctil. Gestión sirve para administrar el catálogo y se trabaja mucho mejor desde una computadora. Si lo necesitas, puedes entrar de todos modos y volver a Venta cuando quieras.
> [Entiendo, quiero seguir] [**Mejor no**]

Implementación de referencia: `UiModeSwitch.vue` sobre `AppModal` con su slot `footer`. Un aviso nuevo reutiliza esa misma forma (título, explicación, dos botones), no un modal distinto.

### Objetivos táctiles

**Todo lo que se toca mide al menos 44x44 px** (`min-height` y `min-width`, en px o rem): botones del selector de modo, buscador y paginación en Venta, botones de los avisos. Los átomos ya lo hacen en móvil (`AppButton` md/lg/xl) o con su variante grande (`AppInput size="lg"`, `AppPagination size="lg"`, `AppButton size="lg"`). Un control táctil nuevo debe declararlo en su CSS y sumarse a `src/config/__tests__/touch-targets.test.ts`, que comprueba ese contrato (jsdom no calcula layout, así que la medición real es una revisión en navegador).

### Pantalla de venta

Pensada para alguien que no se lleva bien con las computadoras: se siente como una app de celular sencilla. Botones grandes, poquísimo texto, cero ambigüedad y casi imposible usarla mal.

- **Disposición.** En pantalla ancha (desde 900 px), catálogo y carrito lado a lado, siempre a la vez. En celular, el catálogo ocupa la pantalla y una **barra fija abajo** muestra piezas y total con un botón grande "Ver venta y cobrar"; el carrito completo se abre como una hoja sobre el contenido ("Seguir agregando" la cierra). Nunca es otra ruta ni un modal, y **cobrar solo ocurre dentro del carrito completo**, donde se ven el efectivo y el cambio.
- **Patrón de cifra grande.** El dinero que importa (total, cambio a entregar, "Faltan $X") es lo más grande de su bloque, en `--font-display`, sobre un fondo suave del color de su estado, siempre con palabras además del color ("Faltan", "Cambio", "Justo, sin cambio"). Los importes se calculan en centavos enteros y se formatean con `minorToDisplay`; en la pantalla de éxito se muestran los del **servidor**.
- **Nada imposible de intentar.** "Cobrar" (56 px, la única acción principal) está apagado hasta que hay productos y el efectivo alcanza, y una línea de texto dice por qué. Un producto agotado se ve apagado con "Agotado" y no se elige; en el tope de existencia el "+" se ve apagado pero se puede tocar para saber por qué ("Ya no hay más piezas de Café."). "Vaciar" nunca vacía de un toque: usa el aviso no bloqueante (dos salidas del mismo tamaño, "Mejor no" es la principal).
- **Efectivo.** Campo de 56 px con teclado numérico, prefijo `$`, que acepta "100", "100.5" y "100,50" y limpia lo demás; atajos "Justo" y billetes de 20, 50, 100, 200 y 500.
- **Pantallas de resultado.** Cada resultado ocupa la pantalla, con su propio ícono, título y color, y **un solo botón principal** de 56 px. Nunca se confunden entre sí:

| Resultado | Título | Color e ícono | Botón principal |
|---|---|---|---|
| Cobrada | Venta registrada | nopal, ✓ | Nueva venta |
| Guardada sin internet | Listo, ya quedó | nopal, ✓ ☁ (se siente como éxito) | Nueva venta |
| Conflicto (no se cobró) | Esta venta no se pudo cobrar | maíz, "!" ; nunca nopal ni cifras de cobro | Entendido, nueva venta |
| Rechazada en línea | No pudimos registrar la venta | chile, ✕ | Regresar a la venta (el carrito sigue) |
| Sesión vencida | Tu venta está guardada | talavera, 🔒 | Iniciar sesión (y "Nueva venta" para seguir vendiendo) |
| No se pudo guardar | No se guardó la venta | chile, 💾 | Intentar de nuevo (y "Regresar a la venta") |

  El motivo técnico del servidor en un conflicto solo aparece plegado en "Detalle para el socio". Al aparecer una pantalla de resultado, el foco va al título.
- **Modales propios.** El lector de QR, la lista de ventas por revisar y la confirmación de "Vaciar" ocultan la X de `AppModal` (28 px, por debajo del mínimo) y ofrecen botones de tamaño completo.
- **Lector de QR.** Cámara trasera; el contenido del QR es el id del producto. Una lectura repetida dentro de 1.5 s cuenta una sola vez; el modal sigue abierto para escanear varios productos y responde a cada lectura en una región viva. Al cerrar se apagan todas las pistas de la cámara.

## 8. Dónde vive cada cosa

| Qué | Dónde |
|---|---|
| Tokens de color, tipografía, espaciado, radios, sombras, foco, `.brand-awning` | `src/assets/main.css` |
| Nombre, descripción, `THEME_COLOR`, `BACKGROUND_COLOR` | `src/config/app.ts` (los sustituye `vite.config.ts` en `index.html` y el manifest) |
| Carga de fuentes | `index.html` (`<link>`), cache offline en `vite.config.ts` |
| Logotipo | `src/components/ui/atoms/BrandLogo.vue`, `public/favicon.svg`, `public/icons/*.png` |
| Layouts | `AuthLayout` (login), `PublicLayout` (landing, registro, contexto), `AppLayout` (app) en `src/layouts/` |
| Landing | `src/views/LandingView.vue` + organismos `LandingHero`, `FeaturesSection`, `AudienceSection`, `LandingStory`, `HowItWorksSection`, `LandingCta` |
| Voz compartida | `src/config/voice.ts` |
| Formulario de registro | `BusinessRegistrationForm.vue` (molécula), `RegisterBusinessView.vue`, `src/validation/business-registration.schema.ts` |
| Modo de interfaz (Venta / Gestión) | `src/stores/uiMode.store.ts` (preferencia en `la-marchanta-ui-mode`, sugerencia inicial), `src/composables/useDeviceCapabilities.ts` (táctil y pantalla pequeña, breakpoint `SMALL_SCREEN_MAX_WIDTH`), `src/types/ui-mode.types.ts` |
| Selector de modo y aviso no bloqueante | `src/components/ui/organisms/UiModeSwitch.vue` (en `AppLayout`, barra lateral) e indicador `AppBadge` en la cabecera |
| Catálogo según el modo | `ProductCatalogView.vue` (lee el store), `ProductCatalogGrid.vue` (`mode`), `ProductCard.vue` (`size`), `AppPagination.vue` (`size`) |
| Pantalla de venta | `src/views/sales/SaleView.vue` (contenedor: conecta `cart`, `sale-catalog`, `checkout` y `toast`), `sale-result.ts` (resultado del cobro -> pantalla), ruta `Sale` en `/app/venta` |
| Componentes de la venta | Átomo `QuantityStepper`; moléculas `CartLineItem`, `CartSummary`, `CashInput`, `CategoryQuickFilter`; organismos `SaleCart`, `SaleCatalogPicker`, `SaleResult`, `QrScannerModal`, `SyncStatusIndicator` (todos presentacionales, en `src/components/ui/`) |
| Lógica de la venta | `src/stores/cart.store.ts`, `sale-catalog.store.ts`, `checkout.store.ts`, `sales-queue.store.ts`; cola en IndexedDB (`services/local-db.ts`, `sales-queue.ts`, `sales-sync.ts`); lector de QR en `services/qr-scanner.ts` (`barcode-detector`, WASM empaquetado y precacheado) |
| Voz de la venta | `src/config/voice.ts`: `saleSuccessMessage`, `saleSavedOfflineMessage`, `saleConflictMessage`, `saleChargeHint`, `saleCartRefusalMessage`, `salesPendingMessage`, `salesNeedReviewMessage`, `cameraErrorMessage`, `VOICE.saleResult`, `VOICE.scan` |
| Menú lateral | `src/layouts/nav-items.ts` (tabla declarativa por modo; un ítem nuevo es una fila) |
| Guardas automáticas | `src/config/__tests__/brand-tokens.test.ts` (contraste, tipografía, color de manifest), `no-hardcoded-colors.test.ts`, `touch-targets.test.ts` (objetivos de 44 px, incluye los componentes de la venta), `pwa-precache.test.ts` (el `.wasm` del lector de QR está precacheado), `app.test.ts` |
