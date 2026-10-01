// Regla de "atrasada" (BE-15, doc/api-contract-for-frontend.md §10 GET
// /deudas): tiene al menos una CuotaPlaneada vencida (fechaEsperada pasada) Y
// la suma de montoEsperadoMinor vencidas supera la suma de Abono.montoMinor
// reales recibidos hasta hoy. Se calcula en el cliente con la MISMA fórmula
// que documenta el backend (los datos —cuotasPlaneadas/abonos— sí vienen de
// él); el backend no manda un campo `atrasado` por deuda, solo el filtro
// `?atrasado=` para el listado.
import { describe, expect, it } from 'vitest'
import { pendienteMinorOf, isDeudaAtrasada, deudaStatusColor, deudaStatusLabel } from '../deuda-status'
import { VOICE } from '@/config/voice'
import type { Deuda } from '@/types/deuda.types'

const NOW = new Date('2026-09-30T12:00:00.000Z')

function deudaFor(overrides: Partial<Deuda> = {}): Deuda {
  return {
    id: 'd-1',
    type: 'fiado',
    deudorId: 'deudor-1',
    productId: 'p-1',
    contextId: 'ctx',
    cantidad: 1,
    totalMinor: 10000,
    status: 'pendiente',
    unitCostMinor: null,
    saldadaAt: null,
    createdByMemberId: 'm-1',
    createdAt: '2026-09-01T00:00:00.000Z',
    abonos: [],
    cuotasPlaneadas: [],
    ...overrides,
  }
}

describe('isDeudaAtrasada', () => {
  it('keeps today current until the following business midnight, not UTC midnight', () => {
    const deuda = deudaFor({ cuotasPlaneadas: [{ id: 'c-1', deudaId: 'd-1', contextId: 'ctx', fechaEsperada: '2026-10-01', montoEsperadoMinor: 5000, createdAt: '2026-09-01T12:00:00.000Z' }] })
    expect(isDeudaAtrasada(deuda, new Date('2026-10-02T05:59:59.999Z'))).toBe(false)
    expect(isDeudaAtrasada(deuda, new Date('2026-10-02T06:00:00.000Z'))).toBe(true)
  })
  it('sin cuotas planeadas, nunca está atrasada', () => {
    expect(isDeudaAtrasada(deudaFor(), NOW)).toBe(false)
  })

  it('con una cuota futura (no vencida), no está atrasada', () => {
    const deuda = deudaFor({ cuotasPlaneadas: [{ id: 'c-1', deudaId: 'd-1', contextId: 'ctx', fechaEsperada: '2026-10-15', montoEsperadoMinor: 5000, createdAt: '2026-09-01T00:00:00.000Z' }] })
    expect(isDeudaAtrasada(deuda, NOW)).toBe(false)
  })

  it('con una cuota vencida y sin abonos, está atrasada', () => {
    const deuda = deudaFor({ cuotasPlaneadas: [{ id: 'c-1', deudaId: 'd-1', contextId: 'ctx', fechaEsperada: '2026-09-01', montoEsperadoMinor: 5000, createdAt: '2026-08-01T00:00:00.000Z' }] })
    expect(isDeudaAtrasada(deuda, NOW)).toBe(true)
  })

  it('con una cuota vencida ya cubierta por abonos reales, NO está atrasada', () => {
    const deuda = deudaFor({
      cuotasPlaneadas: [{ id: 'c-1', deudaId: 'd-1', contextId: 'ctx', fechaEsperada: '2026-09-01', montoEsperadoMinor: 5000, createdAt: '2026-08-01T00:00:00.000Z' }],
      abonos: [{ id: 'a-1', deudaId: 'd-1', contextId: 'ctx', montoMinor: 5000, receivedByMemberId: 'm-1', receivedAt: '2026-09-02T00:00:00.000Z', nota: null }],
    })
    expect(isDeudaAtrasada(deuda, NOW)).toBe(false)
  })

  it('con una cuota vencida parcialmente cubierta, sigue atrasada', () => {
    const deuda = deudaFor({
      cuotasPlaneadas: [{ id: 'c-1', deudaId: 'd-1', contextId: 'ctx', fechaEsperada: '2026-09-01', montoEsperadoMinor: 5000, createdAt: '2026-08-01T00:00:00.000Z' }],
      abonos: [{ id: 'a-1', deudaId: 'd-1', contextId: 'ctx', montoMinor: 2000, receivedByMemberId: 'm-1', receivedAt: '2026-09-02T00:00:00.000Z', nota: null }],
    })
    expect(isDeudaAtrasada(deuda, NOW)).toBe(true)
  })

  it('una deuda saldada con cuota vencida ya no cuenta como atrasada (abonos cubren todo)', () => {
    const deuda = deudaFor({
      status: 'saldada',
      cuotasPlaneadas: [{ id: 'c-1', deudaId: 'd-1', contextId: 'ctx', fechaEsperada: '2026-09-01', montoEsperadoMinor: 5000, createdAt: '2026-08-01T00:00:00.000Z' }],
      abonos: [{ id: 'a-1', deudaId: 'd-1', contextId: 'ctx', montoMinor: 10000, receivedByMemberId: 'm-1', receivedAt: '2026-09-02T00:00:00.000Z', nota: null }],
    })
    expect(isDeudaAtrasada(deuda, NOW)).toBe(false)
  })
})

describe('deudaStatusColor', () => {
  it('pendiente es "amber"', () => {
    expect(deudaStatusColor(deudaFor({ status: 'pendiente' }))).toBe('amber')
  })

  it('saldada es "green"', () => {
    expect(deudaStatusColor(deudaFor({ status: 'saldada' }))).toBe('green')
  })
})

describe('deudaStatusLabel', () => {
  it('pendiente usa VOICE.deudasView.statusPendiente', () => {
    expect(deudaStatusLabel(deudaFor({ status: 'pendiente' }))).toBe(VOICE.deudasView.statusPendiente)
  })

  it('saldada usa VOICE.deudasView.statusSaldada', () => {
    expect(deudaStatusLabel(deudaFor({ status: 'saldada' }))).toBe(VOICE.deudasView.statusSaldada)
  })
})

describe('pendienteMinorOf', () => {
  it('sin abonos, el saldo es el total completo', () => {
    expect(pendienteMinorOf(deudaFor({ totalMinor: 5997 }))).toBe(5997)
  })

  it('resta la suma de abonos del total', () => {
    const deuda = deudaFor({
      totalMinor: 5997,
      abonos: [
        { id: 'a-1', deudaId: 'd-1', contextId: 'ctx', montoMinor: 2000, receivedByMemberId: 'm-1', receivedAt: '2026-09-02T00:00:00.000Z', nota: null },
        { id: 'a-2', deudaId: 'd-1', contextId: 'ctx', montoMinor: 1000, receivedByMemberId: 'm-1', receivedAt: '2026-09-03T00:00:00.000Z', nota: null },
      ],
    })
    expect(pendienteMinorOf(deuda)).toBe(2997)
  })
})
