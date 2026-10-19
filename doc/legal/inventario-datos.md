# Inventario de datos personales — La Marchanta

Consultado el **2026-10-16** sobre el código local (`bazar-api` y `bazar-frontend`, rama `main` al commit `5cf25be` del frontend). Es la base de lo que dicen `/privacidad` y `/terminos`: cada afirmación de esos textos debe poder rastrearse a una fila de este documento, al esquema o a una decisión del responsable. Lo que no se pudo comprobar está en `preguntas-para-abogado.md`.

Leyenda de **origen**: `ESQ` = esquema Prisma (`bazar-api/prisma/schema.prisma`); `COD` = código; `DOC` = documentación del repositorio; `DEC` = decisión del responsable (prompt del 2026-10-16); `NO HAY` = no existe todavía en el sistema.

## 1. Solicitud de registro de un negocio

Modelo `BusinessRegistrationRequest` (ESQ). Tabla sin `contextId`: existe antes de que haya negocio.

| Dato | ¿Se guarda hoy? | Origen / nota |
|---|---|---|
| Nombre del negocio (`nombreNegocio`) | Sí | ESQ |
| Nombre (`nombre`) y apellidos (`apellidos`) de quien solicita | Sí | ESQ |
| Correo (`correo`), en minúsculas | Sí, **sin confirmar con enlace** | ESQ; `doc/api-contract-for-frontend.md` §11: "validado solo por formato, sin verificar que el buzón exista" |
| Teléfono (`telefono`) | Sí, **opcional** | ESQ. Los datos de la decisión dicen "teléfono o WhatsApp" obligatorio: es el registro nuevo |
| Estado (pendiente / aprobado / rechazado), fechas de creación y resolución | Sí | ESQ |
| Hash sha256 del enlace de aprobación y su vencimiento | Sí | ESQ. El enlace es de un solo uso y vence a los **30 días** (`TOKEN_TTL_MS` en `business-registration.service.ts`; `doc/reglas-de-negocio.md`, Multi-tenancy) |
| Tipo de negocio (lista), qué vende, dónde vende (opcional) | **NO HAY** | Lo recabará el registro nuevo (DEC) |
| Quién lo recomendó (opcional) | **NO HAY** | Registro nuevo (DEC) |
| Aceptación del aviso y los términos (fecha y versión) | **NO HAY** | Registro nuevo (DEC) |
| Confirmación del correo con enlace | **NO HAY** | Registro nuevo (DEC) |

Plazos de conservación: **no hay ningún proceso automático** que borre solicitudes (se buscó `Cron`, `deleteMany` y tareas programadas en `bazar-api/src`: no hay). Los plazos de 7 y 30 días son una decisión de negocio (DEC) y hoy no están implementados.

## 2. Cuenta, personas y dispositivos

| Dato | Dónde | Origen / nota |
|---|---|---|
| Usuario de acceso (`username`), derivado del nombre del negocio al aprobar | `Account` | ESQ; `initial-credentials.ts` |
| Contraseña: solo un hash argon2id (`passwordHash`) | `Account` | ESQ; `auth.service.spec.ts` comprueba el prefijo `$argon2id$` |
| Contraseña temporal: se genera al aprobar, se envía por correo y no se guarda en claro ni en logs | correo | `doc/api-contract-for-frontend.md` §11.5 |
| Nombre (`name`) y rol (`socio` / `colaborador`) de cada persona | `Member` | ESQ |
| Porcentaje de comisión individual de un colaborador | `Member.commissionRateBps` | ESQ |
| Quién agregó a cada persona (`createdByMemberId`) | `Member` | ESQ |
| **Correo de cada persona** | **No se guarda** en `Account` ni en `Member` | ESQ. Solo existe el `correo` de la solicitud de registro. El prompt habla de "nombre, correo y rol de cada persona": el texto público sigue al código (nombre, usuario y rol) |
| Dispositivo: nombre, código de activación de un solo uso (`identifier`), estado, fechas de alta/activación/revocación | `Device` | ESQ |
| Hash sha256 del token del dispositivo (el token no se guarda) | `Device.tokenHash` | ESQ |
| Contexto del negocio (`contextId`) | todas las tablas del negocio | ESQ |

Aislamiento entre negocios: filtro por `contextId` en la aplicación **y** seguridad por filas de PostgreSQL (RLS) con un rol de base de datos de mínimos privilegios (`doc/runtime-database-role.md`, `doc/reglas-de-negocio.md`).

## 3. Datos del negocio y actividad de venta

Todos llevan `contextId` y se atribuyen a la persona (`memberId`) y al dispositivo (`deviceId`) que los registró.

| Dato | Modelo (ESQ) |
|---|---|
| Productos: nombre, tipo, precio, existencia, imagen, categoría, costo de compra, proveedor, notas | `Product` |
| Cambios de existencia y auditoría de productos | `StockMovement`, `ProductAudit` |
| Ventas: quién, en qué dispositivo, cuándo, artículos, total, método de pago (efectivo, transferencia, tarjeta), efectivo recibido y cambio | `Sale`, `SaleItem` |
| Incidencias de venta (conflictos de existencia, fechas fuera de rango) | `Incidencia` |
| Gastos: monto, naturaleza, categoría, descripción, quién pagó | `Expense`, `ExpenseReversal` |
| Aportaciones de capital de cada persona, con nota | `Contribution`, `ContributionReversal` |
| Jornadas de trabajo de cada persona | `WorkShift`, `WorkShiftReversal` |
| Reservas, acuerdos de reparto, participantes y pagos | `FinanceReserve*`, `DistributionAgreement*`, `DistributionPayment*` |
| Configuración del negocio (comisión por defecto) | `AppSettings` |

Las aportaciones, jornadas, acuerdos y pagos son **datos financieros o patrimoniales de personas físicas** (los socios y colaboradores). Ver `preguntas-para-abogado.md`.

## 4. Datos de terceros: deudores (fiado y apartado)

| Dato | Modelo (ESQ) |
|---|---|
| Nombre, teléfono (opcional) y notas (opcional) de la persona que debe | `Deudor` |
| Deuda: producto, cantidad, total, estado, calendario de cuotas planeadas (informativo) | `Deuda`, `CuotaPlaneada` |
| Abonos: monto, método de pago, nota, quién lo recibió, fecha | `Abono` |

El negocio decide si captura estos datos y para qué los usa. `notas` y los demás campos de texto libre (`Product.notes`, `Abono.nota`, `Contribution.note`, `Expense.description`) **pueden recibir datos sensibles si alguien los escribe**: el sistema no los pide ni los filtra.

## 5. Lo que guarda el navegador de cada persona

Fuente: `bazar-frontend/src` (búsqueda de `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`).

| Dónde | Clave / almacén | Qué guarda |
|---|---|---|
| `localStorage` | `access_token`, `token_expires_at` | Sesión (token de acceso y su vencimiento) |
| `localStorage` | `auth_username`, `account_binding` | Usuario de la sesión y una copia de a qué persona está ligada la cuenta |
| `localStorage` | `device_context` | Dispositivo registrado en este equipo (id, nombre) |
| `localStorage` | `la-marchanta-ui-mode`, `la-marchanta-sale-catalog-view`, `la-marchanta-manage-catalog-view`, `la-marchanta-label-calibration`, `la-marchanta-sale-catalog-hint-dismissed` | Preferencias de pantalla |
| `sessionStorage` | `member_context` | Persona que atiende en este equipo (se borra al cerrar la pestaña) |
| IndexedDB `la-marchanta` | `pending-sales`, `pending-contributions`, `pending-expenses`, `pending-work-shifts` y sus historiales | Operaciones hechas sin conexión, pendientes de enviarse |
| IndexedDB `la-marchanta` | `catalog-snapshot` | Copia del catálogo para vender sin conexión |
| Caché del service worker | precaché de la app; `marchanta-api-cache` (GET de la API, 5 minutos, sin autenticación ni finanzas); `google-fonts`; `export-libs` | Archivos de la app y respuestas recientes |
| Cookies | **La app no escribe cookies** (no hay `document.cookie`) | Cloudflare podría usar las suyas: sin verificar |

## 6. Proveedores y terceros que intervienen

| Tercero | Para qué | Qué recibe | Origen |
|---|---|---|---|
| **Resend** (correo transaccional) | Enviar al socio sus credenciales al aprobar el registro; hasta que haya dominio verificado, un respaldo al aprobador | Correo del socio, usuario, contraseña temporal, nombre e identificador del dispositivo inicial | `bazar-api/src/email/email.service.ts`; `RESEND_API_KEY` en `.env.example`; `odd/business-email-deliverability.md` (remitente `notificaciones@albertogdlc.org`) |
| **Cloudflare Turnstile** (verificación de seguridad de `/registro-negocio`) | Comprobar que quien se registra es una persona | El widget se carga desde Cloudflare y recibe la dirección IP y señales técnicas del navegador; el backend manda el token a Cloudflare para validarlo | `src/components/ui/molecules/TurnstileWidget.vue`, `bazar-api/src/business-registration/turnstile.service.ts`. Se agregó al aviso en la versión `2026-10-19` |
| **Cloudflare** (DNS y entrega del sitio) | Entregar el sitio y la API | Todo el tráfico pasa por su red; ve la dirección IP y datos técnicos de la conexión | `doc/finance-phase4-integrated-closeout.md`, `odd/tasks/be12-team-devices.md` (túnel); `check-pwa` contra el dominio responde con cabeceras `cf-*` |
| **Google Fonts** | Tipografías de la marca | El navegador de la visitante las pide a Google (su IP) | `bazar-frontend/index.html` (`fonts.googleapis.com`, `fonts.gstatic.com`) |
| Servidor propio (LXC, Docker, PostgreSQL) | Alojar la aplicación y la base de datos | Todos los datos | `.forgejo/workflows/ci.yml` (deploy por SSH); decisión del responsable |
| Netlify | Ya no se usa | — | Dato del responsable |

No se encontró en el código ningún servicio de analítica, publicidad, mapas ni pagos.

## 7. Lo que no se pudo comprobar

- Si el servidor (nginx, Nest, Docker) conserva **registros con la IP** de quien consulta y por cuánto tiempo.
- Si hay **respaldos** de la base de datos, dónde y con qué frecuencia: no hay nada documentado en el repositorio.
- Si Cloudflare coloca **cookies** u otra información en los navegadores.
- La **ubicación** de los servidores de Resend y Cloudflare (probable transferencia fuera de México).
- Qué cifrado hay entre Cloudflare y el servidor de origen.
