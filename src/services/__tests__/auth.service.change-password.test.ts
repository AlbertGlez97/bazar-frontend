// AuthService.changePassword + interceptor REALES (solo el adaptador HTTP es
// falso). El backend responde 403 (no 401) cuando la contraseña actual es
// incorrecta justamente para que el interceptor NO lo confunda con un token
// vencido: equivocarse al escribir la contraseña actual nunca cierra la sesión.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import api from '../api'
import AuthService from '../auth.service'
import { useSessionStore } from '@/stores/session.store'

const originalAdapter = api.defaults.adapter
let sent: InternalAxiosRequestConfig | null = null

function respondWith(status: number, data: unknown = '') {
  const fake: AxiosAdapter = async (config) => {
    sent = config
    if (status >= 400) {
      throw Object.assign(new Error(`Request failed with status code ${status}`), {
        isAxiosError: true,
        config,
        response: { status, data, headers: {}, config },
      })
    }
    return { data, status, statusText: 'OK', headers: {}, config }
  }
  api.defaults.adapter = fake
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  sent = null
  localStorage.setItem('access_token', 'jwt-vigente')
  useSessionStore().setMember({ id: 'm-1', name: 'Ana', role: 'socio', active: true })
})

afterEach(() => {
  api.defaults.adapter = originalAdapter
})

const payload = { currentPassword: 'la-de-hoy-123', newPassword: 'la-de-manana-456' }

describe('AuthService.changePassword — petición real', () => {
  it('viaja con el JWT y a la ruta correcta', async () => {
    respondWith(204)
    await AuthService.changePassword(payload)
    expect(sent?.url).toBe('/auth/change-password')
    expect(sent?.method).toBe('post')
    expect(sent?.headers.get('Authorization')).toBe('Bearer jwt-vigente')
  })

  it('un 403 (contraseña actual incorrecta) NO borra la sesión ni a la persona elegida', async () => {
    respondWith(403, { message: 'Current password is incorrect' })
    await expect(AuthService.changePassword(payload)).rejects.toMatchObject({ response: { status: 403 } })
    expect(localStorage.getItem('access_token')).toBe('jwt-vigente')
    expect(useSessionStore().member?.id).toBe('m-1')
  })

  it('un 400 de validación tampoco cierra la sesión', async () => {
    respondWith(400, { message: ['newPassword is too short'] })
    await expect(AuthService.changePassword(payload)).rejects.toMatchObject({ response: { status: 400 } })
    expect(localStorage.getItem('access_token')).toBe('jwt-vigente')
  })
})
