import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { FinanceAgreementsService } from '../finance-agreements.service'
import { FinanceAgreementContractError } from '@/utils/finance-agreements'
import { agreementOrigin } from './finance-agreements.fixture'

const selection = vi.hoisted(() => ({ current: {} as typeof agreementOrigin }))
vi.mock('../queue-origin', () => ({ currentQueueOrigin: () => selection.current }))
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn(), defaults: { transformRequest: [] } } }))

const period = { from: '2026-10-01', to: '2026-11-01' }
const answer = (over = {}) => ({ ...period, availableMinor: 1_000_000, committedMinor: 600_000, freeMinor: 400_000, agreementCount: 1, ...over })

beforeEach(() => { vi.clearAllMocks(); selection.current = { ...agreementOrigin } })

describe('FinanceAgreementsService.commitment', () => {
  it('pide el período a la ruta, con la identidad del socio, y devuelve lo validado', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: answer() })

    const result = await FinanceAgreementsService.commitment(agreementOrigin, period)

    expect(result).toEqual(answer())
    expect(api.get).toHaveBeenCalledWith('/finance/distribution-agreements/commitment', expect.objectContaining({
      params: period,
      headers: { 'x-member-id': agreementOrigin.memberId, 'x-device-id': agreementOrigin.deviceId },
    }))
  })

  it('una respuesta con otra forma es un error de contrato', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: answer({ freeMinor: 'mucho' }) })
    await expect(FinanceAgreementsService.commitment(agreementOrigin, period)).rejects.toBeInstanceOf(FinanceAgreementContractError)
  })

  it('una respuesta de otro período también lo es (no se muestra lo que no se pidió)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: answer({ from: '2026-09-01' }) })
    await expect(FinanceAgreementsService.commitment(agreementOrigin, period)).rejects.toBeInstanceOf(FinanceAgreementContractError)
  })

  it('un período inválido no sale a la red', async () => {
    await expect(FinanceAgreementsService.commitment(agreementOrigin, { from: '2026-11-01', to: '2026-10-01' })).rejects.toThrow()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('si la selección cambió, no envía nada', async () => {
    selection.current = { ...agreementOrigin, memberId: '0190aaaa-0000-7000-8000-000000000099' }
    await expect(FinanceAgreementsService.commitment(agreementOrigin, period)).rejects.toThrow()
    expect(api.get).not.toHaveBeenCalled()
  })
})
