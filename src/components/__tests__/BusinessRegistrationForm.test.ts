// Tests del organismo BusinessRegistrationForm — validación de cliente con VeeValidate + Zod,
// casilla legal, campo trampa, Turnstile y emisión de evento. No hace fetch (eso vive en
// RegisterBusinessView). TurnstileWidget se reemplaza por un doble: su propio comportamiento
// se prueba en TurnstileWidget.test.ts.
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, RouterLinkStub, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import BusinessRegistrationForm from '@/components/ui/organisms/BusinessRegistrationForm.vue'
import { LEGAL_VERSION } from '@/legal/versions'

const resetSpy = vi.fn()
const TurnstileStub = defineComponent({
  name: 'TurnstileWidget',
  props: { siteKey: { type: String, default: '' } },
  emits: ['verified', 'expired', 'failed'],
  setup(_props, { expose }) {
    expose({ reset: resetSpy })
    return () => null
  },
})

function mountForm(props: Record<string, unknown> = {}, attachTo?: HTMLElement) {
  return mount(BusinessRegistrationForm, {
    props: { siteKey: 'site-key', ...props },
    attachTo,
    global: { stubs: { RouterLink: RouterLinkStub, TurnstileWidget: TurnstileStub } },
  })
}

// VeeValidate valida el esquema con un pequeño debounce (~5 ms): además de vaciar
// las promesas hay que dejar pasar ese tiempo antes de leer los errores.
async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

const TEXT_FIELDS = ['nombreNegocio', 'dondeVende', 'nombre', 'apellidos', 'correo', 'telefono', 'recomendadoPor'] as const
type Field = (typeof TEXT_FIELDS)[number] | 'tipoNegocio' | 'queVende' | 'aceptaLegal'

const control = (wrapper: VueWrapper, field: Field) =>
  wrapper.get(`[name="${field}"]`)
/** Mensaje de error que se ve justo bajo un campo (vacío si no hay). */
const errorOf = (wrapper: VueWrapper, field: Field) => {
  const el = control(wrapper, field).element
  const box = el.closest('.app-input-wrap, .app-select-wrap, .app-textarea-wrap, .business-registration-form__legal')
  return box?.querySelector('[class*="__error"]')?.textContent?.trim() ?? ''
}
const captchaError = (wrapper: VueWrapper) => wrapper.find('.business-registration-form__captcha-error').text()

async function fill(wrapper: VueWrapper, values: Partial<Record<Field, string>>) {
  for (const [field, value] of Object.entries(values)) {
    await control(wrapper, field as Field).setValue(value)
  }
}
async function blur(wrapper: VueWrapper, field: Field) {
  await control(wrapper, field).trigger('blur')
  await settle()
}
async function submit(wrapper: VueWrapper) {
  await wrapper.get('form').trigger('submit')
  await settle()
}
async function verifyCaptcha(wrapper: VueWrapper, token = 'token-turnstile') {
  wrapper.findComponent(TurnstileStub).vm.$emit('verified', token)
  await flushPromises()
}
async function accept(wrapper: VueWrapper) {
  await control(wrapper, 'aceptaLegal').setValue(true)
}

const valid = {
  nombreNegocio: 'Abarrotes Los Pinos',
  tipoNegocio: 'abarrotes',
  queVende: 'Abarrotes, dulces y refrescos',
  nombre: 'Ana',
  apellidos: 'Pérez Soto',
  correo: 'ana@example.com',
  telefono: '55 1234 5678',
} as const

async function fillValid(wrapper: VueWrapper) {
  await fill(wrapper, valid)
  await accept(wrapper)
  await verifyCaptcha(wrapper)
}

describe('BusinessRegistrationForm: campos', () => {
  it('muestra los campos del registro en el orden de la página', () => {
    const wrapper = mountForm()
    const labels = wrapper.findAll('label').map((l) => l.text())

    expect(labels.slice(0, 9)).toEqual([
      'Nombre del negocio',
      'Tipo de negocio',
      '¿Qué vendes?',
      '¿Dónde vendes? (opcional)',
      'Tu nombre',
      'Tus apellidos',
      'Correo electrónico',
      'Número de WhatsApp',
      '¿Quién te recomendó? (opcional)',
    ])
  })

  it('solo "dónde vendes" y "quién te recomendó" son opcionales; el teléfono NO lo es', () => {
    const labels = mountForm().findAll('label').map((l) => l.text())

    expect(labels.filter((l) => l.includes('opcional'))).toHaveLength(2)
    expect(labels).toContain('Número de WhatsApp')
  })

  it('el tipo de negocio es una lista con las ocho opciones y una indicación inicial', () => {
    const options = mountForm().get('select[name="tipoNegocio"]').findAll('option')

    expect(options.map((o) => o.text())).toEqual([
      'Elige una opción',
      'Bazar o tianguis',
      'Abarrotes o tiendita',
      'Ropa y accesorios',
      'Comida y bebidas',
      'Plantas y jardinería',
      'Artesanías',
      'Servicios',
      'Otro',
    ])
  })

  it('"qué vendes" lleva un contador de caracteres que se actualiza al escribir', async () => {
    const wrapper = mountForm()
    expect(wrapper.get('#registro-quevende-count').text()).toBe('0 de 400')

    await control(wrapper, 'queVende').setValue('Ropa de segunda')

    expect(wrapper.get('#registro-quevende-count').text()).toBe('15 de 400')
    expect(control(wrapper, 'queVende').attributes('aria-describedby')).toContain('registro-quevende-count')
  })

  it('usa los tipos y autocompletados que ayudan en el celular', () => {
    const wrapper = mountForm()
    expect(control(wrapper, 'correo').attributes('type')).toBe('email')
    expect(control(wrapper, 'correo').attributes('autocomplete')).toBe('email')
    expect(control(wrapper, 'telefono').attributes('type')).toBe('tel')
    expect(control(wrapper, 'telefono').attributes('autocomplete')).toBe('tel-national')
    expect(control(wrapper, 'nombre').attributes('autocomplete')).toBe('given-name')
    expect(control(wrapper, 'apellidos').attributes('autocomplete')).toBe('family-name')
  })

  it('explica para qué es el WhatsApp y que el correo se confirma', () => {
    const text = mountForm().text()

    expect(text).toMatch(/te escribimos por WhatsApp/i)
    expect(text).toMatch(/te mandamos un enlace para confirmarlo/i)
  })

  it('muestra el resumen del aviso de privacidad y la casilla con enlaces al aviso y a los términos', () => {
    const wrapper = mountForm()
    const label = wrapper.get('.business-registration-form__legal label')
    const links = label.findAllComponents(RouterLinkStub)

    expect(wrapper.find('.legal-notice-summary').exists()).toBe(true)
    expect(label.text()).toContain('Leí el Aviso de privacidad y los Términos')
    expect(links.map((l) => l.props('to'))).toEqual(['/privacidad', '/terminos'])
    for (const link of links) {
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toContain('noopener')
    }
  })

  it('la casilla empieza sin marcar', () => {
    expect((control(mountForm(), 'aceptaLegal').element as HTMLInputElement).checked).toBe(false)
  })

  it('dibuja el widget de verificación con la clave pública que recibe', () => {
    const wrapper = mountForm({ siteKey: 'otra-clave' })

    expect(wrapper.findComponent(TurnstileStub).props('siteKey')).toBe('otra-clave')
  })

  it('no muestra errores antes de que la persona toque algo', () => {
    const wrapper = mountForm()
    expect(wrapper.findAll('[class*="__error"]')).toHaveLength(0)
    expect(wrapper.find('.business-registration-form__captcha-error').exists()).toBe(false)
  })
})

describe('BusinessRegistrationForm: campo trampa', () => {
  const trap = (wrapper: VueWrapper) => wrapper.get('input[name="contacto_alterno"]')

  it('existe, escondido para las personas y para lectores de pantalla, fuera del orden del teclado', () => {
    const wrapper = mountForm()
    const holder = trap(wrapper).element.closest('[aria-hidden="true"]')

    expect(holder).not.toBeNull()
    expect(trap(wrapper).attributes('tabindex')).toBe('-1')
    expect(trap(wrapper).attributes('autocomplete')).toBe('off')
  })

  it('su nombre no delata para qué sirve (ni "trampa" ni el nombre del contrato)', () => {
    const name = trap(mountForm()).attributes('name')!

    expect(name).not.toMatch(/trampa|honeypot|bot|sitioWebEmpresa/i)
  })

  it('un bot que lo llena se envía tal cual en sitioWebEmpresa (el servidor lo ignora en silencio)', async () => {
    const wrapper = mountForm()
    await fillValid(wrapper)
    await trap(wrapper).setValue('http://spam.example')
    await submit(wrapper)

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ sitioWebEmpresa: 'http://spam.example' })
  })

  it('una persona lo deja vacío: se envía vacío', async () => {
    const wrapper = mountForm()
    await fillValid(wrapper)
    await submit(wrapper)

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ sitioWebEmpresa: '' })
  })
})

describe('BusinessRegistrationForm: validación al salir del campo (blur)', () => {
  it.each([
    ['nombreNegocio', '', 'Escribe el nombre de tu negocio.'],
    ['queVende', '', 'Cuéntanos qué vendes.'],
    ['queVende', 'Ropa', 'Cuéntanos un poco más: escribe al menos 10 letras.'],
    ['nombre', '', 'Escribe tu nombre.'],
    ['nombre', 'A', 'Tu nombre debe tener al menos 2 letras.'],
    ['apellidos', '', 'Escribe tus apellidos.'],
    ['correo', '', 'Escribe tu correo.'],
    ['correo', 'ana@', 'Ese correo no se ve bien. Revisa que tenga la forma nombre@dominio.com.'],
    ['telefono', '', 'Escribe tu número de WhatsApp.'],
    ['telefono', '12345', 'Escribe un número de 10 dígitos, por ejemplo 55 1234 5678.'],
  ] as const)('%s = %j muestra "%s" bajo su campo y en ningún otro', async (field, value, message) => {
    const wrapper = mountForm()
    await control(wrapper, field).setValue(value)
    await blur(wrapper, field)

    expect(errorOf(wrapper, field)).toBe(message)
    for (const other of [...TEXT_FIELDS, 'queVende', 'tipoNegocio'] as Field[]) {
      if (other !== field) expect(errorOf(wrapper, other)).toBe('')
    }
  })

  it('el tipo de negocio sin elegir pide elegirlo al salir del campo', async () => {
    const wrapper = mountForm()
    await blur(wrapper, 'tipoNegocio')

    expect(errorOf(wrapper, 'tipoNegocio')).toBe('Elige el tipo de tu negocio.')
  })

  it('los campos opcionales en blanco no dan error', async () => {
    const wrapper = mountForm()
    await blur(wrapper, 'dondeVende')
    await blur(wrapper, 'recomendadoPor')

    expect(errorOf(wrapper, 'dondeVende')).toBe('')
    expect(errorOf(wrapper, 'recomendadoPor')).toBe('')
  })

  it('el error se marca accesible: aria-invalid y aria-describedby apuntan al mensaje', async () => {
    const wrapper = mountForm({}, document.body)
    await blur(wrapper, 'correo')
    const field = control(wrapper, 'correo')
    const message = wrapper.get('.app-input__error')
    expect(field.attributes('aria-invalid')).toBe('true')
    expect(field.attributes('aria-describedby')).toContain(message.attributes('id'))
    wrapper.unmount()
  })

  it('una vez con error, corregir el campo lo limpia mientras se escribe', async () => {
    const wrapper = mountForm()
    await control(wrapper, 'correo').setValue('ana@')
    await blur(wrapper, 'correo')
    expect(errorOf(wrapper, 'correo')).not.toBe('')

    await control(wrapper, 'correo').setValue('ana@example.com')
    await settle()
    expect(errorOf(wrapper, 'correo')).toBe('')
  })

  it('antes de tener error, escribir no valida en cada tecla', async () => {
    const wrapper = mountForm()
    await control(wrapper, 'correo').setValue('a')
    await settle()
    expect(errorOf(wrapper, 'correo')).toBe('')
  })
})

describe('BusinessRegistrationForm: envío', () => {
  it('con todo vacío no emite submit y cada obligatorio da su propio mensaje, en frases cortas', async () => {
    const wrapper = mountForm()
    await submit(wrapper)

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(errorOf(wrapper, 'nombreNegocio')).toBe('Escribe el nombre de tu negocio.')
    expect(errorOf(wrapper, 'tipoNegocio')).toBe('Elige el tipo de tu negocio.')
    expect(errorOf(wrapper, 'queVende')).toBe('Cuéntanos qué vendes.')
    expect(errorOf(wrapper, 'nombre')).toBe('Escribe tu nombre.')
    expect(errorOf(wrapper, 'apellidos')).toBe('Escribe tus apellidos.')
    expect(errorOf(wrapper, 'correo')).toBe('Escribe tu correo.')
    expect(errorOf(wrapper, 'telefono')).toBe('Escribe tu número de WhatsApp.')
    expect(errorOf(wrapper, 'aceptaLegal')).toBe('Para continuar, acepta el Aviso de privacidad y los Términos.')
    expect(errorOf(wrapper, 'dondeVende')).toBe('')
    expect(errorOf(wrapper, 'recomendadoPor')).toBe('')
    const messages = wrapper.findAll('[class*="__error"]').map((e) => e.text())
    expect(messages.every((m) => m.split(/\s+/).length <= 20)).toBe(true)
  })

  it('SIN marcar la casilla no envía, aunque todo lo demás esté bien', async () => {
    const wrapper = mountForm()
    await fill(wrapper, valid)
    await verifyCaptcha(wrapper)
    await submit(wrapper)

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(errorOf(wrapper, 'aceptaLegal')).toBe('Para continuar, acepta el Aviso de privacidad y los Términos.')
  })

  it('marcar la casilla quita su error al instante', async () => {
    const wrapper = mountForm()
    await submit(wrapper)
    expect(errorOf(wrapper, 'aceptaLegal')).not.toBe('')

    await accept(wrapper)
    await settle()

    expect(errorOf(wrapper, 'aceptaLegal')).toBe('')
  })

  it('SIN la verificación de seguridad no envía y lo dice junto al widget', async () => {
    const wrapper = mountForm()
    await fill(wrapper, valid)
    await accept(wrapper)
    await submit(wrapper)

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(captchaError(wrapper)).toBe('Completa la verificación de seguridad.')
  })

  it('si la verificación vence, hay que repetirla antes de enviar', async () => {
    const wrapper = mountForm()
    await fillValid(wrapper)
    wrapper.findComponent(TurnstileStub).vm.$emit('expired')
    await flushPromises()
    await submit(wrapper)

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(captchaError(wrapper)).toBe('Completa la verificación de seguridad.')
  })

  it('si el widget falló, el mensaje dice qué hacer y NO se pierde nada de lo escrito', async () => {
    const wrapper = mountForm()
    await fill(wrapper, valid)
    await accept(wrapper)
    wrapper.findComponent(TurnstileStub).vm.$emit('failed', 'load')
    await flushPromises()
    await submit(wrapper)

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(captchaError(wrapper)).toBe('La verificación de seguridad no está lista. Toca «Reintentar» o revisa tu internet.')
    expect((control(wrapper, 'nombreNegocio').element as HTMLInputElement).value).toBe(valid.nombreNegocio)
    expect((control(wrapper, 'queVende').element as HTMLTextAreaElement).value).toBe(valid.queVende)
    expect((control(wrapper, 'aceptaLegal').element as HTMLInputElement).checked).toBe(true)
  })

  it('al verificar de nuevo, el aviso de la verificación desaparece', async () => {
    const wrapper = mountForm()
    await submit(wrapper)
    expect(wrapper.find('.business-registration-form__captcha-error').exists()).toBe(true)

    await verifyCaptcha(wrapper)

    expect(wrapper.find('.business-registration-form__captcha-error').exists()).toBe(false)
  })

  it('no envía mientras haya un error, aunque el resto esté bien', async () => {
    const wrapper = mountForm()
    await fillValid(wrapper)
    await control(wrapper, 'correo').setValue('ana@')
    await submit(wrapper)

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(errorOf(wrapper, 'correo')).toContain('Ese correo no se ve bien')
  })

  it('con datos válidos emite exactamente el contrato: teléfono a 10 dígitos, versión legal vigente y token', async () => {
    const wrapper = mountForm()
    await fillValid(wrapper)
    await submit(wrapper)

    const payload = wrapper.emitted('submit')?.[0]?.[0]
    expect(payload).toStrictEqual({
      nombreNegocio: 'Abarrotes Los Pinos',
      tipoNegocio: 'abarrotes',
      queVende: 'Abarrotes, dulces y refrescos',
      nombre: 'Ana',
      apellidos: 'Pérez Soto',
      correo: 'ana@example.com',
      telefono: '5512345678',
      aceptaLegal: true,
      versionLegal: LEGAL_VERSION,
      turnstileToken: 'token-turnstile',
      sitioWebEmpresa: '',
    })
    expect(payload).not.toHaveProperty('dondeVende')
    expect(payload).not.toHaveProperty('recomendadoPor')
    expect(payload).not.toHaveProperty('nombreSocio')
  })

  it('la versión legal que se envía es LEGAL_VERSION (no una fecha escrita a mano)', async () => {
    const wrapper = mountForm()
    await fillValid(wrapper)
    await submit(wrapper)

    expect((wrapper.emitted('submit')?.[0]?.[0] as { versionLegal: string }).versionLegal).toBe(LEGAL_VERSION)
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('los opcionales llenos viajan, recortados', async () => {
    const wrapper = mountForm()
    await fillValid(wrapper)
    await fill(wrapper, { dondeVende: '  Tianguis de Acolman ', recomendadoPor: ' Doña Luz ' })
    await submit(wrapper)

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      dondeVende: 'Tianguis de Acolman',
      recomendadoPor: 'Doña Luz',
    })
  })

  it('recorta espacios y pasa el correo a minúsculas antes de emitir', async () => {
    const wrapper = mountForm()
    await fillValid(wrapper)
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

  it('no manda enlaces de redes ni de mapas: el contrato no tiene ese campo', async () => {
    const wrapper = mountForm()
    await fillValid(wrapper)
    await submit(wrapper)

    const keys = Object.keys(wrapper.emitted('submit')![0][0] as object)
    expect(keys.some((k) => /facebook|instagram|maps|mapa|red|url|link/i.test(k))).toBe(false)
  })

  it('al fallar el envío pone el foco en el primer campo con error, en el orden de la página', async () => {
    const wrapper = mountForm({}, document.body)
    await fillValid(wrapper)
    await control(wrapper, 'tipoNegocio').setValue('')
    await control(wrapper, 'nombre').setValue('')
    await submit(wrapper)
    await settle()

    expect(document.activeElement).toBe(control(wrapper, 'tipoNegocio').element)
    wrapper.unmount()
  })

  it('si lo único que falta es la verificación, el foco va a ese aviso', async () => {
    const wrapper = mountForm({}, document.body)
    await fill(wrapper, valid)
    await accept(wrapper)
    await submit(wrapper)
    await settle()

    expect(document.activeElement).toBe(wrapper.get('.business-registration-form__captcha-error').element)
    wrapper.unmount()
  })
})

describe('BusinessRegistrationForm: pendiente, doble envío y verificación gastada', () => {
  it('mientras loading deshabilita todos los campos y el botón, y avisa con un texto', () => {
    const wrapper = mountForm({ loading: true })
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    for (const field of [...TEXT_FIELDS, 'tipoNegocio', 'queVende', 'aceptaLegal'] as Field[]) {
      expect(control(wrapper, field).attributes('disabled')).toBeDefined()
    }
    expect(wrapper.get('[role="status"]').text()).toBe('Enviando tu solicitud…')
    expect(wrapper.get('form').attributes('aria-busy')).toBe('true')
  })

  it('sin loading no muestra el aviso de envío', () => {
    expect(mountForm().find('[role="status"]').exists()).toBe(false)
  })

  it('no emite dos veces si se envía dos veces seguidas antes de que el padre responda', async () => {
    const wrapper = mountForm()
    await fillValid(wrapper)
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    await settle()

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('no emite nada mientras loading es true', async () => {
    const wrapper = mountForm()
    await fillValid(wrapper)
    await wrapper.setProps({ loading: true })
    await submit(wrapper)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('cuando el padre termina (loading vuelve a false) se puede reintentar, pero con una verificación NUEVA', async () => {
    const wrapper = mountForm()
    await fillValid(wrapper)
    await submit(wrapper)
    await wrapper.setProps({ loading: true })
    await wrapper.setProps({ loading: false })

    // el token ya se gastó: sin verificarlo de nuevo no sale otro envío
    await submit(wrapper)
    expect(wrapper.emitted('submit')).toHaveLength(1)

    await verifyCaptcha(wrapper, 'token-nuevo')
    await submit(wrapper)
    expect(wrapper.emitted('submit')).toHaveLength(2)
    expect((wrapper.emitted('submit')![1][0] as { turnstileToken: string }).turnstileToken).toBe('token-nuevo')
  })

  it('al terminar un envío (con éxito o con error) reinicia el widget de verificación', async () => {
    resetSpy.mockClear()
    const wrapper = mountForm()
    await fillValid(wrapper)
    await submit(wrapper)

    await wrapper.setProps({ loading: true })
    await wrapper.setProps({ loading: false })

    expect(resetSpy).toHaveBeenCalledTimes(1)
  })
})

describe('BusinessRegistrationForm: sin conexión', () => {
  it('avisa breve cuando el navegador pierde internet y lo quita al volver', async () => {
    const wrapper = mountForm()
    expect(wrapper.text()).not.toContain('Sin internet')

    window.dispatchEvent(new Event('offline'))
    await flushPromises()
    expect(wrapper.get('.business-registration-form__offline').text()).toBe('Sin internet. Conéctate para enviar tu solicitud.')

    window.dispatchEvent(new Event('online'))
    await flushPromises()
    expect(wrapper.find('.business-registration-form__offline').exists()).toBe(false)
  })

  it('el aviso no borra lo escrito', async () => {
    const wrapper = mountForm()
    await control(wrapper, 'nombreNegocio').setValue('Mi tienda')

    window.dispatchEvent(new Event('offline'))
    await flushPromises()

    expect((control(wrapper, 'nombreNegocio').element as HTMLInputElement).value).toBe('Mi tienda')
    window.dispatchEvent(new Event('online'))
  })
})

describe('BusinessRegistrationForm: error del servidor por campo y verificación', () => {
  it('setFieldError muestra el mensaje bajo el campo y le da el foco', async () => {
    const wrapper = mountForm({}, document.body)
    ;(wrapper.vm as unknown as { setFieldError: (f: Field, m: string) => void }).setFieldError('correo', 'Revisa el correo.')
    await settle()

    expect(errorOf(wrapper, 'correo')).toBe('Revisa el correo.')
    expect(document.activeElement).toBe(control(wrapper, 'correo').element)
    wrapper.unmount()
  })

  it('resetCaptcha() borra el token gastado y reinicia el widget', async () => {
    resetSpy.mockClear()
    const wrapper = mountForm()
    await fillValid(wrapper)

    ;(wrapper.vm as unknown as { resetCaptcha: () => void }).resetCaptcha()
    await submit(wrapper)

    expect(resetSpy).toHaveBeenCalled()
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})

describe('BusinessRegistrationForm: accesibilidad', () => {
  it('cada control visible tiene su label asociado y no hay ids repetidos', () => {
    // attachTo: el navegador resuelve label.control sobre el documento
    const wrapper = mountForm({}, document.body)
    const visible = wrapper.findAll('input, select, textarea').filter((c) => !c.element.closest('[aria-hidden="true"]'))
    // la casilla va DENTRO de su label, no necesita id
    const ids = visible.filter((c) => c.attributes('type') !== 'checkbox').map((c) => c.attributes('id'))

    expect(visible.length).toBe(10) // 7 de texto + tipo + qué vendes + casilla
    for (const c of visible) {
      const labelled = (c.element as HTMLInputElement).labels
      expect(labelled && labelled.length).toBeGreaterThan(0)
    }
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    wrapper.unmount()
  })

  it('el error de la casilla está enlazado con aria-describedby y aria-invalid', async () => {
    const wrapper = mountForm()
    await submit(wrapper)
    const checkbox = control(wrapper, 'aceptaLegal')
    const message = wrapper.get('.business-registration-form__legal-error')

    expect(checkbox.attributes('aria-invalid')).toBe('true')
    expect(checkbox.attributes('aria-describedby')).toContain(message.attributes('id'))
  })

  it('el error de la verificación se anuncia como alerta', async () => {
    const wrapper = mountForm()
    await submit(wrapper)

    expect(wrapper.get('.business-registration-form__captcha-error').attributes('role')).toBe('alert')
  })

  it('se puede llegar a todo con el teclado: ningún control visible quita el foco del orden', () => {
    const wrapper = mountForm()
    const visible = wrapper.findAll('input, select, textarea, button').filter((c) => !c.element.closest('[aria-hidden="true"]'))

    expect(visible.every((c) => c.attributes('tabindex') !== '-1')).toBe(true)
  })

  it('el campo trampa NO está en el orden del teclado', () => {
    expect(mountForm().get('input[name="contacto_alterno"]').attributes('tabindex')).toBe('-1')
  })
})
