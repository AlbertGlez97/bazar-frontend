# ---- builder ----
FROM node:24-alpine AS builder
WORKDIR /app

# VITE_API_URL is baked into the bundle at BUILD time
# (import.meta.env.VITE_API_URL, used in src/services/api.ts) — Vite has no
# runtime env support for static output, so it must be a build ARG, not a
# container env var read later.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Clave PÚBLICA (site key) de Cloudflare Turnstile para el registro de negocios. Es pública por
# diseño (viaja en el bundle); la clave SECRETA vive solo en el backend. Mismo motivo que arriba:
# se hornea al construir, así que es un ARG.
ARG VITE_TURNSTILE_SITE_KEY
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# nginx corre como usuario sin privilegios: lo que sirve debe ser legible por todos
# sin depender del umask del host. Si el checkout llega en modo 600/700 (umask 077 del
# usuario de deploy), Vite copia public/ (favicon, íconos) conservando ese modo y nginx
# respondía 403 en esos archivos: Chrome no podía bajar los íconos del manifest y la app
# dejaba de ser instalable.
RUN chmod -R a+rX /app/dist

# ---- runtime ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
