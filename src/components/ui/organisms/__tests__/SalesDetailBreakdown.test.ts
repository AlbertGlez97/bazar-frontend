import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SalesDetailBreakdown from '../SalesDetailBreakdown.vue'

const ROWS = [
  { productId: 'p1', memberId: 'm-carlos', productName: 'Reloj', memberName: 'Carlos Núñez', units: 3, ingresoMinor: 125000, gananciaMinor: 35000, gananciaDisponible: true },
  { productId: 'p2', memberId: 'm-ana', productName: 'Pulsera', memberName: 'Ana', units: 1, ingresoMinor: 5050, gananciaMinor: null, gananciaDisponible: false },
]

function mountBreakdown(rows: typeof ROWS = ROWS) {
  return mount(SalesDetailBreakdown, { props: { rows } })
}

describe('SalesDetailBreakdown', () => {
  it('has real table headers and a caption for screen readers', () => {
    const wrapper = mountBreakdown()
    expect(wrapper.findAll('thead th').map((th) => th.text())).toEqual(['Producto', 'Persona', 'Unidades', 'Ingreso', 'Ganancia'])
    expect(wrapper.get('caption').text()).toBe('Por producto')
  })

  it('lists the rows with formatted amounts', () => {
    const rows = mountBreakdown().findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0].findAll('td').map((td) => td.text())).toEqual(['Reloj', 'Carlos Núñez', '3', '$1,250.00', '$350.00'])
  })

  it('shows "No disponible" instead of $0.00 when the profit is not available', () => {
    const row = mountBreakdown().findAll('tbody tr')[1]
    const cells = row.findAll('td').map((td) => td.text())
    expect(cells.at(-1)).toBe('No disponible')
    expect(cells.at(-1)).not.toBe('$0.00')
  })

  it('shows the empty state and no table when there are no rows', () => {
    const wrapper = mountBreakdown([])
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.text()).toContain('Todavía no hay detalle de productos en este periodo.')
  })

  it('never shows cash-received or change columns', () => {
    const headers = mountBreakdown().findAll('thead th').map((th) => th.text())
    expect(headers).not.toContain('Efectivo')
    expect(headers).not.toContain('Cambio')
  })
})
