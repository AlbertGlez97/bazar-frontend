# Registro de negocio con correo verificado (frontend)

El contrato completo del API (campos, códigos, límites, limpieza) está en
`bazar-api/doc/api-contract-for-frontend.md` (sección 11) y
`bazar-api/doc/reglas-de-negocio.md` ("Registro de negocio v2"). Aquí queda lo que decide el frontend.

## Flujo

1. `/registro-negocio` (`RegisterBusinessView` + `BusinessRegistrationForm`). Al enviar con éxito el
   formulario se **oculta** (no se destruye) y aparece `CheckEmailNotice` ("Revisa tu correo").
2. La persona abre el enlace del correo: `/verificar-correo?token=…` (`VerifyEmailView`). **Abrir la
   página no confirma nada**: solo el botón "Confirmar mi correo" hace `POST /business-registration/verify-email`
   (los escáneres de correo abren los enlaces solos).
3. Al confirmar, el aprobador recibe la solicitud y escribe a la persona por WhatsApp.

## Piezas (diseño atómico)

| Nivel | Pieza | Para qué |
|---|---|---|
| Átomo | `AppCheckbox` | casilla del aviso (ya no usa `display:none`: se alcanza con el teclado) |
| Molécula | `TurnstileWidget` | verificación de Cloudflare; avisa por eventos `verified` / `expired` / `failed` |
| Molécula | `AppSelect`, `AppTextarea` | ahora marcan `aria-invalid` y `aria-describedby` con su error |
| Molécula | `LegalNoticeSummary` | resumen del aviso, antes de la casilla |
| Organismo | `BusinessRegistrationForm` | campos, validación (Zod), campo trampa, casilla y token de Turnstile |
| Organismo | `CheckEmailNotice` | "Revisa tu correo": reenviar con cuenta regresiva y corregir el correo |
| Vista | `RegisterBusinessView`, `VerifyEmailView` | única capa que llama al servicio |
| Composable | `useTurnstile`, `useCountdown` | carga del script (con tiempo límite y reintento) y cuenta regresiva |
| Util | `registration-api-error.ts` | palabras para 429 / 503 / 400 / sin red |

## Reglas que el código cumple

- **Versión legal**: se manda `LEGAL_VERSION` (`src/legal/versions.ts`), nunca una fecha escrita a mano.
- **Teléfono**: obligatorio; se manda **normalizado a 10 dígitos** (`normalizeMxPhone`). Se rotula
  "Número de WhatsApp"; no se verifica.
- **Campo trampa**: `contacto_alterno` en el DOM (`aria-hidden`, `tabindex=-1`, `autocomplete=off`,
  fuera de pantalla); viaja como `sitioWebEmpresa`. Una persona lo deja vacío.
- **Turnstile**: el token es de un solo uso. Se borra y el widget se reinicia al terminar **cada** envío
  (con éxito o con error). Sin token no se envía. Si el script no carga (sin internet, bloqueado, 10 s) o el
  widget falla, se dice con palabras claras, se ofrece "Reintentar" y **no se pierde lo escrito**.
- **Sin conexión**: aviso breve "Sin internet. Conéctate para enviar tu solicitud." (no bloquea ni borra).
- **Respuestas genéricas**: el API contesta igual aunque el correo ya exista; la pantalla nunca promete que
  la solicitud ya se revisa ("Hasta que confirmes, nadie revisa tu solicitud").
- **Sin enlaces** de redes ni de mapas: el contrato no tiene ese campo.

## Variables de build

- `VITE_TURNSTILE_SITE_KEY`: clave **pública** (site key). Se hornea al construir, como `VITE_API_URL`
  (`ARG` en el `Dockerfile`). Sin ella el formulario muestra "No pudimos hacer la verificación de seguridad"
  y no se puede enviar. Para desarrollo: `1x00000000000000000000AA` (siempre pasa) o
  `2x00000000000000000000AB` (siempre falla), de Cloudflare.

## Service worker y CSP (revisado)

- El script de Turnstile (`challenges.cloudflare.com`) es de otro origen y no está en el precache; el service
  worker no lo intercepta (`runtimeCaching` solo mira `/api/v1/` y las librerías de reportes). Sin internet
  el widget no carga y el formulario lo dice.
- `/verificar-correo` es una ruta SPA: la sirve `navigateFallback: '/index.html'`.
- `nginx.conf` **no** define `Content-Security-Policy`, así que hoy nada bloquea a Turnstile. Si algún día se
  agrega, necesita `script-src`, `frame-src` y `connect-src` con `https://challenges.cloudflare.com`
  (lo vigila `src/config/__tests__/turnstile-build.test.ts`).

## Lo que no se puede probar sin un navegador y un dominio real

El widget real de Turnstile solo se puede ver con una site key válida para el dominio (o la de prueba de
Cloudflare en `localhost`). Las pruebas automáticas usan un doble del widget.
