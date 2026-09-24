// Tests de la molécula MemberSelector — renderiza la lista de GET /members
// y emite `select` con el member elegido. No hace fetch (eso vive en
// SelectContextView).
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MemberSelector from '@/components/ui/molecules/MemberSelector.vue'
import type { Member } from '@/types/member.types'

const members: Member[] = [
  { id: 'm-1', name: 'Alberto', role: 'socio', active: true },
  { id: 'm-2', name: 'Carlos', role: 'colaborador', active: true },
]

describe('MemberSelector', () => {
  it('renderiza una tarjeta por cada member recibido', () => {
    const wrapper = mount(MemberSelector, { props: { members } })
    const cards = wrapper.findAll('[role="listitem"]')

    expect(cards).toHaveLength(2)
    expect(wrapper.text()).toContain('Alberto')
    expect(wrapper.text()).toContain('Carlos')
  })

  it('distingue visualmente socio de colaborador', () => {
    const wrapper = mount(MemberSelector, { props: { members } })
    expect(wrapper.text()).toContain('Socio')
    expect(wrapper.text()).toContain('Colaborador')
  })

  it('emite select con el member correcto al hacer click en su tarjeta', async () => {
    const wrapper = mount(MemberSelector, { props: { members } })
    const cards = wrapper.findAll('[role="listitem"]')
    await cards[1].trigger('click')

    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('select')?.[0]).toEqual([members[1]])
  })

  it('muestra un mensaje cuando la lista está vacía', () => {
    const wrapper = mount(MemberSelector, { props: { members: [] } })
    expect(wrapper.text()).toContain('No hay personas activas para seleccionar')
  })

  it('deshabilita las tarjetas mientras loading es true', () => {
    const wrapper = mount(MemberSelector, { props: { members, loading: true } })
    const cards = wrapper.findAll('[role="listitem"]')
    for (const card of cards) {
      expect(card.attributes('disabled')).toBeDefined()
    }
  })
})
