// Verifica desde fuera (sin credenciales) que una instalación sea instalable como PWA.
//   node scripts/check-pwa.mjs https://marchanta.albertogdlc.org
// Sale con código 1 si algo falla. Sin dependencias (Node 18+, fetch global).
//
// Qué comprueba:
//   - manifest: 200, content-type application/manifest+json, y name, id, start_url,
//     display y PNG de 192x192 y 512x512; sin URL absolutas a dominios viejos.
//   - cada ícono declarado, el favicon y el apple-touch-icon: 200 y content-type de imagen
//     (un text/html es el comodín del SPA contestando por un archivo que no existe;
//     un 403 es un archivo que existe pero nginx no puede leer).
//   - sw.js: 200 y JavaScript.
//   - CADA entrada del precache de sw.js: 200 y no text/html. Si una sola falla, la
//     instalación del service worker falla completa.
//
// Límite del precache: las entradas se extraen con una expresión regular sobre
// `url:"..."` del `precacheAndRoute([...])` que genera Workbox (generateSW). Si Workbox
// cambia ese formato o el sw.js usa injectManifest con otro, no se extrae nada y el
// script FALLA (no da por bueno lo que no pudo leer).

import { pathToFileURL } from 'node:url'

const OLD_DOMAINS = [/netlify/i, /app\.albertogdlc\.org/i]
const DISPLAYS = ['standalone', 'fullscreen', 'minimal-ui']
const JS_TYPES = ['application/javascript', 'text/javascript']
const FAVICON_TYPES = { svg: ['image/svg+xml'], png: ['image/png'], ico: ['image/x-icon', 'image/vnd.microsoft.icon'] }

/** Entradas `url:"..."` del precache de un sw.js de Workbox. */
export function extractPrecacheUrls(sw) {
  const start = sw.indexOf('precacheAndRoute')
  if (start === -1) return []
  const urls = []
  for (const match of sw.slice(start).matchAll(/\burl\s*:\s*(["'])([^"']+)\1/g)) urls.push(match[2])
  return urls
}

const typeOf = (response) => (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()

/** Una URL relativa o absoluta, resuelta contra la base. */
const resolve = (base, path) => new URL(path, base.endsWith('/') ? base : `${base}/`).toString()

function expectedImageTypes(path, declared) {
  if (declared) return [declared]
  const ext = path.split('?')[0].split('.').pop()?.toLowerCase()
  return FAVICON_TYPES[ext] ?? ['image/png']
}

export async function checkPwa(baseUrl, fetchImpl = fetch) {
  const results = []
  const add = (name, ok, detail = '') => results.push({ name, ok, detail })

  /** Pide un recurso y devuelve la respuesta o null (registra la falla de red). */
  async function get(name, url) {
    try {
      return await fetchImpl(url)
    } catch (error) {
      add(name, false, `no se pudo pedir ${url}: ${error.message}`)
      return null
    }
  }

  /** 200 + content-type esperado (nunca text/html salvo que se pida). */
  function expectResponse(name, response, allowedTypes) {
    const type = typeOf(response)
    if (response.status !== 200) return add(name, false, `status ${response.status} (content-type ${type || 'ninguno'})`), false
    if (type === 'text/html' && !allowedTypes.includes('text/html')) {
      return add(name, false, 'text/html: el comodín del SPA respondió por un archivo que no existe'), false
    }
    if (!allowedTypes.includes(type)) return add(name, false, `content-type ${type || 'ninguno'}, se esperaba ${allowedTypes.join(' o ')}`), false
    add(name, true, `200 ${type}`)
    return true
  }

  // ── index.html: de aquí salen el manifest, el favicon y el apple-touch ──
  const home = await get('index.html', resolve(baseUrl, '/'))
  const html = home ? await home.text() : ''
  const linkHref = (rel) => new RegExp(`<link[^>]*rel=["']${rel}["'][^>]*>`, 'i').exec(html)?.[0].match(/href=["']([^"']+)["']/i)?.[1]
  const manifestHref = linkHref('manifest') ?? '/manifest.webmanifest'
  const faviconHref = linkHref('icon') ?? '/favicon.svg'
  const appleHref = linkHref('apple-touch-icon') ?? '/icons/apple-touch-180.png'
  const faviconType = /<link[^>]*rel=["']icon["'][^>]*type=["']([^"']+)["']/i.exec(html)?.[1]

  // ── manifest ──
  const manifestResponse = await get('manifest', resolve(baseUrl, manifestHref))
  let manifest = null
  if (manifestResponse) {
    // Se registra la falla de tipo pero se sigue leyendo el JSON: así un solo problema no oculta los demás.
    expectResponse(`manifest ${manifestHref}`, manifestResponse, ['application/manifest+json'])
  }
  if (manifestResponse && manifestResponse.status === 200) {
    try {
      manifest = JSON.parse(await manifestResponse.text())
    } catch {
      add('manifest JSON', false, 'el manifest no es JSON válido')
    }
  }

  if (manifest) {
    for (const field of ['name', 'id', 'start_url']) {
      add(`manifest ${field}`, Boolean(manifest[field]), manifest[field] ? String(manifest[field]) : `falta "${field}"`)
    }
    add('manifest display', DISPLAYS.includes(manifest.display), `display=${manifest.display ?? 'ninguno'} (se espera ${DISPLAYS.join(', ')})`)
    const icons = Array.isArray(manifest.icons) ? manifest.icons : []
    for (const size of ['192x192', '512x512']) {
      const found = icons.some((icon) => (icon.sizes ?? '').split(/\s+/).includes(size) && icon.type === 'image/png')
      add(`manifest ícono PNG ${size}`, found, found ? 'declarado' : `no declara un PNG de ${size}`)
    }
    const stale = JSON.stringify(manifest).match(/https?:\/\/[^"]+/g)?.filter((url) => OLD_DOMAINS.some((pattern) => pattern.test(url))) ?? []
    add('manifest dominios viejos', stale.length === 0, stale.length ? `URL con dominio viejo: ${stale.join(', ')}` : 'ninguno')

    // ── cada ícono declarado ──
    for (const icon of icons) {
      const name = `ícono ${String(icon.src).replace(/^\//, '')}`
      const response = await get(name, resolve(baseUrl, icon.src))
      if (response) expectResponse(name, response, expectedImageTypes(String(icon.src), icon.type))
    }
  }

  // ── favicon y apple-touch ──
  for (const [name, href, declared] of [['favicon', faviconHref, faviconType], ['apple-touch-icon', appleHref, 'image/png']]) {
    const label = `${name} ${String(href).replace(/^\//, '')}`
    const response = await get(label, resolve(baseUrl, href))
    if (response) expectResponse(label, response, name === 'favicon' ? (FAVICON_TYPES[String(href).split('.').pop()] ?? [declared ?? 'image/svg+xml']) : [declared])
  }

  // ── service worker y su precache ──
  const swResponse = await get('sw.js', resolve(baseUrl, '/sw.js'))
  if (swResponse && expectResponse('sw.js', swResponse, JS_TYPES)) {
    const urls = [...new Set(extractPrecacheUrls(await swResponse.text()))]
    if (urls.length === 0) {
      add('precache', false, 'no se pudo extraer ninguna entrada del precache de sw.js (formato de Workbox no reconocido)')
    } else {
      add('precache entradas', true, `${urls.length} entradas extraídas`)
      for (const entry of urls) {
        const name = `precache ${entry}`
        const response = await get(name, resolve(baseUrl, entry))
        if (!response) continue
        const type = typeOf(response)
        const isHtml = entry.endsWith('.html')
        if (response.status !== 200) add(name, false, `status ${response.status}`)
        else if (type === 'text/html' && !isHtml) add(name, false, 'text/html: el comodín del SPA respondió por un archivo que no existe')
        else add(name, true, `200 ${type}`)
      }
    }
  }

  return { ok: results.every((result) => result.ok), results }
}

async function main() {
  const base = process.argv[2]
  if (!base) {
    console.error('Uso: node scripts/check-pwa.mjs <URL base>   (ej. https://marchanta.albertogdlc.org)')
    process.exit(2)
  }
  const report = await checkPwa(base)
  const failures = report.results.filter((result) => !result.ok)
  for (const result of report.results) console.log(`${result.ok ? 'OK   ' : 'FALLA'} ${result.name}  ${result.detail}`)
  console.log(`\n${report.results.length - failures.length}/${report.results.length} comprobaciones correctas`)
  if (failures.length > 0) {
    console.error(`${failures.length} fallas`)
    process.exit(1)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
