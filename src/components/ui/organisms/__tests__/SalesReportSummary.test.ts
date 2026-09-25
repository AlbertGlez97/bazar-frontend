import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SalesReportSummary from '../SalesReportSummary.vue'

const PEOPLE = [
  { memberId: 'm-carlos', name: 'Carlos Núñez', role: 'colaborador' as const, totalMinor: 125000, sharePercent: 96.1 },
  { memberId: 'm-ana', name: 'Ana', role: 'socio' as const, totalMinor: 5050, sharePercent: 3.9 },
]

function mountSummary(props: Record<string, unknown> = {}) {
  return mount(SalesReportSummary, {
    props: { totalMinor: 130050, saleCount: 2, rangeLabel: '24/09/2026', people: PEOPLE, ...props },
  })
}

describe('SalesReportSummary', () => {
  it('shows the big total formatted with thousands separators, and the sale count', () => {
    const wrapper = mountSummary()
    expect(wrapper.get('.sales-report-summary__total').text()).toBe('$1,300.50')
    expect(wrapper.text()).toContain('Total vendido')
    expect(wrapper.text()).toContain('2 ventas')
    expect(wrapper.text()).toContain('24/09/2026')
  })

  it('uses the singular for one sale', () => {
    expect(mountSummary({ saleCount: 1 }).text()).toContain('1 venta')
    expect(mountSummary({ saleCount: 1 }).text()).not.toContain('1 ventas')
  })

  it('lists the people in the given order with role badge, total and share', () => {
    const rows = mountSummary().findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0].findAll('td').map((td) => td.text())).toEqual(['Carlos Núñez', 'Colaborador', '$1,250.00', '96.1 %'])
    expect(rows[1].findAll('td').map((td) => td.text())).toEqual(['Ana', 'Socio', '$50.50', '3.9 %'])
  })

  it('has real table headers and a caption for screen readers', () => {
    const wrapper = mountSummary()
    expect(wrapper.findAll('thead th').map((th) => th.text())).toEqual(['Persona', 'Rol', 'Total vendido', '% del total'])
    expect(wrapper.get('caption').text()).toBe('Por persona')
  })

  it('a person without a resolved role shows a dash instead of an empty badge', () => {
    const wrapper = mountSummary({ people: [{ memberId: 'x', name: 'Sin nombre', role: null, totalMinor: 100, sharePercent: 100 }] })
    expect(wrapper.findAll('tbody td')[1].text()).toBe('—')
  })

  it('shows the empty state and no table when there are no sales', () => {
    const wrapper = mountSummary({ totalMinor: 0, saleCount: 0, people: [] })
    expect(wrapper.text()).toContain('Todavía no hay ventas en este periodo.')
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.get('.sales-report-summary__total').text()).toBe('$0.00')
  })
})
