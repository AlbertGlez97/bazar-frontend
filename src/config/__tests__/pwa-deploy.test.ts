import { describe, expect, it } from 'vitest'
import dockerfile from '../../../Dockerfile?raw'
import nginx from '../../../nginx.conf?raw'
import viteConfig from '../../../vite.config.ts?raw'

// Contrato del despliegue PWA. Chrome solo ofrece instalar si puede descargar los
// íconos del manifest; nginx devolvía 403 en lo que viene de public/ porque llegaba en
// modo 600 desde el checkout del servidor (umask 077) y el worker de nginx no lo lee.

const normalize = (text: string) => text.replace(/\r\n/g, '\n')
const docker = normalize(dockerfile)
const conf = normalize(nginx)

describe('Dockerfile: lo que sirve nginx es legible por todos', () => {
  it('el stage builder hace chmod -R a+rX sobre dist DESPUÉS del build y ANTES del COPY final', () => {
    const build = docker.indexOf('RUN npm run build')
    const chmod = docker.search(/RUN chmod -R a\+rX \/app\/dist/)
    const copy = docker.indexOf('COPY --from=builder /app/dist')

    expect(build).toBeGreaterThan(-1)
    expect(chmod).toBeGreaterThan(build)
    expect(copy).toBeGreaterThan(chmod)
  })

  it('el chmod vive en el stage builder (no depende del umask del host)', () => {
    const runtimeStage = docker.slice(docker.indexOf('FROM nginx'))
    expect(runtimeStage).not.toMatch(/chmod/)
    expect(docker.slice(0, docker.indexOf('FROM nginx'))).toMatch(/chmod -R a\+rX/)
  })
})

describe('nginx.conf: el manifest sale como application/manifest+json', () => {
  it('location exacta con default_type, sin pisar los demás tipos', () => {
    const block = /location = \/manifest\.webmanifest \{([^}]*)\}/.exec(conf)?.[1] ?? ''

    expect(block).toMatch(/default_type\s+application\/manifest\+json\s*;/)
    expect(block).toMatch(/add_header Cache-Control "no-cache"/)
  })

  it('NO usa la directiva "types" (reemplazaría todos los tipos heredados: png, svg, js, css)', () => {
    expect(conf).not.toMatch(/^\s*types\s*\{/m)
  })

  it('conserva no-cache en index.html y sw.js y el cache inmutable de /assets/', () => {
    expect(conf).toMatch(/location = \/index\.html \{[^}]*no-cache/)
    expect(conf).toMatch(/location = \/sw\.js \{[^}]*no-cache/)
    expect(conf).toMatch(/location \/assets\/ \{[^}]*immutable/)
  })
})

describe('manifest (vite.config.ts)', () => {
  it('declara "id": "/" (igual al ID calculado hoy, así no cambia la identidad de la app)', () => {
    expect(viteConfig).toMatch(/\bid:\s*'\/'/)
  })

  it('no se agregan screenshots ni otras mejoras (alcance cerrado)', () => {
    expect(viteConfig).not.toMatch(/screenshots/)
  })
})
