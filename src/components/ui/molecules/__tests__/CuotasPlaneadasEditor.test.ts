// Molécula: calendario de cuotas planeadas (D2). Multi-fecha con
// @vuepic/vue-datepicker; una fila de monto editable por fecha, pre-llenada
// con un reparto parejo del total (splitEvenMinor). Es solo una sugerencia:
// lo editado se manda tal cual, nunca la sugerencia original.
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

async function selectDates(wrapper: Wrapper, dates: Date[]) {
  await wrapper.findComponent(VueDatePicker).vm.$emit('update:model-value', dates)
  await wrapper.vm.$nextTick()
}

function lastEmitted(wrapper: Wrapper): Array<{ fechaEsperada: string; montoEsperadoMinor: number }> {
  const events = wrapper.emitted('update:cuotas')
  return (events?.at(-1)?.[0] ?? []) as Array<{ fechaEsperada: string; montoEsperadoMinor: number }>
}

const amountInputs = (wrapper: Wrapper) => wrapper.findAll('input[inputmode="decimal"]')

describe('CuotasPlaneadasEditor — sin fechas', () => {
  it('emite un arreglo vacío y no muestra filas', () => {
    const wrapper = mountEditor()
    expect(lastEmitted(wrapper)).toEqual([])
    expect(amountInputs(wrapper)).toHaveLength(0)
  })
})

describe('CuotasPlaneadasEditor — reparto parejo (D2)', () => {
  it('una fecha: la fila trae el total completo sugerido', async () => {
    const wrapper = mountEditor({ totalMinor: 10000 })
    await selectDates(wrapper, [new Date(2026, 9, 15)])

    const rows = lastEmitted(wrapper)
    expect(rows).toHaveLength(1)
    expect(rows[0].montoEsperadoMinor).toBe(10000)
    expect(amountInputs(wrapper)).toHaveLength(1)
  })

  it('tres fechas: reparte parejo con la última cuota absorbiendo el resto', async () => {
    const wrapper = mountEditor({ totalMinor: 10000 })
    await selectDates(wrapper, [new Date(2026, 9, 15), new Date(2026, 10, 15), new Date(2026, 11, 15)])

    expect(lastEmitted(wrapper).map((c) => c.montoEsperadoMinor)).toEqual([3333, 3333, 3334])
  })

  it('cada fila es individualmente editable; lo editado se manda tal cual, no la sugerencia', async () => {
    const wrapper = mountEditor({ totalMinor: 10000 })
    await selectDates(wrapper, [new Date(2026, 9, 15), new Date(2026, 10, 15)])

    await amountInputs(wrapper)[0].setValue('20.00')
    await wrapper.vm.$nextTick()

    const rows = lastEmitted(wrapper)
    expect(rows[0].montoEsperadoMinor).toBe(2000)
    expect(rows[1].montoEsperadoMinor).toBe(5000) // sin tocar: sigue la sugerencia pareja
  })

  it('una fila editada NO se recalcula si cambia el número de fechas; las demás sí', async () => {
    const wrapper = mountEditor({ totalMinor: 10000 })
    await selectDates(wrapper, [new Date(2026, 9, 15), new Date(2026, 10, 15)])
    await amountInputs(wrapper)[0].setValue('20.00')
    await wrapper.vm.$nextTick()

    await selectDates(wrapper, [new Date(2026, 9, 15), new Date(2026, 10, 15), new Date(2026, 11, 15)])

    expect(lastEmitted(wrapper)[0].montoEsperadoMinor).toBe(2000)
  })

  it('quitar una fecha quita su fila', async () => {
    const wrapper = mountEditor({ totalMinor: 10000 })
    await selectDates(wrapper, [new Date(2026, 9, 15), new Date(2026, 10, 15)])
    await selectDates(wrapper, [new Date(2026, 9, 15)])

    expect(amountInputs(wrapper)).toHaveLength(1)
    expect(lastEmitted(wrapper)).toHaveLength(1)
  })

  it('cambiar totalMinor recalcula las filas SIN editar, no las editadas', async () => {
    const wrapper = mountEditor({ totalMinor: 10000 })
    await selectDates(wrapper, [new Date(2026, 9, 15), new Date(2026, 10, 15)])
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
  it('deshabilita cada input de monto', async () => {
    const wrapper = mountEditor({ totalMinor: 10000, disabled: true })
    await selectDates(wrapper, [new Date(2026, 9, 15)])

    expect(amountInputs(wrapper)[0].attributes('disabled')).toBeDefined()
  })
})
