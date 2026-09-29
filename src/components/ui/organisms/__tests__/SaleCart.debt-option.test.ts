// "Registrar como fiado/apartado" (D3): SOLO con exactamente una línea en el
// carrito, efectivo insuficiente (nunca por carrito vacío ni por un efectivo
// ambiguo/`cashInvalid`). Presentacional: solo emite el evento; el modal y las
// llamadas reales viven en SaleView.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleCart from '../SaleCart.vue'

const line = (productId: string, name: string, extra: Partial<{ quantity: number; unitPriceMinor: number; tipo: 'unica' | 'cantidad'; stockAvailable: number }> = {}) => ({
  productId,
  name,
  unitPriceMinor: 5000,
  quantity: 1,
  tipo: 'cantidad' as 'unica' | 'cantidad',
  stockAvailable: 10,
  image: null,
  ...extra,
})

type Props = InstanceType<typeof SaleCart>['$props']

function mountCart(props: Partial<Props> = {}) {
  return mount(SaleCart, {
    props: {
      lines: [line('a', 'Café')],
      itemCount: 1,
      totalMinor: 5000,
      cashMinor: 2000,
      changeMinor: 0,
      missingMinor: 3000,
      canCharge: false,
      cashText: '20',
      loading: false,
      ...props,
    },
    global: { stubs: { teleport: true } },
  })
}

const debtBtn = (w: ReturnType<typeof mountCart>) => w.find('button[data-action="open-debt-modal"]')

describe('SaleCart — opción de fiado/apartado (D3)', () => {
  it('con una línea y efectivo insuficiente, aparece', () => {
    const wrapper = mountCart()
    expect(debtBtn(wrapper).exists()).toBe(true)
    expect(debtBtn(wrapper).text()).toContain('Registrar como fiado/apartado')
  })

  it('con 2+ líneas NO aparece, aunque falte efectivo', () => {
    const wrapper = mountCart({
      lines: [line('a', 'Café'), line('b', 'Pan')],
      itemCount: 2,
      totalMinor: 10000,
      missingMinor: 8000,
    })
    expect(debtBtn(wrapper).exists()).toBe(false)
  })

  it('con el carrito vacío NO aparece', () => {
    const wrapper = mountCart({ lines: [], itemCount: 0, totalMinor: 0, missingMinor: 0, canCharge: false })
    expect(debtBtn(wrapper).exists()).toBe(false)
  })

  it('si ya se puede cobrar (canCharge true) NO aparece', () => {
    const wrapper = mountCart({ missingMinor: 0, canCharge: true, cashMinor: 5000 })
    expect(debtBtn(wrapper).exists()).toBe(false)
  })

  it('con efectivo ambiguo (cashInvalid) NO aparece, aunque missingMinor sea > 0', () => {
    const wrapper = mountCart({ cashInvalid: true })
    expect(debtBtn(wrapper).exists()).toBe(false)
  })

  it('sin escribir nada de efectivo (missingMinor = total) SÍ aparece', () => {
    const wrapper = mountCart({ cashMinor: 0, missingMinor: 5000 })
    expect(debtBtn(wrapper).exists()).toBe(true)
  })

  it('mientras se cobra (loading) NO aparece', () => {
    const wrapper = mountCart({ loading: true })
    expect(debtBtn(wrapper).exists()).toBe(false)
  })

  it('tocarlo emite open-debt-modal', async () => {
    const wrapper = mountCart()
    await debtBtn(wrapper).trigger('click')
    expect(wrapper.emitted('open-debt-modal')).toHaveLength(1)
  })
})
