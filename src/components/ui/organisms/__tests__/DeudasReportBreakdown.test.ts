// Organismo: dos tablas nuevas del reporte (BE-15/D7) — "Abonos recibidos en
// el periodo" y "Deudas liquidadas en el periodo" — más el total combinado
// (ventas de contado + abonos reales). Presentacional, mismo patrón que
// SalesDetailBreakdown: recibe filas ya resueltas por props.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DeudasReportBreakdown from '../DeudasReportBreakdown.vue'
import type { AbonoRecibidoBreakdownRow, DeudaLiquidadaBreakdownRow } from '../DeudasReportBreakdown.vue'

const abonosRecibidos: AbonoRecibidoBreakdownRow[] = [
  { fecha: '2026-09-22T15:30:00.000Z', deudor: 'Lucía', montoMinor: 20000, type: 'apartado' },
]
const deudasLiquidadas: DeudaLiquidadaBreakdownRow[] = [
  { id: 'd-1', deudor: 'Carlos', type: 'fiado', totalMinor: 65000, saldadaAt: '2026-09-23T13:00:00.000Z', gananciaMinor: 15000, gananciaDisponible: true },
]

function mountBreakdown(props: Partial<{
  abonosRecibidos: AbonoRecibidoBreakdownRow[]
  abonosRecibidosMinor: number
  deudasLiquidadas: DeudaLiquidadaBreakdownRow[]
  totalIngresadoMinor: number
}> = {}) {
  return mount(DeudasReportBreakdown, {
    props: {
      abonosRecibidos: [],
      abonosRecibidosMinor: 0,
      deudasLiquidadas: [],
      totalIngresadoMinor: 0,
      ...props,
    },
  })
}

describe('DeudasReportBreakdown — tabla de abonos recibidos', () => {
  it('sin abonos, muestra el mensaje vacío', () => {
    const wrapper = mountBreakdown()
    expect(wrapper.text()).toContain('Todavía no hay abonos en este periodo.')
  })

  it('con abonos, los tabula por separado de las deudas liquidadas', () => {
    const wrapper = mountBreakdown({ abonosRecibidos, abonosRecibidosMinor: 20000 })
    expect(wrapper.text()).toContain('Lucía')
    expect(wrapper.text()).toContain('$200.00')
    expect(wrapper.text()).toContain('Apartado')
  })
})

describe('DeudasReportBreakdown — tabla de deudas liquidadas', () => {
  it('sin deudas liquidadas, muestra el mensaje vacío', () => {
    const wrapper = mountBreakdown()
    expect(wrapper.text()).toContain('Todavía no hay deudas liquidadas en este periodo.')
  })

  it('con deudas liquidadas, muestra deudor/tipo/total/ganancia', () => {
    const wrapper = mountBreakdown({ deudasLiquidadas })
    expect(wrapper.text()).toContain('Carlos')
    expect(wrapper.text()).toContain('Fiado')
    expect(wrapper.text()).toContain('$650.00')
    expect(wrapper.text()).toContain('$150.00')
  })

  it('una fila sin costo muestra "No disponible", nunca $0.00', () => {
    const wrapper = mountBreakdown({
      deudasLiquidadas: [{ id: 'd-2', deudor: 'Ana', type: 'apartado', totalMinor: 10000, saldadaAt: '2026-09-23T13:00:00.000Z', gananciaMinor: null, gananciaDisponible: false }],
    })
    expect(wrapper.text()).toContain('No disponible')
  })
})

describe('DeudasReportBreakdown — las tres tablas del reporte se renderizan separadas', () => {
  it('abonos y deudas liquidadas aparecen en secciones/tablas distintas (no mezcladas)', () => {
    const wrapper = mountBreakdown({ abonosRecibidos, deudasLiquidadas })
    const tables = wrapper.findAll('table')
    expect(tables).toHaveLength(2)
    expect(tables[0].text()).toContain('Lucía')
    expect(tables[0].text()).not.toContain('Carlos')
    expect(tables[1].text()).toContain('Carlos')
    expect(tables[1].text()).not.toContain('Lucía')
  })
})

describe('DeudasReportBreakdown — total combinado', () => {
  it('muestra el total ingresado (ventas de contado + abonos reales)', () => {
    const wrapper = mountBreakdown({ totalIngresadoMinor: 150050 })
    expect(wrapper.text()).toContain('$1,500.50')
    expect(wrapper.text()).toMatch(/total ingresado/i)
  })
})
