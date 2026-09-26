import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TeamMemberList from '../TeamMemberList.vue'
import type { Member } from '@/types/member.types'

const members: Member[] = [
  { id: 'm-1', name: 'Ana Ruiz', role: 'socio', active: true },
  { id: 'm-2', name: 'Carlos Núñez', role: 'colaborador', active: true },
  { id: 'm-3', name: 'Beto Gil', role: 'colaborador', active: false },
]

const rows = (w: ReturnType<typeof mountList>) => w.findAll('li.team-list__item')
function mountList(props: Record<string, unknown> = {}) {
  return mount(TeamMemberList, { props: { members, ...props } })
}

describe('TeamMemberList', () => {
  it('es una lista con nombre accesible, una fila por persona y en el orden recibido', () => {
    const w = mountList()
    expect(w.get('ul').attributes('aria-label')).toBe('Personas del equipo')
    expect(rows(w).map((r) => r.get('.team-list__name').text())).toEqual(['Ana Ruiz', 'Carlos Núñez', 'Beto Gil'])
  })

  it('el rol se lee en texto (no solo por color): Socio / Colaborador', () => {
    const w = mountList()
    expect(rows(w).map((r) => r.get('.team-list__role').text())).toEqual(['Socio', 'Colaborador', 'Colaborador'])
  })

  it('una persona desactivada dice "Inactivo" en texto y se marca en la fila', () => {
    const w = mountList()
    expect(rows(w)[2].text()).toContain('Inactivo')
    expect(rows(w)[2].classes()).toContain('team-list__item--inactive')
    expect(rows(w)[0].text()).not.toContain('Inactivo')
    expect(rows(w)[0].classes()).not.toContain('team-list__item--inactive')
  })

  it('marca con "Tú" a la persona que tiene la sesión abierta', () => {
    const w = mountList({ currentMemberId: 'm-2' })
    expect(rows(w)[1].text()).toContain('Tú')
    expect(rows(w)[0].text()).not.toContain('Tú')
  })

  it('sin currentMemberId nadie lleva "Tú"', () => {
    expect(mountList().text()).not.toContain('Tú')
  })

  it('el avatar es decorativo: el nombre está en el texto', () => {
    const w = mountList()
    for (const avatar of w.findAll('.app-avatar')) expect(avatar.attributes('aria-hidden')).toBe('true')
  })

  it('sin personas muestra un mensaje en vez de una lista vacía', () => {
    const w = mountList({ members: [] })
    expect(w.find('ul').exists()).toBe(false)
    expect(w.text()).toContain('Todavía no hay personas en tu equipo.')
  })

  it('no muestra ids ni datos internos', () => {
    const text = mountList().text()
    expect(text).not.toContain('m-1')
  })
})
