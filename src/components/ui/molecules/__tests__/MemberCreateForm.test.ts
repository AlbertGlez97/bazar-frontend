import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MemberCreateForm from '../MemberCreateForm.vue'

function mountForm(props: Record<string, unknown> = {}) {
  return mount(MemberCreateForm, { props })
}
type Wrapper = ReturnType<typeof mountForm>

const byLabel = (w: Wrapper, label: string) => {
  const l = w.findAll('label').find((x) => x.text() === label)
  if (!l) throw new Error(`No hay campo "${label}"`)
  return w.get(`#${l.attributes('for')}`)
}
const errors = (w: Wrapper) => w.findAll('.app-input__error, .app-select__error').map((e) => e.text())
const submit = (w: Wrapper) => w.find('form').trigger('submit')

async function fillBasics(w: Wrapper, over: Partial<Record<'nombre' | 'apellidos' | 'correo', string>> = {}) {
  await byLabel(w, 'Nombre').setValue(over.nombre ?? 'Carlos')
  await byLabel(w, 'Apellidos').setValue(over.apellidos ?? 'Núñez')
  await byLabel(w, 'Correo').setValue(over.correo ?? 'carlos@example.com')
}

describe('MemberCreateForm — estructura', () => {
  it('tiene nombre, apellidos, correo, rol y comisión, cada uno con su etiqueta', () => {
    const w = mountForm()
    expect(w.findAll('label').map((l) => l.text())).toEqual(['Nombre', 'Apellidos', 'Correo', 'Rol', 'Comisión (%)'])
  })

  it('cada etiqueta apunta a su campo (for/id)', () => {
    const w = mountForm()
    for (const label of w.findAll('label')) {
      expect(w.find(`#${label.attributes('for')}`).exists()).toBe(true)
    }
  })

  it('el rol ofrece Colaborador y Socio, y por defecto es Colaborador', () => {
    const w = mountForm()
    const select = byLabel(w, 'Rol')
    expect(select.findAll('option').map((o) => o.text())).toEqual(['Colaborador', 'Socio'])
    expect((select.element as HTMLSelectElement).value).toBe('colaborador')
  })

  it('el correo es de tipo email y ningún campo se autocompleta con datos de quien está escribiendo', () => {
    const w = mountForm()
    expect(byLabel(w, 'Correo').attributes('type')).toBe('email')
    for (const label of ['Nombre', 'Apellidos', 'Correo']) {
      expect(byLabel(w, label).attributes('autocomplete')).toBe('off')
    }
  })

  it('la comisión es texto decimal (teclado numérico) con una pista del formato', () => {
    const w = mountForm()
    const commission = byLabel(w, 'Comisión (%)')
    expect(commission.attributes('inputmode')).toBe('decimal')
    expect(w.text()).toContain('Déjalo vacío para usar la comisión general')
  })

  it('tiene botón de agregar (submit) y de cancelar (no envía)', () => {
    const w = mountForm()
    expect(w.get('button[type="submit"]').text()).toBe('Agregar persona')
    const cancel = w.findAll('button').find((b) => b.text() === 'Cancelar')!
    expect(cancel.attributes('type')).toBe('button')
  })

  it('cancelar emite cancel y no envía', async () => {
    const w = mountForm()
    await w.findAll('button').find((b) => b.text() === 'Cancelar')!.trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
    expect(w.emitted('submit')).toBeUndefined()
  })
})

describe('MemberCreateForm — validación de cliente', () => {
  it('vacío: no envía y dice qué falta', async () => {
    const w = mountForm()
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
    expect(errors(w)).toEqual(['Escribe el nombre.', 'Escribe los apellidos.', 'Escribe el correo.'])
  })

  it('solo espacios cuenta como vacío', async () => {
    const w = mountForm()
    await fillBasics(w, { nombre: '   ', apellidos: '  ', correo: '  ' })
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
  })

  it.each(['ana', 'ana@', '@example.com', 'ana@example', 'ana example@x.com', 'ana@@x.com'])('correo inválido %j: no envía', async (correo) => {
    const w = mountForm()
    await fillBasics(w, { correo })
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
    expect(errors(w)).toEqual(['Escribe un correo válido, por ejemplo nombre@dominio.com'])
  })

  it('un correo de más de 254 caracteres no se acepta', async () => {
    const w = mountForm()
    await fillBasics(w, { correo: `${'a'.repeat(250)}@example.com` })
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
  })

  it('nombre o apellidos de más de 100 caracteres: no envía y dice el límite', async () => {
    const w = mountForm()
    await fillBasics(w, { nombre: 'a'.repeat(101), apellidos: 'b'.repeat(101) })
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
    expect(errors(w)).toEqual([
      'El nombre es demasiado largo (máximo 100 caracteres).',
      'Los apellidos son demasiado largos (máximo 100 caracteres).',
    ])
  })

  it('exactamente 100 caracteres es válido', async () => {
    const w = mountForm()
    await fillBasics(w, { nombre: 'a'.repeat(100), apellidos: 'b'.repeat(100) })
    await submit(w)
    expect(w.emitted('submit')).toHaveLength(1)
  })

  it.each(['abc', '100.5', '101', '-5', '10,5', '10.555', '1e2'])('comisión inválida %j: no envía y da un ejemplo', async (text) => {
    const w = mountForm()
    await fillBasics(w)
    await byLabel(w, 'Comisión (%)').setValue(text)
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
    expect(errors(w)).toEqual(['Escribe un porcentaje entre 0 y 100, con hasta 2 decimales. Ejemplo: 10 o 12.5.'])
  })

  it('los campos con error quedan marcados como inválidos y apuntan a su mensaje', async () => {
    const w = mountForm()
    await submit(w)
    for (const label of ['Nombre', 'Apellidos', 'Correo']) {
      const field = byLabel(w, label)
      expect(field.attributes('aria-invalid')).toBe('true')
      expect(field.attributes('aria-describedby')).toContain(`${field.attributes('id')}-error`)
    }
  })
})

describe('MemberCreateForm — lo que se envía', () => {
  it('colaborador con comisión: convierte el porcentaje a puntos base exactos', async () => {
    const w = mountForm()
    await fillBasics(w)
    await byLabel(w, 'Comisión (%)').setValue('10.5')
    await submit(w)
    expect(w.emitted('submit')).toEqual([[{
      nombre: 'Carlos', apellidos: 'Núñez', correo: 'carlos@example.com', role: 'colaborador', commissionRateBps: 1050,
    }]])
  })

  it('colaborador sin comisión: el campo commissionRateBps NO viaja (usa la comisión general)', async () => {
    const w = mountForm()
    await fillBasics(w)
    await submit(w)
    const payload = w.emitted('submit')![0][0] as Record<string, unknown>
    expect('commissionRateBps' in payload).toBe(false)
    expect(payload.role).toBe('colaborador')
  })

  it('comisión 0 es válida y viaja como 0', async () => {
    const w = mountForm()
    await fillBasics(w)
    await byLabel(w, 'Comisión (%)').setValue('0')
    await submit(w)
    expect((w.emitted('submit')![0][0] as { commissionRateBps: number }).commissionRateBps).toBe(0)
  })

  it('recorta espacios de nombre, apellidos y correo', async () => {
    const w = mountForm()
    await fillBasics(w, { nombre: '  Carlos ', apellidos: ' Núñez  ', correo: '  carlos@example.com  ' })
    await submit(w)
    expect(w.emitted('submit')![0][0]).toMatchObject({ nombre: 'Carlos', apellidos: 'Núñez', correo: 'carlos@example.com' })
  })

  it('socio: no hay campo de comisión y nunca viaja commissionRateBps', async () => {
    const w = mountForm()
    await byLabel(w, 'Rol').setValue('socio')
    expect(w.findAll('label').map((l) => l.text())).not.toContain('Comisión (%)')
    await fillBasics(w)
    await submit(w)
    const payload = w.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload.role).toBe('socio')
    expect('commissionRateBps' in payload).toBe(false)
  })

  it('si escribió una comisión y cambia a socio, se descarta: ni se ve ni se envía, y al volver está vacía', async () => {
    const w = mountForm()
    await byLabel(w, 'Comisión (%)').setValue('12')
    await byLabel(w, 'Rol').setValue('socio')
    await fillBasics(w)
    await submit(w)
    expect('commissionRateBps' in (w.emitted('submit')![0][0] as object)).toBe(false)

    await byLabel(w, 'Rol').setValue('colaborador')
    expect((byLabel(w, 'Comisión (%)').element as HTMLInputElement).value).toBe('')
  })

  it('una comisión inválida escrita antes de cambiar a socio no bloquea el envío', async () => {
    const w = mountForm()
    await byLabel(w, 'Comisión (%)').setValue('abc')
    await byLabel(w, 'Rol').setValue('socio')
    await fillBasics(w)
    await submit(w)
    expect(w.emitted('submit')).toHaveLength(1)
  })
})

describe('MemberCreateForm — carga y errores del servidor', () => {
  it('con loading: campos y botones deshabilitados y no vuelve a enviar', async () => {
    const w = mountForm({ loading: true })
    expect(w.findAll('input, select').every((f) => f.attributes('disabled') !== undefined)).toBe(true)
    expect(w.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await fillBasics(w)
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
  })

  it('serverErrors se muestran bajo cada campo', () => {
    const w = mountForm({ serverErrors: { correo: 'Correo malo', nombre: 'Nombre malo', apellidos: 'Apellidos malos', commission: 'Comisión mala' } })
    expect(errors(w)).toEqual(['Nombre malo', 'Apellidos malos', 'Correo malo', 'Comisión mala'])
  })

  it('serverErrors de comisión no se ven si el rol es socio', async () => {
    const w = mountForm({ serverErrors: { commission: 'Comisión mala' } })
    await byLabel(w, 'Rol').setValue('socio')
    expect(errors(w)).toEqual([])
  })

  it('error general en una alerta, con el formulario editable para reintentar', () => {
    const w = mountForm({ error: 'No pudimos conectarnos.' })
    expect(w.get('[role="alert"]').text()).toContain('No pudimos conectarnos.')
    expect(w.findAll('input, select').every((f) => f.attributes('disabled') === undefined)).toBe(true)
  })
})
