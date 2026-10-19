# Despliegue: variables nuevas del registro de negocios

El registro de negocios con correo verificado necesita variables nuevas en producción. El
`docker-compose.prod.yml` y el `.env` de producción viven en la LXC (`/srv/marchanta`), **fuera de los
repos**: este documento es el diff que hay que aplicar allí a mano. El workflow de deploy
(`.forgejo/workflows/ci.yml`) no se modifica: sigue pasando solo `VITE_API_URL` y compose toma el resto de
`/srv/marchanta/.env`.

## Variables

| Variable | Dónde | Obligatoria | Qué es |
|---|---|---|---|
| `VITE_TURNSTILE_SITE_KEY` | frontend, **al construir** (`ARG` del `Dockerfile`) | sí | Clave **pública** (site key) de Cloudflare Turnstile. Va dentro del bundle. Sin ella el formulario dice "El registro no está disponible por ahora." y no se puede enviar |
| `TURNSTILE_SECRET_KEY` | backend (contenedor `api`) | sí | Clave **secreta** de Turnstile. La clave secreta va solo en el backend, nunca en el frontend. Sin ella el registro responde 503 |
| `PUBLIC_SITE_URL` | backend | sí | Origen del frontend, sin barra final, p. ej. `https://marchanta.albertogdlc.org`. El correo de verificación enlaza a `<PUBLIC_SITE_URL>/verificar-correo?token=…` |
| `CLIENT_IP_HEADER` | backend | no | Cabecera con la IP real del visitante para los límites por IP. Por defecto `cf-connecting-ip` |
| `TURNSTILE_DEV_BYPASS` | backend | **nunca en producción** | Solo desarrollo local: salta la verificación de Turnstile. Se ignora si `NODE_ENV=production` |

Ya existen y no cambian: `APPROVAL_NOTIFICATION_EMAIL`, `APP_BASE_URL`, `RESEND_API_KEY`.

## Diff propuesto del compose (frontend)

```diff
   frontend:
     build:
       context: ./bazar-frontend
       args:
         VITE_API_URL: ${VITE_API_URL}
+        VITE_TURNSTILE_SITE_KEY: ${VITE_TURNSTILE_SITE_KEY}
```

## Diff propuesto del `.env` de producción (`/srv/marchanta/.env`)

```diff
+VITE_TURNSTILE_SITE_KEY=<site key pública del widget de Turnstile>
+TURNSTILE_SECRET_KEY=<clave secreta del widget>
+PUBLIC_SITE_URL=https://marchanta.albertogdlc.org
```

Si el servicio del backend en el compose no recibe ya todo el `.env` (`env_file`), agrega las dos variables
del backend bajo `environment:` de ese servicio. En el widget de Turnstile (panel de Cloudflare) el dominio
permitido debe ser el del sitio público.

## Orden

1. Poner las variables en `/srv/marchanta/.env` y aplicar el diff del compose.
2. Desplegar el backend (aplica la migración `20261016180000_business_registration_email_verification`).
3. Desplegar el frontend inmediatamente después: el formulario nuevo manda campos que el backend viejo rechaza
   con 400.

## Comprobar

- `https://marchanta.albertogdlc.org/registro-negocio` muestra el widget de verificación (no el aviso de
  "no disponible").
- La consola del navegador **no** muestra el aviso `VITE_TURNSTILE_SITE_KEY no está configurada`.
- `POST /api/v1/business-registration` con un cuerpo completo y un `turnstileToken` inventado responde 400
  (`turnstile_invalid`); si responde 503 (`turnstile_unavailable`) falta `TURNSTILE_SECRET_KEY` o la clave es mala.
