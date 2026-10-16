import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadTurnstile, resetTurnstileLoader, TURNSTILE_SCRIPT_URL } from '../useTurnstile'

function scripts(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="challenges.cloudflare.com"]'))
}

beforeEach(() => {
  resetTurnstileLoader()
  document.head.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach((s) => s.remove())
  delete (window as { turnstile?: unknown }).turnstile
})

afterEach(() => {
  vi.useRealTimers()
})

describe('loadTurnstile', () => {
  it('pide el script oficial de Cloudflare en modo explícito, una sola vez aunque se llame dos veces', async () => {
    const first = loadTurnstile()
    const second = loadTurnstile()

    expect(scripts()).toHaveLength(1)
    expect(scripts()[0].src).toBe(TURNSTILE_SCRIPT_URL)
    expect(TURNSTILE_SCRIPT_URL).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit')

    const api = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() }
    ;(window as unknown as { turnstile: unknown }).turnstile = api
    scripts()[0].dispatchEvent(new Event('load'))

    await expect(first).resolves.toBe(api)
    await expect(second).resolves.toBe(api)
  })

  it('si ya está cargado no vuelve a pedir el script', async () => {
    const api = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() }
    ;(window as unknown as { turnstile: unknown }).turnstile = api

    await expect(loadTurnstile()).resolves.toBe(api)
    expect(scripts()).toHaveLength(0)
  })

  it('el script se carga async y defer para no frenar la página', () => {
    void loadTurnstile().catch(() => undefined)
    expect(scripts()[0].async).toBe(true)
    expect(scripts()[0].defer).toBe(true)
  })

  it('si el script no baja, rechaza; y el siguiente intento pide uno nuevo (no se queda pegado)', async () => {
    const failing = loadTurnstile()
    scripts()[0].dispatchEvent(new Event('error'))
    await expect(failing).rejects.toThrow(/turnstile/i)

    expect(scripts()).toHaveLength(0) // el script roto se quita

    const retry = loadTurnstile()
    expect(scripts()).toHaveLength(1)
    const api = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() }
    ;(window as unknown as { turnstile: unknown }).turnstile = api
    scripts()[0].dispatchEvent(new Event('load'))
    await expect(retry).resolves.toBe(api)
  })

  it('si el script no responde en 10 segundos, rechaza', async () => {
    vi.useFakeTimers()
    const pending = loadTurnstile()
    const assertion = expect(pending).rejects.toThrow(/turnstile/i)

    await vi.advanceTimersByTimeAsync(10_000)

    await assertion
    expect(scripts()).toHaveLength(0)
  })

  it('si carga pero no deja la API en window, rechaza', async () => {
    const pending = loadTurnstile()
    scripts()[0].dispatchEvent(new Event('load'))
    await expect(pending).rejects.toThrow(/turnstile/i)
  })
})
