// SalesService + interceptor REALES (solo el adaptador HTTP es falso): comprueba
// qué cabeceras de dispositivo viajan de verdad en POST /sales. La venta manda
// SU deviceId (la cola offline la reenvía después, quizá con otra persona), y
// el token del dispositivo se lee de la sesión en el momento del ENVÍO.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import api from '../api'
import SalesService from '../sales.service'
import { useSessionStore } from '@/stores/session.store'
import type { CreateSalePayload } from '@/types/sale.types'

const payload: CreateSalePayload = {
  id: '0190a5f0-7c3e-7000-8000-000000000001',
  memberId: '10000000-0000-4000-8000-000000000003',
  deviceId: '20000000-0000-4000-8000-000000000001',
  occurredAt: '2026-09-23T12:00:00.000Z',
  currency: 'MXN',
  cashReceivedMinor: 250000,
  items: [{ productId: '30000000-0000-4000-8000-000000000001', quantity: 1, unitPriceMinor: 125000 }],
}

const TOKEN = 'tok-secreto-del-dispositivo'

let sent: InternalAxiosRequestConfig | null = null
const originalAdapter = api.defaults.adapter

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  sent = null
  const fake: AxiosAdapter = async (config) => {
    sent = config
    return {
      data: { id: payload.id, status: 'completada' },
      status: 201,
      statusText: 'Created',
      headers: {},
      config,
    }
  }
  api.defaults.adapter = fake
})

afterEach(() => {
  api.defaults.adapter = originalAdapter
})

const header = (name: string) => sent?.headers.get(name)

describe('SalesService.createSale — cabeceras de dispositivo en el envío real', () => {
  it('manda x-device-token cuando el deviceId de la venta es el del dispositivo de la sesión', async () => {
    useSessionStore().setDevice({ deviceId: payload.deviceId, name: 'Tablet', deviceToken: TOKEN })

    await SalesService.createSale(payload)

    expect(header('x-device-id')).toBe(payload.deviceId)
    expect(header('x-device-token')).toBe(TOKEN)
    expect(header('x-member-id')).toBe(payload.memberId)
  })

  it('NO manda el token si la venta es de OTRO dispositivo distinto al de la sesión', async () => {
    useSessionStore().setDevice({ deviceId: 'd-de-esta-tablet', name: 'Tablet', deviceToken: TOKEN })

    await SalesService.createSale(payload)

    expect(header('x-device-id')).toBe(payload.deviceId)
    expect(header('x-device-token')).toBeUndefined()
  })

  it('un dispositivo heredado (sin token) no manda x-device-token', async () => {
    useSessionStore().setDevice({ deviceId: payload.deviceId, name: 'Tablet' })

    await SalesService.createSale(payload)

    expect(header('x-device-id')).toBe(payload.deviceId)
    expect(header('x-device-token')).toBeUndefined()
  })

  it('sin dispositivo en la sesión no manda token', async () => {
    await SalesService.createSale(payload)

    expect(header('x-device-token')).toBeUndefined()
  })

  it('el token se lee de la sesión al ENVIAR: una venta encolada antes usa el token vigente después', async () => {
    const session = useSessionStore()
    session.setDevice({ deviceId: payload.deviceId, name: 'Tablet' })
    const queued = { ...payload } // se "encola" cuando el equipo aún era heredado

    session.setDevice({ deviceId: payload.deviceId, name: 'Tablet', deviceToken: TOKEN })
    await SalesService.createSale(queued)

    expect(header('x-device-token')).toBe(TOKEN)
  })

  it('el token NUNCA viaja en el cuerpo ni se añade a la venta', async () => {
    useSessionStore().setDevice({ deviceId: payload.deviceId, name: 'Tablet', deviceToken: TOKEN })
    const before = JSON.stringify(payload)

    await SalesService.createSale(payload)

    expect(String(sent?.data)).not.toContain(TOKEN)
    expect(JSON.stringify(payload)).toBe(before)
    expect(payload).not.toHaveProperty('deviceToken')
  })
})
