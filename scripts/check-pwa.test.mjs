import { describe, expect, it } from 'vitest'
import { checkPwa, extractPrecacheUrls } from './check-pwa.mjs'

// Simula un servidor: mapa de ruta → { status, type, body }. Lo que no está en el mapa
// responde como el comodín del SPA de nginx: 200 y text/html con el index.
const BASE = 'https://app.test'

const INDEX_HTML = `<!doctype html><html><head>
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/icons/apple-touch-180.png" />
<link rel="manifest" href="/manifest.webmanifest"></head><body><div id="app"></div></body></html>`

const MANIFEST = {
  name: 'La Marchanta',
  short_name: 'La Marchanta',
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  icons: [
    { src: '/icons/192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4])
const SW = 'precacheAndRoute([{url:"index.html",revision:"a"},{url:"favicon.svg",revision:"b"},{url:"icons/192.png",revision:"c"},{url:"assets/app-1.js",revision:null}]);'

function healthy() {
  return {
    '/': { type: 'text/html', body: INDEX_HTML },
    '/manifest.webmanifest': { type: 'application/manifest+json', body: JSON.stringify(MANIFEST) },
    '/icons/192.png': { type: 'image/png', body: PNG },
    '/icons/512.png': { type: 'image/png', body: PNG },
    '/icons/maskable-512.png': { type: 'image/png', body: PNG },
    '/icons/apple-touch-180.png': { type: 'image/png', body: PNG },
    '/favicon.svg': { type: 'image/svg+xml', body: '<svg/>' },
    '/sw.js': { type: 'application/javascript', body: SW },
    '/index.html': { type: 'text/html', body: INDEX_HTML },
    '/assets/app-1.js': { type: 'application/javascript', body: 'x' },
  }
}

function fakeFetch(routes) {
  return async (url) => {
    const path = new URL(url).pathname
    const hit = routes[path] ?? { type: 'text/html', body: INDEX_HTML } // comodín del SPA
    const status = hit.status ?? 200
    const bytes = typeof hit.body === 'string' ? new TextEncoder().encode(hit.body) : hit.body
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: { get: (name) => (name.toLowerCase() === 'content-type' ? hit.type : null) },
      text: async () => (typeof hit.body === 'string' ? hit.body : new TextDecoder().decode(hit.body)),
      json: async () => JSON.parse(typeof hit.body === 'string' ? hit.body : '{}'),
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    }
  }
}

const run = (routes) => checkPwa(BASE, fakeFetch(routes))
const failed = (report) => report.results.filter((r) => !r.ok)
const failedNames = (report) => failed(report).map((r) => r.name)

describe('check-pwa: todo sano', () => {
  it('pasa sin fallas y cubre manifest, íconos, favicon, apple-touch, sw y precache', async () => {
    const report = await run(healthy())

    expect(failed(report)).toEqual([])
    expect(report.ok).toBe(true)
    const names = report.results.map((r) => r.name).join(' | ')
    for (const needle of ['manifest', 'icons/192.png', 'icons/512.png', 'favicon.svg', 'apple-touch', 'sw.js', 'precache']) {
      expect(names).toContain(needle)
    }
  })
})

describe('check-pwa: detecta lo que rompió la instalación', () => {
  it('un ícono con 403 falla', async () => {
    const report = await run({ ...healthy(), '/icons/192.png': { status: 403, type: 'text/html', body: '403' } })

    expect(report.ok).toBe(false)
    expect(failed(report).some((r) => r.name.includes('icons/192.png') && /403/.test(r.detail))).toBe(true)
  })

  it('el comodín del SPA (200 con text/html) en un ícono falla y lo dice', async () => {
    const routes = healthy()
    delete routes['/icons/512.png'] // el servidor responde con el index
    const report = await run(routes)

    expect(report.ok).toBe(false)
    expect(failed(report).some((r) => r.name.includes('icons/512.png') && /text\/html/.test(r.detail) && /comodín/.test(r.detail))).toBe(true)
  })

  it('un 200 con content-type equivocado falla (ícono png servido como octet-stream)', async () => {
    const report = await run({ ...healthy(), '/icons/192.png': { type: 'application/octet-stream', body: PNG } })

    expect(failedNames(report).some((n) => n.includes('icons/192.png'))).toBe(true)
  })

  it('el manifest como application/octet-stream falla', async () => {
    const report = await run({ ...healthy(), '/manifest.webmanifest': { type: 'application/octet-stream', body: JSON.stringify(MANIFEST) } })

    expect(failed(report).some((r) => r.name.includes('manifest') && /octet-stream/.test(r.detail))).toBe(true)
  })

  it('el favicon con 403 falla', async () => {
    const report = await run({ ...healthy(), '/favicon.svg': { status: 403, type: 'text/html', body: '' } })

    expect(failedNames(report).some((n) => n.includes('favicon'))).toBe(true)
  })

  it('el apple-touch-icon con 403 falla', async () => {
    const report = await run({ ...healthy(), '/icons/apple-touch-180.png': { status: 403, type: 'text/html', body: '' } })

    expect(failedNames(report).some((n) => n.includes('apple-touch'))).toBe(true)
  })

  it('el service worker servido como text/html falla', async () => {
    const report = await run({ ...healthy(), '/sw.js': { type: 'text/html', body: INDEX_HTML } })

    expect(failedNames(report).some((n) => n.includes('sw.js'))).toBe(true)
  })

  it('un ícono ya cubierto: un 200 text/html aunque el cuerpo sea un PNG falso no engaña (por content-type)', async () => {
    const report = await run({ ...healthy(), '/icons/maskable-512.png': { type: 'text/html', body: PNG } })

    expect(report.ok).toBe(false)
  })
})

describe('check-pwa: contenido del manifest', () => {
  const withManifest = (patch) => ({
    ...healthy(),
    '/manifest.webmanifest': { type: 'application/manifest+json', body: JSON.stringify({ ...MANIFEST, ...patch }) },
  })

  it('sin "id" falla', async () => {
    const withoutId = { ...MANIFEST }
    delete withoutId.id
    const report = await run({ ...healthy(), '/manifest.webmanifest': { type: 'application/manifest+json', body: JSON.stringify(withoutId) } })

    expect(failed(report).some((r) => /\bid\b/.test(r.name + r.detail))).toBe(true)
  })

  it('sin start_url falla', async () => {
    const without = { ...MANIFEST }
    delete without.start_url
    const report = await run({ ...healthy(), '/manifest.webmanifest': { type: 'application/manifest+json', body: JSON.stringify(without) } })

    expect(failed(report).some((r) => /start_url/.test(r.name + r.detail))).toBe(true)
  })

  it('display que no sea standalone/fullscreen/minimal-ui falla', async () => {
    const report = await run(withManifest({ display: 'browser' }))

    expect(failed(report).some((r) => /display/.test(r.name + r.detail))).toBe(true)
  })

  it('sin PNG de 512x512 falla', async () => {
    const report = await run(withManifest({ icons: MANIFEST.icons.filter((i) => i.sizes !== '512x512') }))

    expect(failed(report).some((r) => /512/.test(r.name + r.detail))).toBe(true)
  })

  it('sin PNG de 192x192 falla', async () => {
    const report = await run(withManifest({ icons: MANIFEST.icons.filter((i) => i.sizes !== '192x192') }))

    expect(failed(report).some((r) => /192/.test(r.name + r.detail))).toBe(true)
  })

  it('un manifest que no es JSON falla sin lanzar', async () => {
    const report = await run({ ...healthy(), '/manifest.webmanifest': { type: 'application/manifest+json', body: '<html>' } })

    expect(report.ok).toBe(false)
  })

  it('un dominio viejo en una URL absoluta del manifest falla', async () => {
    const report = await run(withManifest({ start_url: 'https://app.albertogdlc.org/' }))

    expect(report.ok).toBe(false)
  })
})

describe('check-pwa: precache del service worker', () => {
  it('extrae las URL de precacheAndRoute', () => {
    expect(extractPrecacheUrls(SW)).toEqual(['index.html', 'favicon.svg', 'icons/192.png', 'assets/app-1.js'])
  })

  it('una entrada del precache con 403 falla (rompería la instalación del service worker)', async () => {
    // content-type de JS a propósito: lo que debe fallar es el STATUS, no el tipo
    const report = await run({ ...healthy(), '/assets/app-1.js': { status: 403, type: 'application/javascript', body: '' } })

    expect(failed(report).some((r) => r.name.includes('precache') && r.name.includes('assets/app-1.js'))).toBe(true)
  })

  it('una entrada que no existe (comodín text/html) falla', async () => {
    const routes = healthy()
    delete routes['/assets/app-1.js']
    const report = await run(routes)

    expect(failed(report).some((r) => r.name.includes('precache') && r.name.includes('assets/app-1.js'))).toBe(true)
  })

  it('si no se puede extraer ninguna entrada, lo dice y falla (no da por bueno lo que no pudo leer)', async () => {
    const report = await run({ ...healthy(), '/sw.js': { type: 'application/javascript', body: 'console.log(1)' } })

    expect(failed(report).some((r) => r.name.includes('precache') && /no se pudo/i.test(r.detail))).toBe(true)
  })

  it('extrae también entradas con comillas simples y espacios', () => {
    expect(extractPrecacheUrls("precacheAndRoute([{ url: 'a.js', revision: null }, {url : \"b.css\",revision:\"x\"}])")).toEqual(['a.js', 'b.css'])
  })
})

describe('check-pwa: sigue revisando aunque el manifest tenga el tipo equivocado', () => {
  it('con el manifest como octet-stream y un ícono 403 reporta AMBAS fallas', async () => {
    const report = await run({
      ...healthy(),
      '/manifest.webmanifest': { type: 'application/octet-stream', body: JSON.stringify(MANIFEST) },
      '/icons/192.png': { status: 403, type: 'text/html', body: '' },
    })

    expect(failed(report).some((r) => /octet-stream/.test(r.detail))).toBe(true)
    expect(failed(report).some((r) => r.name.startsWith('ícono ') && r.name.includes('icons/192.png') && /403/.test(r.detail))).toBe(true)
  })
})
