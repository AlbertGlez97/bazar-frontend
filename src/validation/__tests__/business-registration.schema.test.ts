import { describe, it, expect } from 'vitest'
import {
  businessRegistrationSchema,
  isValidMxPhone,
} from '@/validation/business-registration.schema'

const valid = {
  nombreNegocio: 'Abarrotes Los Pinos',
  nombre: 'Ana',
  apellidos: 'Pérez Soto',
  correo: 'ana@example.com',
  telefono: '',
}

/** Primer mensaje de error de un campo, o undefined si el campo es válido. */
function firstError(input: Record<string, unknown>, field: string): string | undefined {
  const result = businessRegistrationSchema.safeParse({ ...valid, ...input })
  if (result.success) return undefined
  return result.error.issues.find((i) => i.path[0] === field)?.message
}

describe('isValidMxPhone (plan de numeración mexicano, 10 dígitos)', () => {
  it.each([
    '5512345678',
    '55 1234 5678',
    '(55) 1234-5678',
    '55.1234.5678',
    '+52 55 1234 5678',
    '+525512345678',
    '52 55 1234 5678',
    '+52 1 55 1234 5678', // prefijo móvil heredado, aún se ve en la práctica
    '3312345678',
    '656 123 4567', // clave de 3 dígitos
    '2221234567',
  ])('acepta %s', (phone) => {
    expect(isValidMxPhone(phone)).toBe(true)
  })

  it.each([
    ['9 dígitos', '551234567'],
    ['11 dígitos sin prefijo 52', '55123456789'],
    ['letras', '55 1234 abcd'],
    ['clave que empieza con 0', '0551234567'],
    ['clave que empieza con 1', '1551234567'],
    ['número de EE. UU. (+1)', '+1 555 123 4567'],
    ['vacío', ''],
    ['solo símbolos', '()-'],
    ['con extensión', '5512345678 ext 12'],
  ])('rechaza %s', (_label, phone) => {
    expect(isValidMxPhone(phone)).toBe(false)
  })
})

describe('businessRegistrationSchema', () => {
  it('acepta un formulario completo válido y devuelve el teléfono ausente cuando está en blanco', () => {
    const parsed = businessRegistrationSchema.parse(valid)
    expect(parsed).toEqual({
      nombreNegocio: 'Abarrotes Los Pinos',
      nombre: 'Ana',
      apellidos: 'Pérez Soto',
      correo: 'ana@example.com',
      telefono: undefined,
    })
  })

  it('el teléfono es opcional: vacío o solo espacios es válido', () => {
    expect(firstError({ telefono: '' }, 'telefono')).toBeUndefined()
    expect(firstError({ telefono: '    ' }, 'telefono')).toBeUndefined()
    expect(businessRegistrationSchema.parse({ ...valid, telefono: '   ' }).telefono).toBeUndefined()
  })

  it('un teléfono lleno se conserva tal como lo escribió la persona, recortado', () => {
    expect(businessRegistrationSchema.parse({ ...valid, telefono: '  55 1234 5678 ' }).telefono).toBe('55 1234 5678')
  })

  it('un teléfono lleno con formato incorrecto da su propio mensaje', () => {
    expect(firstError({ telefono: '12345' }, 'telefono')).toBe(
      'Escribe un teléfono de 10 dígitos, por ejemplo 55 1234 5678.',
    )
  })

  it.each([
    ['nombreNegocio', '', 'Escribe el nombre de tu negocio.'],
    ['nombreNegocio', '   ', 'Escribe el nombre de tu negocio.'],
    ['nombreNegocio', 'x'.repeat(201), 'El nombre del negocio es muy largo (máximo 200 caracteres).'],
    ['nombre', '', 'Escribe tu nombre.'],
    ['nombre', 'A', 'Tu nombre debe tener al menos 2 letras.'],
    ['nombre', 'x'.repeat(101), 'Tu nombre es muy largo (máximo 100 caracteres).'],
    ['apellidos', '', 'Escribe tus apellidos.'],
    ['apellidos', 'P', 'Tus apellidos deben tener al menos 2 letras.'],
    ['apellidos', 'x'.repeat(101), 'Tus apellidos son muy largos (máximo 100 caracteres).'],
    ['correo', '', 'Escribe tu correo.'],
    ['correo', 'ana', 'Ese correo no se ve bien. Revisa que tenga la forma nombre@dominio.com.'],
    ['correo', 'ana@', 'Ese correo no se ve bien. Revisa que tenga la forma nombre@dominio.com.'],
    ['correo', 'ana@example', 'Ese correo no se ve bien. Revisa que tenga la forma nombre@dominio.com.'],
    ['correo', `${'a'.repeat(250)}@example.com`, 'Ese correo es muy largo (máximo 254 caracteres).'],
  ])('%s = %j → "%s"', (field, value, message) => {
    expect(firstError({ [field]: value }, field)).toBe(message)
  })

  it('recorta espacios y pasa el correo a minúsculas', () => {
    const parsed = businessRegistrationSchema.parse({
      ...valid,
      nombreNegocio: '  Abarrotes Los Pinos  ',
      nombre: '  Ana ',
      apellidos: ' Pérez Soto  ',
      correo: '  Ana@Example.COM ',
    })
    expect(parsed).toMatchObject({
      nombreNegocio: 'Abarrotes Los Pinos',
      nombre: 'Ana',
      apellidos: 'Pérez Soto',
      correo: 'ana@example.com',
    })
  })

  it('respeta los límites del contrato justo en el borde', () => {
    expect(firstError({ nombreNegocio: 'x'.repeat(200) }, 'nombreNegocio')).toBeUndefined()
    expect(firstError({ nombre: 'x'.repeat(100) }, 'nombre')).toBeUndefined()
    expect(firstError({ apellidos: 'x'.repeat(100) }, 'apellidos')).toBeUndefined()
    expect(firstError({ correo: `${'a'.repeat(242)}@example.com` }, 'correo')).toBeUndefined() // 254 en total
  })
})
