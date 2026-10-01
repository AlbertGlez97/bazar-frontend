// Fiado/apartado registrado (D3, abono inicial explícito D1/BE-15): pantalla
// propia, NUNCA parecida a "Venta registrada" — no hubo venta de contado.
// Debe mostrar el tipo, el saldo pendiente y, si hubo abono inicial, el
// monto ya aplicado (va dentro de la misma transacción del servidor: o la
// deuda se crea completa, o no se crea nada — ya no hay un estado de "abono
// fallido" aparte, como antes de BE-15).
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleResult from '../SaleResult.vue'
import type { SaleResultView } from '@/types/sale-result.types'

function mountResult(result: SaleResultView) {
  return mount(SaleResult, { props: { result }, attachTo: document.body })
}

const apartado: SaleResultView = {
  kind: 'debt-registered', debtType: 'apartado', totalMinor: 5997, pendingMinor: 3997, initialAbonoMinor: 2000,
}
const fiadoSinAbono: SaleResultView = {
  kind: 'debt-registered', debtType: 'fiado', totalMinor: 5997, pendingMinor: 5997, initialAbonoMinor: 0,
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

it.each(['fiado', 'apartado'] as const)('shows saved %s balance and initial payment, never cash change', async (debtType) => {
  const wrapper = mountResult({ ...apartado, kind: 'debt-saved-offline', debtType })
  expect(wrapper.get('h2').text()).toBe('Listo, ya quedó')
  expect(wrapper.text()).toContain('se manda solo cuando haya internet')
  expect(wrapper.text()).toContain('Saldo pendiente')
  expect(wrapper.text()).toContain('$39.97')
  expect(wrapper.text()).toContain('$20.00')
  expect(wrapper.text()).not.toMatch(/Cambio|Sin cambio/)
  expect(wrapper.get('.sale-result').attributes('role')).toBe('status')
  await wrapper.get('.sale-result__primary').trigger('click')
  expect(wrapper.emitted('new-sale')).toHaveLength(1)
  wrapper.unmount()
})
