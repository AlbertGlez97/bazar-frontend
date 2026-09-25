// Tests de la molécula BusinessRegistrationForm — validación de cliente con
// VeeValidate + Zod y emisión de evento. No hace fetch (eso vive en
// RegisterBusinessView).
import { describe, it, expect } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import BusinessRegistrationForm from '@/components/ui/molecules/BusinessRegistrationForm.vue'

// VeeValidate valida el esquema con un pequeño debounce (~5 ms): además de vaciar
// las promesas hay que dejar pasar ese tiempo antes de leer los errores.
async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

const NAMES = ['nombreNegocio', 'nombre', 'apellidos', 'correo', 'telefono'] as const
type Field = (typeof NAMES)[number]

const input = (wrapper: VueWrapper, field: Field) => wrapper.get(`input[name="${field}"]`)
/** Mensaje de error que se ve justo bajo un campo (vacío si no hay). */
const errorOf = (wrapper: VueWrapper, field: Field) =>
  input(wrapper, field).element.closest('.app-input-wrap')?.querySelector('.app-input__error')?.textContent?.trim() ?? ''

async function fill(wrapper: VueWrapper, values: Partial<Record<Field, string>>) {
  for (const [field, value] of Object.entries(values)) {
    await input(wrapper, field as Field).setValue(value)
  }
}
async function blur(wrapper: VueWrapper, field: Field) {
  await input(wrapper, field).trigger('blur')
  await settle()
}
async function submit(wrapper: VueWrapper) {
  await wrapper.get('form').trigger('submit')
  await settle()
}

const valid = {
  nombreNegocio: 'Abarrotes Los Pinos',
  nombre: 'Ana',
  apellidos: 'Pérez Soto',
  correo: 'ana@example.com',
}

describe('BusinessRegistrationForm: campos', () => {
  it('muestra los cinco campos del contrato y ninguno del contrato anterior', () => {
    const wrapper = mount(BusinessRegistrationForm)
    const names = wrapper.findAll('input').map((i) => i.attributes('name'))
    expect(names).toEqual([...NAMES])
    expect(wrapper.text()).not.toMatch(/socio fundador|Contacto del socio/)
  })

  it('el teléfono se marca como opcional y el resto no', () => {
    const wrapper = mount(BusinessRegistrationForm)
    const labels = wrapper.findAll('label').map((l) => l.text())
    expect(labels).toContain('Teléfono (opcional)')
    expect(labels.filter((l) => l.includes('opcional'))).toHaveLength(1)
  })

  it('usa los tipos y autocompletados que ayudan en el celular', () => {
    const wrapper = mount(BusinessRegistrationForm)
    expect(input(wrapper, 'correo').attributes('type')).toBe('email')
    expect(input(wrapper, 'correo').attributes('autocomplete')).toBe('email')
    expect(input(wrapper, 'telefono').attributes('type')).toBe('tel')
    expect(input(wrapper, 'nombre').attributes('autocomplete')).toBe('given-name')
    expect(input(wrapper, 'apellidos').attributes('autocomplete')).toBe('family-name')
  })

  it('no muestra errores antes de que la persona toque algo', () => {
    const wrapper = mount(BusinessRegistrationForm)
    expect(wrapper.findAll('.app-input__error')).toHaveLength(0)
  })
})

describe('BusinessRegistrationForm: validación al salir del campo (blur)', () => {
  it.each([
    ['nombreNegocio', '', 'Escribe el nombre de tu negocio.'],
    ['nombre', '', 'Escribe tu nombre.'],
    ['nombre', 'A', 'Tu nombre debe tener al menos 2 letras.'],
    ['apellidos', '', 'Escribe tus apellidos.'],
    ['correo', '', 'Escribe tu correo.'],
    ['correo', 'ana@', 'Ese correo no se ve bien. Revisa que tenga la forma nombre@dominio.com.'],
    ['telefono', '12345', 'Escribe un teléfono de 10 dígitos, por ejemplo 55 1234 5678.'],
  ] as const)('%s = %j muestra "%s" bajo su campo y en ningún otro', async (field, value, message) => {
    const wrapper = mount(BusinessRegistrationForm)
    await input(wrapper, field).setValue(value)
    await blur(wrapper, field)

    expect(errorOf(wrapper, field)).toBe(message)
    for (const other of NAMES.filter((n) => n !== field)) expect(errorOf(wrapper, other)).toBe('')
  })

  it('un teléfono en blanco no da error al salir del campo', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    await blur(wrapper, 'telefono')
    expect(errorOf(wrapper, 'telefono')).toBe('')
  })

  it('el error se marca accesible: aria-invalid y aria-describedby apuntan al mensaje', async () => {
    const wrapper = mount(BusinessRegistrationForm, { attachTo: document.body })
    await blur(wrapper, 'correo')
    const field = input(wrapper, 'correo')
    const message = wrapper.get('.app-input__error')
    expect(field.attributes('aria-invalid')).toBe('true')
    expect(field.attributes('aria-describedby')).toContain(message.attributes('id'))
    // la pista del correo se conserva junto al error
    expect(field.attributes('aria-describedby')).toContain('registro-correo-hint')
    wrapper.unmount()
  })

  it('una vez con error, corregir el campo lo limpia mientras se escribe', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    await input(wrapper, 'correo').setValue('ana@')
    await blur(wrapper, 'correo')
    expect(errorOf(wrapper, 'correo')).not.toBe('')

    await input(wrapper, 'correo').setValue('ana@example.com')
    await settle()
    expect(errorOf(wrapper, 'correo')).toBe('')
  })

  it('antes de tener error, escribir no valida en cada tecla', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    await input(wrapper, 'correo').setValue('a')
    await settle()
    expect(errorOf(wrapper, 'correo')).toBe('')
  })
})

describe('BusinessRegistrationForm: envío', () => {
  it('con todo vacío no emite submit y cada campo obligatorio da su propio mensaje', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    await submit(wrapper)

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(errorOf(wrapper, 'nombreNegocio')).toBe('Escribe el nombre de tu negocio.')
    expect(errorOf(wrapper, 'nombre')).toBe('Escribe tu nombre.')
    expect(errorOf(wrapper, 'apellidos')).toBe('Escribe tus apellidos.')
    expect(errorOf(wrapper, 'correo')).toBe('Escribe tu correo.')
    expect(errorOf(wrapper, 'telefono')).toBe('') // opcional
  })

  it('no envía mientras haya un error, aunque el resto esté bien', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    await fill(wrapper, { ...valid, correo: 'ana@' })
    await submit(wrapper)

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(errorOf(wrapper, 'correo')).toContain('Ese correo no se ve bien')
  })

  it('tras un intento fallido, los errores se corrigen al escribir y luego sí envía', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    await submit(wrapper) // intento fallido: activa la validación al escribir
    await input(wrapper, 'nombre').setValue('Ana')
    await settle()
    expect(errorOf(wrapper, 'nombre')).toBe('')

    await fill(wrapper, { nombreNegocio: valid.nombreNegocio, apellidos: valid.apellidos, correo: valid.correo })
    await submit(wrapper)
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('con datos válidos emite exactamente el contrato y omite el teléfono en blanco', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    await fill(wrapper, valid)
    await submit(wrapper)

    const payload = wrapper.emitted('submit')?.[0]?.[0]
    expect(payload).toStrictEqual({
      nombreNegocio: 'Abarrotes Los Pinos',
      nombre: 'Ana',
      apellidos: 'Pérez Soto',
      correo: 'ana@example.com',
    })
    expect(payload).not.toHaveProperty('telefono')
    expect(payload).not.toHaveProperty('nombreSocio')
    expect(payload).not.toHaveProperty('contactoSocio')
  })

  it('con teléfono válido lo incluye tal como se escribió, recortado', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    await fill(wrapper, { ...valid, telefono: '  55 1234 5678 ' })
    await submit(wrapper)

    expect(wrapper.emitted('submit')?.[0]?.[0]).toStrictEqual({
      nombreNegocio: 'Abarrotes Los Pinos',
      nombre: 'Ana',
      apellidos: 'Pérez Soto',
      correo: 'ana@example.com',
      telefono: '55 1234 5678',
    })
  })

  it('recorta espacios y pasa el correo a minúsculas antes de emitir', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    await fill(wrapper, {
      nombreNegocio: '  Abarrotes Los Pinos ',
      nombre: ' Ana ',
      apellidos: ' Pérez Soto ',
      correo: '  Ana@Example.COM ',
    })
    await submit(wrapper)
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      nombreNegocio: 'Abarrotes Los Pinos',
      nombre: 'Ana',
      apellidos: 'Pérez Soto',
      correo: 'ana@example.com',
    })
  })

  it('con un teléfono mal escrito no envía y lo dice bajo el teléfono', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    await fill(wrapper, { ...valid, telefono: '1234' })
    await submit(wrapper)

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(errorOf(wrapper, 'telefono')).toBe('Escribe un teléfono de 10 dígitos, por ejemplo 55 1234 5678.')
  })

  it('al fallar el envío pone el foco en el primer campo con error', async () => {
    const wrapper = mount(BusinessRegistrationForm, { attachTo: document.body })
    await fill(wrapper, { ...valid, nombre: '' })
    await submit(wrapper)
    await settle()

    expect(document.activeElement).toBe(input(wrapper, 'nombre').element)
    wrapper.unmount()
  })
})

describe('BusinessRegistrationForm: pendiente y doble envío', () => {
  it('mientras loading deshabilita campos y botón, y avisa con un texto', () => {
    const wrapper = mount(BusinessRegistrationForm, { props: { loading: true } })
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    for (const field of NAMES) expect(input(wrapper, field).attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="status"]').text()).toBe('Enviando tu solicitud…')
    expect(wrapper.get('form').attributes('aria-busy')).toBe('true')
  })

  it('sin loading no muestra el aviso de envío', () => {
    const wrapper = mount(BusinessRegistrationForm)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('no emite dos veces si se envía dos veces seguidas antes de que el padre responda', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    await fill(wrapper, valid)
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    await settle()

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('no emite nada mientras loading es true', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    await fill(wrapper, valid)
    await wrapper.setProps({ loading: true })
    await submit(wrapper)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('cuando el padre termina (loading vuelve a false) se puede reintentar', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    await fill(wrapper, valid)
    await submit(wrapper)
    await wrapper.setProps({ loading: true })
    await wrapper.setProps({ loading: false })
    await submit(wrapper)

    expect(wrapper.emitted('submit')).toHaveLength(2)
  })
})

describe('BusinessRegistrationForm: error del servidor por campo', () => {
  it('setFieldError muestra el mensaje bajo el campo y le da el foco', async () => {
    const wrapper = mount(BusinessRegistrationForm, { attachTo: document.body })
    ;(wrapper.vm as unknown as { setFieldError: (f: Field, m: string) => void }).setFieldError('correo', 'Revisa el correo.')
    await settle()

    expect(errorOf(wrapper, 'correo')).toBe('Revisa el correo.')
    expect(document.activeElement).toBe(input(wrapper, 'correo').element)
    wrapper.unmount()
  })
})

describe('BusinessRegistrationForm: accesibilidad', () => {
  it('asocia todos los labels con un control y sin ids repetidos', () => {
    // attachTo: el navegador resuelve label.control sobre el documento
    const wrapper = mount(BusinessRegistrationForm, { attachTo: document.body })
    const labels = wrapper.findAll('label')
    const ids = wrapper.findAll('input').map((i) => i.attributes('id'))

    expect(labels).toHaveLength(5)
    for (const label of labels) {
      expect((label.element as HTMLLabelElement).control).not.toBeNull()
    }
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    wrapper.unmount()
  })
})
