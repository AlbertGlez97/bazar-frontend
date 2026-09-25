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

**Patrón de venta cobrada**: hecho concreto primero (qué se anotó y cuánto), luego el dato útil (cambio, a nombre de quién). Ya existe como función: `saleSuccessMessage()` en `src/config/voice.ts`, con tests. Las vistas de venta futuras deben usarla en vez de escribir el texto a mano.

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

## 7. Dónde vive cada cosa

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
| Guardas automáticas | `src/config/__tests__/brand-tokens.test.ts` (contraste, tipografía, color de manifest), `no-hardcoded-colors.test.ts`, `app.test.ts` |
