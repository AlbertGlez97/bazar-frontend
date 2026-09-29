// Fiado/apartado registrado (D3/D4): pantalla propia, NUNCA parecida a "Venta
// registrada" — no hubo venta de contado. Debe mostrar el tipo, el saldo
// pendiente y, si el abono inicial falló (D4), avisarlo sin fingir éxito.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleResult from '../SaleResult.vue'
import type { SaleResultView } from '@/types/sale-result.types'

function mountResult(result: SaleResultView) {
  return mount(SaleResult, { props: { result }, attachTo: document.body })
}

const apartado: SaleResultView = {
  kind: 'debt-registered', debtType: 'apartado', totalMinor: 5997, pendingMinor: 3997, initialAbonoMinor: 2000, abonoFailed: false,
}
const fiadoSinAbono: SaleResultView = {
  kind: 'debt-registered', debtType: 'fiado', totalMinor: 5997, pendingMinor: 5997, initialAbonoMinor: 0, abonoFailed: false,
}
const abonoFallido: SaleResultView = {
  kind: 'debt-registered', debtType: 'fiado', totalMinor: 5997, pendingMinor: 5997, initialAbonoMinor: 0, abonoFailed: true,
}

describe('SaleResult — fiado/apartado registrado', () => {
  it('título propio y NUNCA "Venta registrada"', () => {
    const wrapper = mountResult(apartado)
    expect(wrapper.get('h2').text()).toBe('Fiado/apartado registrado')
    expect(wrapper.text()).not.toContain('Venta registrada')
    wrapper.unmount()
  })

  it('dice explícitamente que NO es una venta de contado', () => {
    const wrapper = mountResult(apartado)
    expect(wrapper.text()).toMatch(/no es una venta de contado/i)
    wrapper.unmount()
  })

  it('muestra el total y el saldo pendiente (no "Cambio")', () => {
    const wrapper = mountResult(apartado)
    expect(wrapper.get('.sale-result__total').text()).toContain('$59.97')
    expect(wrapper.get('.sale-result__change').text()).toContain('$39.97')
    expect(wrapper.get('.sale-result__change').text()).toContain('Saldo pendiente')
    wrapper.unmount()
  })

  it('con abono inicial confirmado lo menciona; sin efectivo no lo menciona', () => {
    const withAbono = mountResult(apartado)
    expect(withAbono.text()).toContain('Abono inicial registrado')
    expect(withAbono.text()).toContain('$20.00')
    withAbono.unmount()

    const noAbono = mountResult(fiadoSinAbono)
    expect(noAbono.text()).not.toContain('Abono inicial registrado')
    noAbono.unmount()
  })

  it('distingue fiado de apartado en el texto', () => {
    const fiado = mountResult(fiadoSinAbono)
    expect(fiado.text()).toContain('Fiado')
    fiado.unmount()

    const apart = mountResult(apartado)
    expect(apart.text()).toContain('Apartado')
    apart.unmount()
  })

  it('D4: abono fallido se avisa honestamente, sin fingir éxito completo', () => {
    const wrapper = mountResult(abonoFallido)
    expect(wrapper.text()).toMatch(/no pudimos anotar el efectivo/i)
    wrapper.unmount()
  })

  it('sin abono fallido, no aparece ningún aviso de abono', () => {
    const wrapper = mountResult(fiadoSinAbono)
    expect(wrapper.text()).not.toMatch(/no pudimos anotar el efectivo/i)
    wrapper.unmount()
  })

  it('es una región de estado (no un error): role status, no alert', () => {
    const wrapper = mountResult(apartado)
    expect(wrapper.get('.sale-result').attributes('role')).toBe('status')
    wrapper.unmount()
  })

  it('clase e ícono propios, distintos de éxito', () => {
    const wrapper = mountResult(apartado)
    expect(wrapper.get('.sale-result').classes()).toContain('sale-result--debt-registered')
    expect(wrapper.get('.sale-result').classes()).not.toContain('sale-result--success')
    wrapper.unmount()
  })

  it('un solo botón principal, "Nueva venta" (vacía el carrito igual que un cobro exitoso)', async () => {
    const wrapper = mountResult(apartado)
    const buttons = wrapper.findAll('button.sale-result__primary')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].text()).toBe('Nueva venta')
    await buttons[0].trigger('click')
    expect(wrapper.emitted('new-sale')).toHaveLength(1)
    expect(wrapper.find('button.sale-result__secondary').exists()).toBe(false)
    wrapper.unmount()
  })
})
