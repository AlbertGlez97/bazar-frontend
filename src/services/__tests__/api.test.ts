import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Importar el módulo REAL (no mockeado) ────────────────────────────────────
import api from '@/services/api'
import type { InternalAxiosRequestConfig, AxiosError } from 'axios'

// Axios no tipa los `handlers` internos de los interceptores; los describimos aquí
interface RequestHandlers {
  handlers: { fulfilled: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig }[]
}
interface ResponseHandlers {
  handlers: {
    fulfilled: (response: unknown) => unknown
    rejected: (error: AxiosError) => Promise<never>
  }[]
}

describe('api — interceptores Axios', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // ── Interceptor de solicitud ──────────────────────────────────────────────

  it('agrega Authorization header si hay access_token en localStorage', () => {
    localStorage.setItem('access_token', 'jwt-test-token')

    // Simular la config que pasaría el interceptor de solicitud
    const config = { headers: {} as Record<string, string> } as InternalAxiosRequestConfig
    // Acceder al primer handler del interceptor de solicitud
    const handler = (api.interceptors.request as unknown as RequestHandlers).handlers[0]
    const result = handler.fulfilled(config)

    expect(result.headers.Authorization).toBe('Bearer jwt-test-token')
  })

  it('NO agrega Authorization header si no hay token', () => {
    const config = { headers: {} as Record<string, string> } as InternalAxiosRequestConfig
    const handler = (api.interceptors.request as unknown as RequestHandlers).handlers[0]
    const result = handler.fulfilled(config)

    expect(result.headers.Authorization).toBeUndefined()
  })

  // ── Interceptor de respuesta ──────────────────────────────────────────────

  it('pasa la respuesta sin modificaciones en el interceptor fulfilled', () => {
    const response = { data: { ok: true }, status: 200 }
    const handler = (api.interceptors.response as unknown as ResponseHandlers).handlers[0]
    const result = handler.fulfilled(response)

    expect(result).toEqual(response)
  })

  it('en un 401 de endpoint autenticado: limpia localStorage', async () => {
    localStorage.setItem('access_token', 'jwt-xxx')
    localStorage.setItem('user', JSON.stringify({ id: 'u-1' }))

    // Mock para evitar redirección real
    const originalHref = window.location.href
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/dashboard', href: originalHref },
    })

    const error = {
      response: { status: 401 },
      config:   { url: '/dashboard/data' },
    } as AxiosError

    const handler = (api.interceptors.response as unknown as ResponseHandlers).handlers[0]
    await expect(handler.rejected(error)).rejects.toBeDefined()

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('en un 401 de /auth/login: NO limpia localStorage', async () => {
    localStorage.setItem('access_token', 'jwt-xxx')

    const error = {
      response: { status: 401 },
      config:   { url: '/auth/login' },
    } as AxiosError

    const handler = (api.interceptors.response as unknown as ResponseHandlers).handlers[0]
    await expect(handler.rejected(error)).rejects.toBeDefined()

    // El token NO se debe borrar cuando el 401 viene de /auth/login
    expect(localStorage.getItem('access_token')).toBe('jwt-xxx')
  })

  it('en un error distinto de 401: rechaza la promesa sin modificar localStorage', async () => {
    localStorage.setItem('access_token', 'jwt-xxx')

    const error = {
      response: { status: 500 },
      config:   { url: '/budgets' },
    } as AxiosError

    const handler = (api.interceptors.response as unknown as ResponseHandlers).handlers[0]
    await expect(handler.rejected(error)).rejects.toBeDefined()

    expect(localStorage.getItem('access_token')).toBe('jwt-xxx')
  })
})
