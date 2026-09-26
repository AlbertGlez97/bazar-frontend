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

  describe('defensa en profundidad: persona bloqueada (cuenta ligada a un miembro)', () => {
    it('con lockedMemberId ofrece SOLO esa persona, aunque reciba a todo el equipo', () => {
      const wrapper = mount(MemberSelector, { props: { members, lockedMemberId: 'm-2' } })
      const cards = wrapper.findAll('[role="listitem"]')

      expect(cards).toHaveLength(1)
      expect(wrapper.text()).toContain('Carlos')
      expect(wrapper.text()).not.toContain('Alberto')
    })

    it('con lockedMemberId nunca emite a un socio distinto', async () => {
      const wrapper = mount(MemberSelector, { props: { members, lockedMemberId: 'm-2' } })
      await wrapper.find('[role="listitem"]').trigger('click')

      expect(wrapper.emitted('select')).toHaveLength(1)
      expect(wrapper.emitted('select')?.[0]).toEqual([members[1]])
    })

    it('con un lockedMemberId que no está en la lista no ofrece a nadie (falla cerrado)', () => {
      const wrapper = mount(MemberSelector, { props: { members, lockedMemberId: 'm-999' } })

      expect(wrapper.findAll('[role="listitem"]')).toHaveLength(0)
    })

    it('sin lockedMemberId (login compartido) ofrece a todos, como siempre', () => {
      const wrapper = mount(MemberSelector, { props: { members, lockedMemberId: null } })

      expect(wrapper.findAll('[role="listitem"]')).toHaveLength(2)
    })
  })

  it('muestra un mensaje cuando la lista está vacía', () => {
    const wrapper = mount(MemberSelector, { props: { members: [] } })
    expect(wrapper.text()).toContain('No hay personas activas para elegir')
  })

  it('deshabilita las tarjetas mientras loading es true', () => {
    const wrapper = mount(MemberSelector, { props: { members, loading: true } })
    const cards = wrapper.findAll('[role="listitem"]')
    for (const card of cards) {
      expect(card.attributes('disabled')).toBeDefined()
    }
  })
})
