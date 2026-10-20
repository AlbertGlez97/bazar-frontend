import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinanceAgreementsStore } from '../finance-agreements.store'
import { agreementOrigin } from '@/services/__tests__/finance-agreements.fixture'

const mocks = vi.hoisted(() => ({ commitment: vi.fn() }))
vi.mock('@/services/finance-agreements.service', () => ({ FinanceAgreementsService: mocks }))
const state = reactive({ auth: { token: 'token-a' }, session: {
  owner: { accountId: agreementOrigin.accountId, apiBase: '/api/v1' },
  memberId: agreementOrigin.memberId, deviceId: agreementOrigin.deviceId, deviceToken: 'device-token',
  member: { role: 'socio', active: true },
} })
vi.mock('../auth.store', () => ({ useAuthStore: () => state.auth }))
vi.mock('../session.store', () => ({ useSessionStore: () => state.session }))
vi.mock('@/services/queue-origin', () => ({ currentQueueOrigin: () => ({
  ...state.session.owner, memberId: state.session.memberId, deviceId: state.session.deviceId,
}) }))

const period = { from: '2026-10-01', to: '2026-11-01' }
const answer = (over = {}) => ({ ...period, availableMinor: 1_000_000, committedMinor: 600_000, freeMinor: 400_000, agreementCount: 1, ...over })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  state.auth.token = 'token-a'
  state.session.member = { role: 'socio', active: true }
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  mocks.commitment.mockResolvedValue(answer())
})

describe('finance-agreements.store — comprometido', () => {
  it('carga disponible, comprometido y libre del período', async () => {
    const store = useFinanceAgreementsStore()

    await store.loadCommitment(period.from, period.to)

    expect(mocks.commitment).toHaveBeenCalledWith(expect.objectContaining({ memberId: agreementOrigin.memberId }), period)
    expect(store.commitment).toEqual(answer())
    expect(store.commitmentLoading).toBe(false)
    expect(store.commitmentError).toBe('')
  })

  it('mientras carga lo indica y borra lo de otro período', async () => {
    const pending = deferred<ReturnType<typeof answer>>()
    const store = useFinanceAgreementsStore()
    await store.loadCommitment(period.from, period.to)
    expect(store.commitment).not.toBeNull()
    mocks.commitment.mockReturnValueOnce(pending.promise)

    const next = store.loadCommitment('2026-11-01', '2026-12-01')

    expect(store.commitmentLoading).toBe(true)
    expect(store.commitment).toBeNull()
    pending.resolve(answer({ from: '2026-11-01', to: '2026-12-01' }))
    await next
    expect(store.commitment?.from).toBe('2026-11-01')
  })

  it('una respuesta tardía de una consulta anterior no pisa a la más nueva', async () => {
    const slow = deferred<ReturnType<typeof answer>>()
    mocks.commitment.mockReturnValueOnce(slow.promise)
    const store = useFinanceAgreementsStore()
    const first = store.loadCommitment(period.from, period.to)
    mocks.commitment.mockResolvedValueOnce(answer({ from: '2026-11-01', to: '2026-12-01', freeMinor: 7 }))
    await store.loadCommitment('2026-11-01', '2026-12-01')

    slow.resolve(answer({ freeMinor: 999 }))
    await first

    expect(store.commitment?.freeMinor).toBe(7)
  })

  it('si falla deja un aviso amable y sin cifras (el servidor igual revisa al crear)', async () => {
    mocks.commitment.mockRejectedValue({ response: { status: 500 } })
    const store = useFinanceAgreementsStore()

    await store.loadCommitment(period.from, period.to)

    expect(store.commitment).toBeNull()
    expect(store.commitmentError).toContain('No pudimos consultar')
    expect(store.commitmentLoading).toBe(false)
  })

  it('sin conexión no sale a la red', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const store = useFinanceAgreementsStore()

    await store.loadCommitment(period.from, period.to)

    expect(mocks.commitment).not.toHaveBeenCalled()
    expect(store.commitmentError).not.toBe('')
  })

  it('quien no es socio activo no consulta', async () => {
    state.session.member = { role: 'colaborador', active: true }
    const store = useFinanceAgreementsStore()

    await store.loadCommitment(period.from, period.to)

    expect(mocks.commitment).not.toHaveBeenCalled()
  })

  it('al cambiar de sesión se borra lo consultado', async () => {
    const store = useFinanceAgreementsStore()
    await store.loadCommitment(period.from, period.to)

    state.auth.token = 'otra-sesion'

    expect(store.commitment).toBeNull()
  })

  it('clearCommitment lo borra', async () => {
    const store = useFinanceAgreementsStore()
    await store.loadCommitment(period.from, period.to)

    store.clearCommitment()

    expect(store.commitment).toBeNull()
    expect(store.commitmentError).toBe('')
  })
})
