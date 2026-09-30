// Molécula: filas repetibles de cuotas planeadas (D2). Cada fila es UN
// @vuepic/vue-datepicker en modo de fecha única + un monto editable, con un
// botón "Quitar" por fila (excepto cuando solo queda una). Agregar/quitar
// filas re-sugiere el reparto parejo (splitEvenMinor) SOLO en las filas que
// la persona no tocó a mano; lo editado se manda tal cual, nunca la
// sugerencia.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import CuotasPlaneadasEditor from '../CuotasPlaneadasEditor.vue'

function mountEditor(props: Partial<{ totalMinor: number; disabled: boolean }> = {}) {
  return mount(CuotasPlaneadasEditor, {
    props: { totalMinor: 10000, ...props },
    global: { stubs: { teleport: true } },
  })
}
type Wrapper = ReturnType<typeof mountEditor>

function lastEmitted(wrapper: Wrapper): Array<{ fechaEsperada: string; montoEsperadoMinor: number }> {
  const events = wrapper.emitted('update:cuotas')
  return (events?.at(-1)?.[0] ?? []) as Array<{ fechaEsperada: string; montoEsperadoMinor: number }>
}

const amountInputs = (wrapper: Wrapper) => wrapper.findAll('input[inputmode="decimal"]')
const pickers = (wrapper: Wrapper) => wrapper.findAllComponents(VueDatePicker)
const addButton = (wrapper: Wrapper) => wrapper.get('[data-action="add-cuota"]')
const removeButtons = (wrapper: Wrapper) => wrapper.findAll('[data-action="remove-cuota"]')

async function addRow(wrapper: Wrapper) {
  await addButton(wrapper).trigger('click')
}

async function pickDate(wrapper: Wrapper, rowIndex: number, date: Date) {
  await pickers(wrapper)[rowIndex].vm.$emit('update:model-value', date)
  await wrapper.vm.$nextTick()
}

const amountValue = (wrapper: Wrapper, index: number) => (amountInputs(wrapper)[index].element as HTMLInputElement).value

describe('CuotasPlaneadasEditor — sin filas (estado inicial, intacto)', () => {
  it('no muestra ningún calendario ni fila; solo el botón de agregar', () => {
    const wrapper = mountEditor()
    expect(pickers(wrapper)).toHaveLength(0)
    expect(amountInputs(wrapper)).toHaveLength(0)
    expect(wrapper.find('[data-action="add-cuota"]').exists()).toBe(true)
  })

  it('emite un arreglo vacío (sin cuotasPlaneadas)', () => {
    const wrapper = mountEditor()
    expect(lastEmitted(wrapper)).toEqual([])
  })
})

describe('CuotasPlaneadasEditor — agregar filas', () => {
  it('"+ Agregar fecha de pago" agrega una fila con un datepicker de fecha única + un input de monto', async () => {
    const wrapper = mountEditor({ totalMinor: 10000 })
    await addRow(wrapper)

    expect(pickers(wrapper)).toHaveLength(1)
    expect(pickers(wrapper)[0].props('multiDates')).toBeFalsy()
    expect(amountInputs(wrapper)).toHaveLength(1)
  })

  it('cada fila agregada sugiere el reparto parejo del total entre las filas actuales', async () => {
    const wrapper = mountEditor({ totalMinor: 10000 })
    await addRow(wrapper)
    await addRow(wrapper)
    await addRow(wrapper)

    expect([amountValue(wrapper, 0), amountValue(wrapper, 1), amountValue(wrapper, 2)])
      .toEqual(['33.33', '33.33', '33.34'])
  })

  it('con una sola fila no hay botón Quitar', async () => {
    const wrapper = mountEditor()
    await addRow(wrapper)

    expect(removeButtons(wrapper)).toHaveLength(0)
  })

  it('con dos o más filas, cada una tiene su botón Quitar', async () => {
    const wrapper = mountEditor()
    await addRow(wrapper)
    await addRow(wrapper)

    expect(removeButtons(wrapper)).toHaveLength(2)
  })
})

describe('CuotasPlaneadasEditor — editar montos', () => {
  it('lo editado se manda tal cual; la otra fila sigue la sugerencia pareja', async () => {
    const wrapper = mountEditor({ totalMinor: 10000 })
    await addRow(wrapper)
    await addRow(wrapper)
    await pickDate(wrapper, 0, new Date(2026, 9, 15))
    await pickDate(wrapper, 1, new Date(2026, 10, 15))

    await amountInputs(wrapper)[0].setValue('20.00')
    await wrapper.vm.$nextTick()

    const rows = lastEmitted(wrapper)
    expect(rows[0].montoEsperadoMinor).toBe(2000)
    expect(rows[1].montoEsperadoMinor).toBe(5000)
  })
})

describe('CuotasPlaneadasEditor — quitar filas', () => {
  it('quitar una fila intermedia re-reparte SOLO las filas sin editar', async () => {
    const wrapper = mountEditor({ totalMinor: 9000 })
    await addRow(wrapper)
    await addRow(wrapper)
    await addRow(wrapper)

    // Edita la fila del medio a mano.
    await amountInputs(wrapper)[1].setValue('999.00')
    await wrapper.vm.$nextTick()

    // Quita la primera fila (sin editar).
    await removeButtons(wrapper)[0].trigger('click')
    await wrapper.vm.$nextTick()

    expect(amountInputs(wrapper)).toHaveLength(2)
    expect(amountValue(wrapper, 0)).toBe('999.00') // la editada: intacta
    expect(amountValue(wrapper, 1)).toBe('45.00') // sin editar: nueva sugerencia pareja (9000/2)
  })

  it('quitar deja la última fila sin botón Quitar', async () => {
    const wrapper = mountEditor()
    await addRow(wrapper)
    await addRow(wrapper)
    await removeButtons(wrapper)[0].trigger('click')
    await wrapper.vm.$nextTick()

    expect(amountInputs(wrapper)).toHaveLength(1)
    expect(removeButtons(wrapper)).toHaveLength(0)
  })
})

describe('CuotasPlaneadasEditor — cambiar totalMinor', () => {
  it('recalcula las filas SIN editar; las editadas quedan intactas', async () => {
    const wrapper = mountEditor({ totalMinor: 10000 })
    await addRow(wrapper)
    await addRow(wrapper)
    await pickDate(wrapper, 0, new Date(2026, 9, 15))
    await pickDate(wrapper, 1, new Date(2026, 10, 15))
    await amountInputs(wrapper)[0].setValue('20.00')
    await wrapper.vm.$nextTick()

    await wrapper.setProps({ totalMinor: 20000 })
    await wrapper.vm.$nextTick()

    const rows = lastEmitted(wrapper)
    expect(rows[0].montoEsperadoMinor).toBe(2000) // editada: intacta
    expect(rows[1].montoEsperadoMinor).toBe(10000) // sin editar: nueva sugerencia (20000/2)
  })
})

describe('CuotasPlaneadasEditor — deshabilitado', () => {
  it('deshabilita cada input de monto, cada datepicker y los botones', async () => {
    const wrapper = mountEditor({ totalMinor: 10000 })
    await addRow(wrapper)
    await addRow(wrapper)
    await wrapper.setProps({ disabled: true })

    expect(amountInputs(wrapper)[0].attributes('disabled')).toBeDefined()
    expect(pickers(wrapper)[0].props('disabled')).toBe(true)
    expect(addButton(wrapper).attributes('disabled')).toBeDefined()
    expect(removeButtons(wrapper)[0].attributes('disabled')).toBeDefined()
  })
})
