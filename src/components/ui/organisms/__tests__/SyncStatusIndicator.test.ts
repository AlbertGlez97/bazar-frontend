import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SyncStatusIndicator from '../SyncStatusIndicator.vue'

type Props = InstanceType<typeof SyncStatusIndicator>['$props']

const record = (id: string, extra: Partial<{ totalMinorEstimate: number; sellerName: string; lastError: string; createdAt: string }> = {}) => ({
  id,
  createdAt: new Date(2026, 8, 25, 11, 30).toISOString(),
  totalMinorEstimate: 25000,
  sellerName: 'Carlos',
  lastError: 'Cuando esta venta llegó al servidor, uno de los productos ya no tenía piezas suficientes. Un socio puede revisarla.',
  ...extra,
})

function mountIndicator(props: Partial<Props> = {}) {
  return mount(SyncStatusIndicator, {
    props: { pendingCount: 0, needsReviewCount: 0, isSyncing: false, records: [], ...props },
    global: { stubs: { teleport: true } },
  })
}

describe('SyncStatusIndicator — visibilidad', () => {
  it('con 0 pendientes y 0 por revisar no dibuja nada', () => {
    const wrapper = mountIndicator()
    expect(wrapper.find('.sync-status').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('sincronizando sin nada pendiente tampoco dibuja nada', () => {
    expect(mountIndicator({ isSyncing: true }).find('.sync-status').exists()).toBe(false)
  })
})

describe('SyncStatusIndicator — pendientes', () => {
  it('singular y plural con el copy calmado de la marca', () => {
    expect(mountIndicator({ pendingCount: 1 }).get('.sync-status__pending').text()).toContain('1 venta pendiente de sincronizar')
    expect(mountIndicator({ pendingCount: 3 }).get('.sync-status__pending').text()).toContain('3 ventas pendientes de sincronizar')
  })

  it('mientras envía dice "Enviando…" en vez de "pendientes"', () => {
    const wrapper = mountIndicator({ pendingCount: 2, isSyncing: true })
    expect(wrapper.get('.sync-status__pending').text()).toContain('Enviando 2 ventas…')
    expect(wrapper.get('.sync-status__pending').text()).not.toContain('pendientes')
  })

  it('es una región viva educada (no interrumpe)', () => {
    const region = mountIndicator({ pendingCount: 1 }).get('.sync-status')
    expect(region.attributes('role')).toBe('status')
    expect(region.attributes('aria-live')).toBe('polite')
  })

  it('el tono es calmado: nada de "error", "falló" ni exclamaciones', () => {
    const wrapper = mountIndicator({ pendingCount: 2, needsReviewCount: 1, records: [record('a')] })
    expect(wrapper.text()).not.toMatch(/error|falló|falla|!/i)
  })

  it('sin pendientes pero con ventas por revisar no habla de pendientes', () => {
    const wrapper = mountIndicator({ needsReviewCount: 1, records: [record('a')] })
    expect(wrapper.find('.sync-status__pending').exists()).toBe(false)
  })
})

describe('SyncStatusIndicator — ventas por revisar', () => {
  it('es una nota aparte, con su propio texto y un botón "Ver"', () => {
    const wrapper = mountIndicator({ pendingCount: 1, needsReviewCount: 2, records: [record('a'), record('b')] })
    const note = wrapper.get('.sync-status__review')
    expect(note.text()).toContain('2 ventas necesitan que las revises')
    const see = note.get('button[data-action="see-review"]')
    expect(see.text()).toBe('Ver')
    expect(see.attributes('aria-label')).toBe('Ver las ventas que necesitan revisión')
    expect(see.attributes('type')).toBe('button')
  })

  it('"Ver" abre la lista con monto, quién vendió, hora y motivo', async () => {
    const wrapper = mountIndicator({ needsReviewCount: 1, records: [record('a')] })
    expect(wrapper.text()).not.toContain('Ventas por revisar')

    await wrapper.get('button[data-action="see-review"]').trigger('click')

    expect(wrapper.text()).toContain('Ventas por revisar')
    const item = wrapper.get('.sync-status__record')
    expect(item.text()).toContain('$250.00')
    expect(item.text()).toContain('Carlos')
    expect(item.text()).toContain('11:30')
    expect(item.text()).toContain('uno de los productos ya no tenía piezas suficientes')
  })

  it('un registro sin motivo ni vendedor se muestra igual', async () => {
    const wrapper = mountIndicator({
      needsReviewCount: 1,
      records: [{ id: 'z', createdAt: new Date(2026, 8, 25, 9, 0).toISOString(), totalMinorEstimate: 100 }],
    })
    await wrapper.get('button[data-action="see-review"]').trigger('click')
    expect(wrapper.get('.sync-status__record').text()).toContain('$1.00')
  })

  it('"Entendido" emite dismiss con el id de ESE registro', async () => {
    const wrapper = mountIndicator({ needsReviewCount: 2, records: [record('a'), record('b')] })
    await wrapper.get('button[data-action="see-review"]').trigger('click')

    const buttons = wrapper.findAll('button[data-action="dismiss"]')
    expect(buttons).toHaveLength(2)
    expect(buttons[1].text()).toBe('Entendido')
    await buttons[1].trigger('click')

    expect(wrapper.emitted('dismiss')).toEqual([['b']])
  })

  it('cada "Entendido" nombra su venta para lectores de pantalla', async () => {
    const wrapper = mountIndicator({ needsReviewCount: 1, records: [record('a')] })
    await wrapper.get('button[data-action="see-review"]').trigger('click')
    expect(wrapper.get('button[data-action="dismiss"]').attributes('aria-label')).toBe('Entendido: venta de $250.00')
  })

  it('cuando ya no quedan registros la lista se cierra sola', async () => {
    const wrapper = mountIndicator({ needsReviewCount: 1, records: [record('a')] })
    await wrapper.get('button[data-action="see-review"]').trigger('click')
    expect(wrapper.text()).toContain('Ventas por revisar')

    await wrapper.setProps({ needsReviewCount: 0, records: [] })

    expect(wrapper.text()).not.toContain('Ventas por revisar')
  })

  it('"Cerrar" cierra la lista sin descartar nada', async () => {
    const wrapper = mountIndicator({ needsReviewCount: 1, records: [record('a')] })
    await wrapper.get('button[data-action="see-review"]').trigger('click')
    await wrapper.findAll('button').find((b) => b.text() === 'Cerrar')!.trigger('click')

    expect(wrapper.text()).not.toContain('Ventas por revisar')
    expect(wrapper.emitted('dismiss')).toBeUndefined()
  })

  it('el modal no muestra la X pequeña: hay un "Cerrar" grande', async () => {
    const wrapper = mountIndicator({ needsReviewCount: 1, records: [record('a')] })
    await wrapper.get('button[data-action="see-review"]').trigger('click')
    expect(wrapper.find('.app-modal__close').exists()).toBe(false)
  })
})
