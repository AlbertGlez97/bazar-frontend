# ---- builder ----
FROM node:24-alpine AS builder
WORKDIR /app

# VITE_API_URL is baked into the bundle at BUILD time
# (import.meta.env.VITE_API_URL, used in src/services/api.ts) — Vite has no
# runtime env support for static output, so it must be a build ARG, not a
# container env var read later.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
