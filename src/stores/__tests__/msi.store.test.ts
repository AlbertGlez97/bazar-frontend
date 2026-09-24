import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/stores/toast.store', () => ({
  useToastStore: () => ({ success: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/services/msi.service', () => ({
  MsiService: {
    getAll:  vi.fn(),
    create:  vi.fn(),
    remove:  vi.fn(),
  },
}))

import { useMsiStore } from '@/stores/msi.store'
import { MsiService } from '@/services/msi.service'
import type { MsiPurchase, CreateMsiPayload } from '@/types/msi.types'

const mkPurchase = (overrides: Partial<MsiPurchase> = {}): MsiPurchase => ({
  id: 'msi-1', userId: 'u-1', name: 'Laptop', store: 'BestBuy',
  totalAmount: 24000, installments: 12, monthlyAmount: 2000,
  startYear: 2026, startMonth: 1, status: 'active', createdAt: '2026-01-01',
  ...overrides,
})

describe('useMsiStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // ── fetchAll ─────────────────────────────────────────────────────────────

  it('carga todas las compras MSI', async () => {
    const compras = [mkPurchase(), mkPurchase({ id: 'msi-2', name: 'Refrigerador' })]
    vi.mocked(MsiService.getAll).mockResolvedValue(compras)

    const store = useMsiStore()
    await store.fetchAll()

    expect(store.compras).toHaveLength(2)
    expect(store.loading).toBe(false)
  })

  it('muestra toast error y pone loading=false si fetchAll falla', async () => {
    vi.mocked(MsiService.getAll).mockRejectedValue(new Error('network'))

    const store = useMsiStore()
    await store.fetchAll()

    expect(store.compras).toHaveLength(0)
    expect(store.loading).toBe(false)
  })

  it('loading es true mientras se ejecuta fetchAll', async () => {
    let resolve!: (v: MsiPurchase[]) => void
    vi.mocked(MsiService.getAll).mockReturnValue(new Promise(r => { resolve = r }))

    const store = useMsiStore()
    const promise = store.fetchAll()
    expect(store.loading).toBe(true)

    resolve([])
    await promise
    expect(store.loading).toBe(false)
  })

  // ── create ───────────────────────────────────────────────────────────────

  it('agrega la nueva compra al inicio del array (unshift)', async () => {
    const existente = mkPurchase({ id: 'msi-old', name: 'Vieja' })
    const nueva     = mkPurchase({ id: 'msi-new', name: 'Nueva Laptop' })

    vi.mocked(MsiService.getAll).mockResolvedValue([existente])
    vi.mocked(MsiService.create).mockResolvedValue(nueva)

    const store = useMsiStore()
    await store.fetchAll()

    const payload: CreateMsiPayload = {
      name: 'Nueva Laptop', totalAmount: 24000, installments: 12,
      startYear: 2026, startMonth: 7,
    }
    const result = await store.create(payload)

    expect(store.compras[0]).toEqual(nueva)
    expect(result).toEqual(nueva)
  })

  it('propaga el error si create falla', async () => {
    vi.mocked(MsiService.create).mockRejectedValue(new Error('fail'))

    const store = useMsiStore()
    await expect(store.create({
      name: 'X', totalAmount: 1000, installments: 3,
      startYear: 2026, startMonth: 1,
    })).rejects.toThrow('fail')
  })

  // ── remove ───────────────────────────────────────────────────────────────

  it('elimina la compra del array', async () => {
    vi.mocked(MsiService.getAll).mockResolvedValue([mkPurchase({ id: 'msi-1' }), mkPurchase({ id: 'msi-2' })])
    vi.mocked(MsiService.remove).mockResolvedValue()

    const store = useMsiStore()
    await store.fetchAll()
    await store.remove('msi-1')

    expect(store.compras.find(c => c.id === 'msi-1')).toBeUndefined()
    expect(store.compras).toHaveLength(1)
  })

  it('propaga el error si remove falla', async () => {
    vi.mocked(MsiService.getAll).mockResolvedValue([mkPurchase()])
    vi.mocked(MsiService.remove).mockRejectedValue(new Error('network'))

    const store = useMsiStore()
    await store.fetchAll()
    await expect(store.remove('msi-1')).rejects.toThrow('network')
  })
})
