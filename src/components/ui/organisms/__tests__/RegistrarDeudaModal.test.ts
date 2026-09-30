// Formulario de fiado/apartado (D3): tipo, nombre del deudor (requerido),
// teléfono y notas (opcionales), abono inicial explícito (D1) y cuotas
// planeadas opcionales (D2). Presentacional: no llama servicios, solo valida
// y emite lo que la persona confirmó.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import RegistrarDeudaModal from '../RegistrarDeudaModal.vue'

function mountModal(props: Partial<{ modelValue: boolean; submitting: boolean; totalMinor: number }> = {}) {
  return mount(RegistrarDeudaModal, {
    props: { modelValue: true, totalMinor: 10000, ...props },
    global: { stubs: { teleport: true } },
  })
}
type Wrapper = ReturnType<typeof mountModal>

const submitBtn = (w: Wrapper) => w.get('button[data-action="confirm-debt"]')
const nombreInput = (w: Wrapper) => w.findAll('input')[0]
const abonoInput = (w: Wrapper) => w.get('input[inputmode="decimal"]')

async function fillNombre(w: Wrapper, name = 'Lucía') {
  await nombreInput(w).setValue(name)
}

describe('RegistrarDeudaModal — contenido', () => {
  it('trae selector de tipo (fiado/apartado), nombre, teléfono, notas y abono inicial', () => {
    const wrapper = mountModal()
    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.findAll('input')).toHaveLength(4) // nombre + teléfono + abono inicial + toggle de cuotas
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('el tipo por defecto es fiado', () => {
    const wrapper = mountModal()
    expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('fiado')
  })
})

// D1: el abono inicial es un campo EXPLÍCITO, nunca inferido de nada externo
// (este componente ni siquiera recibe el efectivo del carrito como prop).
describe('RegistrarDeudaModal — abono inicial explícito (D1)', () => {
  it('el campo muestra "0.00" por defecto, no vacío', () => {
    const wrapper = mountModal()
    expect((abonoInput(wrapper).element as HTMLInputElement).value).toBe('0.00')
  })

  it('sin tocar el abono, confirm manda abonoInicialMinor: 0 explícitamente', async () => {
    const wrapper = mountModal()
    await fillNombre(wrapper)
    await submitBtn(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')?.[0][0]).toMatchObject({ abonoInicialMinor: 0 })
  })

  it('escribir un monto lo manda en centavos', async () => {
    const wrapper = mountModal()
    await fillNombre(wrapper)
    await abonoInput(wrapper).setValue('150.50')
    await submitBtn(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')?.[0][0]).toMatchObject({ abonoInicialMinor: 15050 })
  })

  it('un monto ambiguo ("100,50") no emite confirm y muestra el error', async () => {
    const wrapper = mountModal()
    await fillNombre(wrapper)
    await abonoInput(wrapper).setValue('100,50')
    await submitBtn(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')).toBeUndefined()
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
// obligatoria); al activarla aparece el calendario multi-fecha.
describe('RegistrarDeudaModal — cuotas planeadas (D2)', () => {
  it('el calendario está oculto hasta activar el toggle', () => {
    const wrapper = mountModal()
    expect(wrapper.findComponent(VueDatePicker).exists()).toBe(false)
  })

  it('activar el toggle revela el calendario', async () => {
    const wrapper = mountModal()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(wrapper.findComponent(VueDatePicker).exists()).toBe(true)
  })

  it('elegir fechas y confirmar manda las cuotas sugeridas (reparto parejo del saldo tras el abono)', async () => {
    const wrapper = mountModal({ totalMinor: 10000 })
    await fillNombre(wrapper)
    await abonoInput(wrapper).setValue('20.00') // abonoInicialMinor: 2000 -> resto 8000
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.findComponent(VueDatePicker).vm.$emit('update:model-value', [new Date(2026, 9, 15), new Date(2026, 10, 15)])
    await wrapper.vm.$nextTick()

    await submitBtn(wrapper).trigger('click')

    const payload = wrapper.emitted('confirm')?.[0][0] as { cuotasPlaneadas: Array<{ montoEsperadoMinor: number }> }
    expect(payload.cuotasPlaneadas.map((c) => c.montoEsperadoMinor)).toEqual([4000, 4000])
  })

  it('cada cuota es editable: lo editado se manda, no la sugerencia', async () => {
    const wrapper = mountModal({ totalMinor: 10000 })
    await fillNombre(wrapper)
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.findComponent(VueDatePicker).vm.$emit('update:model-value', [new Date(2026, 9, 15), new Date(2026, 10, 15)])
    await wrapper.vm.$nextTick()

    const cuotaInputs = wrapper.findAll('input[inputmode="decimal"]').slice(1) // [0] es el abono inicial
    await cuotaInputs[0].setValue('75.00')
    await wrapper.vm.$nextTick()

    await submitBtn(wrapper).trigger('click')

    const payload = wrapper.emitted('confirm')?.[0][0] as { cuotasPlaneadas: Array<{ montoEsperadoMinor: number }> }
    expect(payload.cuotasPlaneadas[0].montoEsperadoMinor).toBe(7500)
    expect(payload.cuotasPlaneadas[1].montoEsperadoMinor).toBe(5000) // sin editar: sugerencia pareja de 10000/2
  })

  it('apagar el toggle después de elegir fechas manda cuotasPlaneadas vacío', async () => {
    const wrapper = mountModal({ totalMinor: 10000 })
    await fillNombre(wrapper)
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.findComponent(VueDatePicker).vm.$emit('update:model-value', [new Date(2026, 9, 15)])
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
    await abonoInput(wrapper).setValue('50.00')
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })

    expect((nombreInput(wrapper).element as HTMLInputElement).value).toBe('')
    expect((abonoInput(wrapper).element as HTMLInputElement).value).toBe('0.00')
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
    expect(abonoInput(wrapper).attributes('disabled')).toBeDefined()
    expect(submitBtn(wrapper).text()).toBe('Registrando…')
  })
})
