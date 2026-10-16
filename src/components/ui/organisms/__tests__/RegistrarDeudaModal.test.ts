// Formulario de fiado/apartado (D3): tipo, nombre del deudor (requerido),
// teléfono y notas (opcionales), el abono inicial de SOLO LECTURA (viene del
// monto del cobro y del método elegido) y cuotas planeadas opcionales (D2).
// Presentacional: no llama servicios, solo valida y emite lo que la persona confirmó.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import RegistrarDeudaModal from '../RegistrarDeudaModal.vue'

type ModalProps = {
  modelValue: boolean
  submitting: boolean
  totalMinor: number
  abonoInicialMinor: number
  paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'
}

function mountModal(props: Partial<ModalProps> = {}) {
  return mount(RegistrarDeudaModal, {
    props: { modelValue: true, totalMinor: 10000, abonoInicialMinor: 0, paymentMethod: 'EFECTIVO', ...props },
    global: { stubs: { teleport: true } },
  })
}
type Wrapper = ReturnType<typeof mountModal>

const submitBtn = (w: Wrapper) => w.get('button[data-action="confirm-debt"]')
const nombreInput = (w: Wrapper) => w.findAll('input')[0]
const field = (w: Wrapper, name: 'total' | 'abono' | 'saldo') => w.get(`dd[data-field="${name}"]`).text().replace(/\s+/g, ' ')

async function fillNombre(w: Wrapper, name = 'Lucía') {
  await nombreInput(w).setValue(name)
}

describe('RegistrarDeudaModal — contenido', () => {
  it('trae selector de tipo (fiado/apartado), nombre, teléfono y notas; el abono ya no es un campo', () => {
    const wrapper = mountModal()
    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.findAll('input')).toHaveLength(3) // nombre + teléfono + toggle de cuotas
    expect(wrapper.find('input[inputmode="decimal"]').exists()).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('el tipo por defecto es fiado', () => {
    const wrapper = mountModal()
    expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('fiado')
  })
})

// El abono inicial es de SOLO LECTURA: sale del monto del cobro y del método elegido.
describe('RegistrarDeudaModal — abono inicial de solo lectura', () => {
  it('muestra Total, Abono inicial y Saldo pendiente, con separador de miles', () => {
    const wrapper = mountModal({ totalMinor: 110000, abonoInicialMinor: 30000, paymentMethod: 'EFECTIVO' })

    expect(field(wrapper, 'total')).toBe('$1,100.00')
    expect(field(wrapper, 'abono')).toBe('$300.00 · Efectivo')
    expect(field(wrapper, 'saldo')).toBe('$800.00')
    expect(wrapper.text()).toContain('Saldo pendiente')
  })

  it.each([
    ['TRANSFERENCIA', 'Transferencia'],
    ['TARJETA', 'Tarjeta'],
  ] as const)('el abono dice que se paga con %s', (paymentMethod, label) => {
    const wrapper = mountModal({ abonoInicialMinor: 2000, paymentMethod })

    expect(field(wrapper, 'abono')).toBe(`$20.00 · ${label}`)
  })

  it('con $0 de abono no menciona método y el saldo es el total', () => {
    const wrapper = mountModal({ totalMinor: 10000, abonoInicialMinor: 0 })

    expect(field(wrapper, 'abono')).toBe('$0.00')
    expect(field(wrapper, 'saldo')).toBe('$100.00')
  })

  it('ya no pide ni sugiere dejarlo en $0.00', () => {
    const wrapper = mountModal()

    expect(wrapper.text()).not.toMatch(/Déjalo en|recibiste nada/i)
  })

  it('dice cómo cambiarlo: cerrar y corregir el monto del cobro', () => {
    expect(mountModal().text()).toContain('cierra esto y corrige el monto del cobro')
  })

  it('confirm manda el abono y el método tal como se mostraron', async () => {
    const wrapper = mountModal({ abonoInicialMinor: 15050, paymentMethod: 'TARJETA' })
    await fillNombre(wrapper)

    await submitBtn(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')?.[0][0]).toMatchObject({ abonoInicialMinor: 15050, abonoInicialPaymentMethod: 'TARJETA' })
  })

  it('con $0 confirm manda abonoInicialMinor: 0 explícitamente y el método (EFECTIVO)', async () => {
    const wrapper = mountModal()
    await fillNombre(wrapper)

    await submitBtn(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')?.[0][0]).toMatchObject({ abonoInicialMinor: 0, abonoInicialPaymentMethod: 'EFECTIVO' })
  })

  it('un saldo nunca sale negativo aunque el abono sea mayor al total', () => {
    const wrapper = mountModal({ totalMinor: 1000, abonoInicialMinor: 5000 })

    expect(field(wrapper, 'saldo')).toBe('$0.00')
  })
})

describe('RegistrarDeudaModal — validación', () => {
  it('nombre vacío no emite confirm y muestra el error', async () => {
    const wrapper = mountModal()
    await submitBtn(wrapper).trigger('click')
    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.text()).toContain('Escribe el nombre de quien debe.')
  })

  it('nombre solo con espacios tampoco pasa', async () => {
    const wrapper = mountModal()
    await fillNombre(wrapper, '   ')
    await submitBtn(wrapper).trigger('click')
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('con nombre, emite confirm con el tipo, el nombre, abonoInicialMinor y cuotasPlaneadas vacío', async () => {
    const wrapper = mountModal()
    await fillNombre(wrapper)
    await submitBtn(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[{
      type: 'fiado',
      deudor: { nombre: 'Lucía' },
      abonoInicialMinor: 0,
      abonoInicialPaymentMethod: 'EFECTIVO',
      cuotasPlaneadas: [],
    }]])
  })

  it('recorta espacios del nombre', async () => {
    const wrapper = mountModal()
    await fillNombre(wrapper, '  Lucía  ')
    await submitBtn(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')?.[0][0]).toMatchObject({ deudor: { nombre: 'Lucía' } })
  })

  it('con teléfono y notas los incluye recortados; cambiar a apartado lo manda en el tipo', async () => {
    const wrapper = mountModal()
    await wrapper.get('select').setValue('apartado')
    await fillNombre(wrapper)
    await wrapper.findAll('input')[1].setValue(' 555-0001 ')
    await wrapper.get('textarea').setValue(' Pasa el sábado ')
    await submitBtn(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')?.[0][0]).toMatchObject({
      type: 'apartado',
      deudor: { nombre: 'Lucía', telefono: '555-0001', notas: 'Pasa el sábado' },
    })
  })

  it('escribir después de un error lo quita al reintentar con éxito', async () => {
    const wrapper = mountModal()
    await submitBtn(wrapper).trigger('click')
    expect(wrapper.text()).toContain('Escribe el nombre de quien debe.')

    await fillNombre(wrapper, 'Ana')
    await submitBtn(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})

// D2: sección opcional de cuotas planeadas. Colapsada por defecto (no
// obligatoria); al activarla aparece el editor de filas repetibles
// (CuotasPlaneadasEditor): sin filas hasta que se agrega una, y cada fila es
// un datepicker de fecha única + un monto.
describe('RegistrarDeudaModal — cuotas planeadas (D2)', () => {
  const addCuotaBtn = (w: Wrapper) => w.get('[data-action="add-cuota"]')

  it('el editor de cuotas está oculto hasta activar el toggle', () => {
    const wrapper = mountModal()
    expect(wrapper.find('[data-action="add-cuota"]').exists()).toBe(false)
    expect(wrapper.findComponent(VueDatePicker).exists()).toBe(false)
  })

  it('activar el toggle revela el editor de cuotas, pero sin ningún calendario hasta agregar una fila', async () => {
    const wrapper = mountModal()
    await wrapper.get('input[type="checkbox"]').setValue(true)

    expect(wrapper.find('[data-action="add-cuota"]').exists()).toBe(true)
    expect(wrapper.findComponent(VueDatePicker).exists()).toBe(false)
  })

  it('agregar una fila revela su calendario de fecha única', async () => {
    const wrapper = mountModal()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await addCuotaBtn(wrapper).trigger('click')

    expect(wrapper.findComponent(VueDatePicker).exists()).toBe(true)
  })

  it('elegir fechas y confirmar manda las cuotas sugeridas (reparto parejo del saldo tras el abono)', async () => {
    const wrapper = mountModal({ totalMinor: 10000, abonoInicialMinor: 2000 }) // resto 8000
    await fillNombre(wrapper)
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await addCuotaBtn(wrapper).trigger('click')
    await addCuotaBtn(wrapper).trigger('click')
    const pickers = wrapper.findAllComponents(VueDatePicker)
    await pickers[0].vm.$emit('update:model-value', new Date(2026, 9, 15))
    await pickers[1].vm.$emit('update:model-value', new Date(2026, 10, 15))
    await wrapper.vm.$nextTick()

    await submitBtn(wrapper).trigger('click')

    const payload = wrapper.emitted('confirm')?.[0][0] as { cuotasPlaneadas: Array<{ montoEsperadoMinor: number }> }
    expect(payload.cuotasPlaneadas.map((c) => c.montoEsperadoMinor)).toEqual([4000, 4000])
  })

  it('cada cuota es editable: lo editado se manda, no la sugerencia', async () => {
    const wrapper = mountModal({ totalMinor: 10000 })
    await fillNombre(wrapper)
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await addCuotaBtn(wrapper).trigger('click')
    await addCuotaBtn(wrapper).trigger('click')
    const pickers = wrapper.findAllComponents(VueDatePicker)
    await pickers[0].vm.$emit('update:model-value', new Date(2026, 9, 15))
    await pickers[1].vm.$emit('update:model-value', new Date(2026, 10, 15))
    await wrapper.vm.$nextTick()

    const cuotaInputs = wrapper.findAll('input[inputmode="decimal"]')
    await cuotaInputs[0].setValue('75.00')
    await wrapper.vm.$nextTick()

    await submitBtn(wrapper).trigger('click')

    const payload = wrapper.emitted('confirm')?.[0][0] as { cuotasPlaneadas: Array<{ montoEsperadoMinor: number }> }
    expect(payload.cuotasPlaneadas[0].montoEsperadoMinor).toBe(7500)
    expect(payload.cuotasPlaneadas[1].montoEsperadoMinor).toBe(5000) // sin editar: sugerencia pareja de 10000/2
  })

  it('con una sola fila no hay botón Quitar; con dos, cada una tiene el suyo', async () => {
    const wrapper = mountModal()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await addCuotaBtn(wrapper).trigger('click')
    expect(wrapper.findAll('[data-action="remove-cuota"]')).toHaveLength(0)

    await addCuotaBtn(wrapper).trigger('click')
    expect(wrapper.findAll('[data-action="remove-cuota"]')).toHaveLength(2)
  })

  it('apagar el toggle después de agregar filas manda cuotasPlaneadas vacío', async () => {
    const wrapper = mountModal({ totalMinor: 10000 })
    await fillNombre(wrapper)
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await addCuotaBtn(wrapper).trigger('click')
    await wrapper.findComponent(VueDatePicker).vm.$emit('update:model-value', new Date(2026, 9, 15))
    await wrapper.vm.$nextTick()
    await wrapper.get('input[type="checkbox"]').setValue(false)

    await submitBtn(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')?.[0][0]).toMatchObject({ cuotasPlaneadas: [] })
  })
})

describe('RegistrarDeudaModal — abrir y cerrar', () => {
  it('reinicia el formulario cada vez que se abre', async () => {
    const wrapper = mountModal({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await fillNombre(wrapper, 'Ana')
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })

    expect((nombreInput(wrapper).element as HTMLInputElement).value).toBe('')
  })

  it('cancelar emite update:modelValue false sin emitir confirm', async () => {
    const wrapper = mountModal()
    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === 'Cancelar')!
    await cancelBtn.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('mientras se envía (submitting), los controles se deshabilitan', () => {
    const wrapper = mountModal({ submitting: true })
    expect(submitBtn(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.get('select').attributes('disabled')).toBeDefined()
    expect(nombreInput(wrapper).attributes('disabled')).toBeDefined()
    expect(submitBtn(wrapper).text()).toBe('Registrando…')
  })
})
