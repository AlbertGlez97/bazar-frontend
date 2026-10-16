// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// .env.example no se puede importar con ?raw (Vite bloquea los archivos .env): se lee del disco.
const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')
const dockerfile = read('Dockerfile')
const envExample = read('.env.example')
const nginx = read('nginx.conf')

// La clave PÚBLICA de Cloudflare Turnstile se hornea en el bundle al construir (Vite no lee
// variables en tiempo de ejecución): debe llegar como ARG del Dockerfile, igual que VITE_API_URL.

const normalize = (text: string) => text.replace(/\r\n/g, '\n')
const docker = normalize(dockerfile)

describe('Turnstile en el build', () => {
  it('el Dockerfile recibe VITE_TURNSTILE_SITE_KEY como ARG y lo deja en el ENV antes de construir', () => {
    const arg = docker.search(/^ARG VITE_TURNSTILE_SITE_KEY$/m)
    const env = docker.search(/^ENV VITE_TURNSTILE_SITE_KEY=\$VITE_TURNSTILE_SITE_KEY$/m)
    const build = docker.indexOf('RUN npm run build')

    expect(arg).toBeGreaterThan(-1)
    expect(env).toBeGreaterThan(arg)
    expect(build).toBeGreaterThan(env)
  })

  it('.env.example documenta la variable (solo clave pública, sin valor real)', () => {
    expect(normalize(envExample)).toMatch(/^VITE_TURNSTILE_SITE_KEY=$/m)
  })

  it('nginx no define Content-Security-Policy (si algún día se agrega, debe permitir Turnstile)', () => {
    const conf = normalize(nginx)
    if (!/Content-Security-Policy/i.test(conf)) return
    expect(conf).toMatch(/script-src[^;]*https:\/\/challenges\.cloudflare\.com/)
    expect(conf).toMatch(/frame-src[^;]*https:\/\/challenges\.cloudflare\.com/)
    expect(conf).toMatch(/connect-src[^;]*https:\/\/challenges\.cloudflare\.com/)
  })
})
