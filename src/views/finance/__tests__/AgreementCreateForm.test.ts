import { afterEach, describe, expect, it } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import AgreementCreateForm from '../components/AgreementCreateForm.vue'
import { simulationFixture } from '@/services/__tests__/finance-distribution.fixture'
import { agreementFixture } from '@/services/__tests__/finance-agreements.fixture'
const request = { from: '2026-10-01', to: '2026-11-01', requestedAmountMinor: 600000,
  partnerShareBps: 5000, workShareBps: 5000, workBasis: 'WORK_SHIFTS' as const }
const props = () => ({ modelValue: false, simulation: simulationFixture(), request,
  eligible: true, retryAllowed: true, busy: false, error: '', pending: null, created: null })
const wrappers: ReturnType<typeof mount>[] = []
const mounted = async (over = {}) => {
  const w = mount(AgreementCreateForm, { props: { ...props(), ...over }, attachTo: document.body,
    global: { stubs: { RouterLink: RouterLinkStub, teleport: true } } })
  wrappers.push(w)
  await w.setProps({ modelValue: true })
  await flushPromises()
  return w
}
afterEach(() => { wrappers.splice(0).forEach((w) => w.unmount()); document.body.innerHTML = '' })
describe('agreement creation confirmation', () => {
  it('renders frozen review, requires title, uses no extra checkbox and submits exact fields', async () => {
    const w = await mounted()
    expect(w.find('[data-test="confirm-agreement"]').attributes('disabled')).toBeDefined()
    expect(w.find('input[type="checkbox"]').exists()).toBe(false)
    expect(w.text()).toContain('No es un contrato legal ni registra pagos')
    expect(w.text()).toContain('Alberto')
    expect(w.text()).toContain('Adid')
    expect(w.text()).toContain('$6,000.00')
    expect(w.text()).toContain('EQUAL')
    await w.find('#agreement-title').setValue('  October agreement  ')
    await w.find('#agreement-note').setValue('  Accepted note  ')
    await w.find('form').trigger('submit')
    expect(w.emitted('create')?.[0]?.[0]).toEqual({ ...request, title: 'October agreement', note: 'Accepted note', simulationFingerprint: simulationFixture().simulationFingerprint })
    expect(w.find('label[for="agreement-title"]').exists()).toBe(true)
    expect(w.find('label[for="agreement-note"]').exists()).toBe(true)
  })
  it('ignores forced submission after eligibility loss and prevents cancellation during a write', async () => {
    const w = await mounted()
    await w.find('#agreement-title').setValue('Title')
    await w.setProps({ eligible: false })
    await w.find('form').trigger('submit')
    expect(w.emitted('create')).toBeUndefined()
    await w.setProps({ busy: true })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(w.find('[data-test="cancel-agreement"]').attributes('disabled')).toBeDefined()
  })
  it('warns and replays a locked original attempt without emitting new creation', async () => {
    const pending = { ...request, id: agreementFixture().id, title: 'Original title', note: 'Original note', simulationFingerprint: simulationFixture().simulationFingerprint,
      occurredAt: agreementFixture().occurredAt, createdByMemberId: agreementFixture().createdBy.memberId, deviceId: agreementFixture().createdBy.deviceId }
    const w = await mounted({ pending, eligible: false })
    expect((w.find('#agreement-title').element as HTMLInputElement).value).toBe('Original title')
    expect(w.find('#agreement-title').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="pending-attempt"]').text()).toContain('exactamente el mismo')
    expect(w.find('[data-test="confirm-agreement"]').exists()).toBe(false)
    await w.find('[data-test="retry-agreement"]').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
    expect(w.emitted('create')).toBeUndefined()
    await w.setProps({ retryAllowed: false })
    expect(w.find('[data-test="retry-agreement"]').attributes('disabled')).toBeDefined()
  })
  it('restores opener focus on cancellation and traps keyboard focus inside the modal', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const w = await mounted()
    expect(document.activeElement).toBe(w.find('#agreement-title').element)
    const cancel = w.find('[data-test="cancel-agreement"]')
    ;(cancel.element as HTMLElement).focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Cerrar')
    await cancel.trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([false])
    await w.setProps({ modelValue: false })
    expect(document.activeElement).toBe(opener)
  })
  it('shows server folio, safe detail navigation and explicit return after success', async () => {
    const w = await mounted()
    await w.setProps({ created: agreementFixture() })
    await flushPromises()
    expect(w.find('[data-test="agreement-success"]').text()).toContain('AC-2026-00001')
    expect(w.findComponent(RouterLinkStub).props('to')).toBe('/app/finanzas/acuerdos/' + agreementFixture().id)
    expect(document.activeElement).toBe(w.find('h3').element)
    expect(w.find('[data-test="confirm-agreement"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Descargar PDF')
  })
})

it('shows the authoritative replacement folio and includes its id in the confirmed strict fields', async () => {
  const target = { id: agreementFixture().id, folio: agreementFixture().folio }
  const w = await mounted({ replacement: target })
  expect(w.find('[data-test="replacement-confirmation"]').text()).toContain(target.folio)
  await w.find('#agreement-title').setValue('Replacement')
  await w.find('form').trigger('submit')
  expect((w.emitted('create')?.[0]?.[0] as { replacesAgreementId: string }).replacesAgreementId).toBe(target.id)
})
