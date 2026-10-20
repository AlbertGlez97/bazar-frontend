// Aviso "Disponible / Comprometido / Libre" y bloqueo cuando no alcanza.
import { afterEach, describe, expect, it } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import AgreementCreateForm from '../components/AgreementCreateForm.vue'
import { simulationFixture } from '@/services/__tests__/finance-distribution.fixture'
import { agreementFixture } from '@/services/__tests__/finance-agreements.fixture'

const request = { from: '2026-10-01', to: '2026-11-01', requestedAmountMinor: 600000,
  partnerShareBps: 5000, workShareBps: 5000, workBasis: 'WORK_SHIFTS' as const }
const commitment = (over = {}) => ({ from: request.from, to: request.to, availableMinor: 1_000_000, committedMinor: 0, freeMinor: 1_000_000, agreementCount: 0, ...over })
const baseProps = () => ({ modelValue: false, simulation: simulationFixture(), request, eligible: true, retryAllowed: true,
  busy: false, error: '', pending: null, created: null, commitment: commitment() })
const wrappers: ReturnType<typeof mount>[] = []
const mounted = async (over = {}) => {
  const w = mount(AgreementCreateForm, { props: { ...baseProps(), ...over }, attachTo: document.body,
    global: { stubs: { RouterLink: RouterLinkStub, teleport: true } } })
  wrappers.push(w)
  await w.setProps({ modelValue: true })
  await flushPromises()
  return w
}
afterEach(() => { wrappers.splice(0).forEach((w) => w.unmount()); document.body.innerHTML = '' })
const confirm = (w: Awaited<ReturnType<typeof mounted>>) => w.find('[data-test="confirm-agreement"]')

describe('AgreementCreateForm — disponible, comprometido y libre', () => {
  it('muestra las tres cifras del período', async () => {
    const w = await mounted({ commitment: commitment({ committedMinor: 100_000, freeMinor: 900_000, agreementCount: 1 }) })
    expect(w.find('.commitment-summary').exists()).toBe(true)
    expect(w.findAll('.commitment-summary dd').map((d) => d.text())).toEqual(['$10,000.00', '$1,000.00', '$9,000.00'])
  })

  it('si cabe: sin aviso y se puede crear al escribir el título', async () => {
    const w = await mounted()
    await w.find('#agreement-title').setValue('Octubre')
    expect(w.find('[data-test="commitment-block"]').exists()).toBe(false)
    expect(confirm(w).attributes('disabled')).toBeUndefined()
  })

  it('si no alcanza: aviso con cuánto falta, acción deshabilitada y no se envía ni a la fuerza', async () => {
    const w = await mounted({ commitment: commitment({ committedMinor: 600_000, freeMinor: 400_000, agreementCount: 1 }) })
    await w.find('#agreement-title').setValue('Octubre')

    expect(w.find('[data-test="commitment-block"]').text()).toContain('Faltan $2,000.00.')
    expect(confirm(w).attributes('disabled')).toBeDefined()
    await w.find('form').trigger('submit')
    expect(w.emitted('create')).toBeUndefined()
  })

  it('justo lo que queda libre sí cabe; un centavo más no', async () => {
    const exact = await mounted({ commitment: commitment({ committedMinor: 400_000, freeMinor: 600_000 }) })
    await exact.find('#agreement-title').setValue('Octubre')
    expect(confirm(exact).attributes('disabled')).toBeUndefined()

    const over = await mounted({ commitment: commitment({ committedMinor: 400_001, freeMinor: 599_999 }) })
    await over.find('#agreement-title').setValue('Octubre')
    expect(confirm(over).attributes('disabled')).toBeDefined()
  })

  it('el aviso se anuncia a lectores de pantalla y explica qué hacer', async () => {
    const w = await mounted({ commitment: commitment({ freeMinor: 0, committedMinor: 1_000_000 }) })
    const block = w.find('[data-test="commitment-block"]')
    expect(block.attributes('role')).toBe('alert')
    expect(block.text()).toContain('Baja el monto o anula un acuerdo vigente')
  })

  it('mientras consulta o si falla no bloquea (el servidor revisa al crear) y lo dice', async () => {
    const loading = await mounted({ commitment: null, commitmentLoading: true })
    await loading.find('#agreement-title').setValue('Octubre')
    expect(confirm(loading).attributes('disabled')).toBeUndefined()
    expect(loading.text()).toContain('Consultando')

    const failed = await mounted({ commitment: null, commitmentError: 'No pudimos consultar cuánto está comprometido.' })
    await failed.find('#agreement-title').setValue('Octubre')
    expect(confirm(failed).attributes('disabled')).toBeUndefined()
    expect(failed.text()).toContain('No pudimos consultar cuánto está comprometido.')
  })

  it('reintentar el mismo intento no se bloquea: es una repetición, no un acuerdo nuevo', async () => {
    const pending = { ...request, id: agreementFixture().id, title: 'Original', note: '', simulationFingerprint: simulationFixture().simulationFingerprint,
      occurredAt: agreementFixture().occurredAt, createdByMemberId: agreementFixture().createdBy.memberId, deviceId: agreementFixture().createdBy.deviceId }
    const w = await mounted({ pending, eligible: false, commitment: commitment({ committedMinor: 1_000_000, freeMinor: 0 }) })
    expect(w.find('[data-test="commitment-block"]').exists()).toBe(false)
    expect(w.find('[data-test="retry-agreement"]').attributes('disabled')).toBeUndefined()
  })

  it('una cifra de otro período no se usa', async () => {
    const w = await mounted({ commitment: commitment({ from: '2026-09-01', to: '2026-10-01', freeMinor: 0, committedMinor: 1_000_000 }) })
    await w.find('#agreement-title').setValue('Octubre')
    expect(w.find('.commitment-summary dd').exists()).toBe(false)
    expect(confirm(w).attributes('disabled')).toBeUndefined()
  })
})
