import { afterEach, describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AgreementVoidForm from '../components/AgreementVoidForm.vue'
import { reversalFixture } from '@/services/__tests__/finance-agreements.fixture'
const wrappers: ReturnType<typeof mount>[] = []
async function mounted(over = {}) {
  const w = mount(AgreementVoidForm, { props: { modelValue: false, folio: 'AC-2026-00001', allowed: true, busy: false, error: '', pending: null, ...over }, attachTo: document.body, global: { stubs: { teleport: true } } })
  wrappers.push(w); await w.setProps({ modelValue: true }); await flushPromises(); return w
}
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); document.body.innerHTML = '' })
describe('reversal confirmation', () => {
  it('requires a trimmed reason and emits an explicit confirmation without a checkbox', async () => {
    const w = await mounted()
    expect(w.find('[data-test="confirm-void"]').attributes('disabled')).toBeDefined()
    expect(w.find('input[type="checkbox"]').exists()).toBe(false)
    await w.find('#agreement-void-reason').setValue('  Correction  ')
    await w.find('form').trigger('submit')
    expect(w.emitted('confirm')?.[0]).toEqual(['Correction'])
    expect(w.text()).toContain('No registra pagos')
    await w.find('#agreement-void-reason').setValue('x'.repeat(1001))
    expect(w.find('[data-test="confirm-void"]').attributes('disabled')).toBeDefined()
  })
  it('locks the uncertain reason and emits only explicit original retry', async () => {
    const w = await mounted({ pending: reversalFixture() })
    expect(w.find('#agreement-void-reason').attributes('disabled')).toBeDefined()
    expect((w.find('#agreement-void-reason').element as HTMLTextAreaElement).value).toBe('Correction')
    await w.find('[data-test="retry-void"]').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
    expect(w.emitted('confirm')).toBeUndefined()
    await w.setProps({ allowed: false }); await w.find('form').trigger('submit')
    expect(w.emitted('retry')).toHaveLength(1)
  })
  it('traps focus, restores the opener and blocks escape while busy', async () => {
    const opener = document.createElement('button'); document.body.append(opener); opener.focus()
    const w = await mounted()
    expect(document.activeElement).toBe(w.find('#agreement-void-reason').element)
    ;(w.find('[data-test="cancel-void"]').element as HTMLElement).focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Cerrar')
    await w.setProps({ busy: true }); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await flushPromises()
    expect(w.emitted('update:modelValue')).toBeUndefined()
    await w.setProps({ busy: false }); await w.find('[data-test="cancel-void"]').trigger('click'); await w.setProps({ modelValue: false })
    expect(document.activeElement).toBe(opener)
  })
})
