// Formulario de fiado/apartado (D3): tipo, nombre del deudor (requerido),
// teléfono y notas (opcionales). Presentacional: no llama servicios, solo
// valida y emite lo que la persona confirmó.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RegistrarDeudaModal from '../RegistrarDeudaModal.vue'

function mountModal(props: Partial<{ modelValue: boolean; submitting: boolean }> = {}) {
  return mount(RegistrarDeudaModal, {
    props: { modelValue: true, ...props },
    global: { stubs: { teleport: true } },
  })
}

const submitBtn = (w: ReturnType<typeof mountModal>) => w.get('button[data-action="confirm-debt"]')

describe('RegistrarDeudaModal — contenido', () => {
  it('trae selector de tipo (fiado/apartado), nombre, teléfono y notas', () => {
    const wrapper = mountModal()
    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.findAll('input')).toHaveLength(2) // nombre + teléfono
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('el tipo por defecto es fiado', () => {
    const wrapper = mountModal()
    expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('fiado')
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
    await wrapper.findAll('input')[0].setValue('   ')
    await submitBtn(wrapper).trigger('click')
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('con nombre, emite confirm con el tipo, el nombre y sin teléfono/notas vacíos', async () => {
    const wrapper = mountModal()
    await wrapper.findAll('input')[0].setValue('Lucía')
    await submitBtn(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[{ type: 'fiado', deudor: { nombre: 'Lucía' } }]])
  })

  it('recorta espacios del nombre', async () => {
    const wrapper = mountModal()
    await wrapper.findAll('input')[0].setValue('  Lucía  ')
    await submitBtn(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')?.[0][0]).toMatchObject({ deudor: { nombre: 'Lucía' } })
  })

  it('con teléfono y notas los incluye recortados; cambiar a apartado lo manda en el tipo', async () => {
    const wrapper = mountModal()
    await wrapper.get('select').setValue('apartado')
    await wrapper.findAll('input')[0].setValue('Lucía')
    await wrapper.findAll('input')[1].setValue(' 555-0001 ')
    await wrapper.get('textarea').setValue(' Pasa el sábado ')
    await submitBtn(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[{
      type: 'apartado',
      deudor: { nombre: 'Lucía', telefono: '555-0001', notas: 'Pasa el sábado' },
    }]])
  })

  it('escribir después de un error lo quita al reintentar con éxito', async () => {
    const wrapper = mountModal()
    await submitBtn(wrapper).trigger('click')
    expect(wrapper.text()).toContain('Escribe el nombre de quien debe.')

    await wrapper.findAll('input')[0].setValue('Ana')
    await submitBtn(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})

describe('RegistrarDeudaModal — abrir y cerrar', () => {
  it('reinicia el formulario cada vez que se abre', async () => {
    const wrapper = mountModal({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await wrapper.findAll('input')[0].setValue('Ana')
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })

    expect((wrapper.findAll('input')[0].element as HTMLInputElement).value).toBe('')
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
    expect(wrapper.findAll('input')[0].attributes('disabled')).toBeDefined()
    expect(submitBtn(wrapper).text()).toBe('Registrando…')
  })
})
