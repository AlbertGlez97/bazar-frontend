import { describe, it, expect } from 'vitest'
import {
  BUSINESS_TYPE_OPTIONS,
  businessRegistrationSchema,
  isValidMxPhone,
  normalizeMxPhone,
} from '@/validation/business-registration.schema'

const valid = {
  nombreNegocio: 'Abarrotes Los Pinos',
  tipoNegocio: 'abarrotes',
  queVende: 'Abarrotes, dulces y refrescos',
  dondeVende: '',
  recomendadoPor: '',
  nombre: 'Ana',
  apellidos: 'Pérez Soto',
  correo: 'ana@example.com',
  telefono: '55 1234 5678',
  aceptaLegal: true,
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

describe('normalizeMxPhone: lo que se manda al servidor son 10 dígitos', () => {
  it.each([
    ['5512345678', '5512345678'],
    ['55 1234 5678', '5512345678'],
    ['55-1234-5678', '5512345678'],
    ['(55) 1234-5678', '5512345678'],
    ['55.1234.5678', '5512345678'],
    ['+52 55 1234 5678', '5512345678'],
    ['52 55 1234 5678', '5512345678'],
    ['+52 1 55 1234 5678', '5512345678'],
    ['  656 123 4567 ', '6561234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeMxPhone(input)).toBe(expected)
  })

  it('un número que empieza con 52 pero es de 10 dígitos no se recorta', () => {
    // clave de área 52 no existe, pero 5212345678 (10 dígitos) no debe perder dígitos
    expect(normalizeMxPhone('5212345678')).toBe('5212345678')
  })
})

describe('businessRegistrationSchema', () => {
  it('acepta un formulario completo válido; lo opcional en blanco sale ausente y el teléfono sale a 10 dígitos', () => {
    expect(businessRegistrationSchema.parse(valid)).toEqual({
      nombreNegocio: 'Abarrotes Los Pinos',
      tipoNegocio: 'abarrotes',
      queVende: 'Abarrotes, dulces y refrescos',
      dondeVende: undefined,
      recomendadoPor: undefined,
      nombre: 'Ana',
      apellidos: 'Pérez Soto',
      correo: 'ana@example.com',
      telefono: '5512345678',
      aceptaLegal: true,
    })
  })

  it('el tipo de negocio es una lista de ocho opciones con etiqueta en español', () => {
    expect(BUSINESS_TYPE_OPTIONS.map((o) => o.value)).toEqual([
      'bazar_o_tianguis',
      'abarrotes',
      'ropa_y_accesorios',
      'comida_y_bebidas',
      'plantas_y_jardineria',
      'artesanias',
      'servicios',
      'otro',
    ])
    expect(BUSINESS_TYPE_OPTIONS.every((o) => o.label.length > 2)).toBe(true)
  })

  it('el tipo de negocio es obligatorio y solo acepta valores de la lista', () => {
    expect(firstError({ tipoNegocio: '' }, 'tipoNegocio')).toBe('Elige el tipo de tu negocio.')
    expect(firstError({ tipoNegocio: 'banco' }, 'tipoNegocio')).toBe('Elige el tipo de tu negocio.')
    for (const option of BUSINESS_TYPE_OPTIONS) {
      expect(firstError({ tipoNegocio: option.value }, 'tipoNegocio')).toBeUndefined()
    }
  })

  it('"qué vendes" pide entre 10 y 400 caracteres', () => {
    expect(firstError({ queVende: '' }, 'queVende')).toBe('Cuéntanos qué vendes.')
    expect(firstError({ queVende: 'Ropa' }, 'queVende')).toBe('Cuéntanos un poco más: escribe al menos 10 letras.')
    expect(firstError({ queVende: 'x'.repeat(401) }, 'queVende')).toBe('Es muy largo: máximo 400 caracteres.')
    expect(firstError({ queVende: 'x'.repeat(10) }, 'queVende')).toBeUndefined()
    expect(firstError({ queVende: 'x'.repeat(400) }, 'queVende')).toBeUndefined()
    expect(firstError({ queVende: '   corto   ' }, 'queVende')).toBe('Cuéntanos un poco más: escribe al menos 10 letras.')
  })

  it('"dónde vendes" y "quién te recomendó" son opcionales y tienen tope', () => {
    expect(firstError({ dondeVende: '' }, 'dondeVende')).toBeUndefined()
    expect(firstError({ dondeVende: '   ' }, 'dondeVende')).toBeUndefined()
    expect(businessRegistrationSchema.parse({ ...valid, dondeVende: '   ' }).dondeVende).toBeUndefined()
    expect(businessRegistrationSchema.parse({ ...valid, dondeVende: ' Tianguis ' }).dondeVende).toBe('Tianguis')
    expect(firstError({ dondeVende: 'x'.repeat(201) }, 'dondeVende')).toBe('Es muy largo: máximo 200 caracteres.')
    expect(firstError({ dondeVende: 'x'.repeat(200) }, 'dondeVende')).toBeUndefined()
    expect(firstError({ recomendadoPor: 'x'.repeat(121) }, 'recomendadoPor')).toBe('Es muy largo: máximo 120 caracteres.')
    expect(firstError({ recomendadoPor: 'x'.repeat(120) }, 'recomendadoPor')).toBeUndefined()
    expect(businessRegistrationSchema.parse({ ...valid, recomendadoPor: '  ' }).recomendadoPor).toBeUndefined()
  })

  it('el teléfono (WhatsApp) es obligatorio', () => {
    expect(firstError({ telefono: '' }, 'telefono')).toBe('Escribe tu número de WhatsApp.')
    expect(firstError({ telefono: '    ' }, 'telefono')).toBe('Escribe tu número de WhatsApp.')
  })

  it('un teléfono con formato incorrecto da su propio mensaje', () => {
    expect(firstError({ telefono: '12345' }, 'telefono')).toBe(
      'Escribe un número de 10 dígitos, por ejemplo 55 1234 5678.',
    )
  })

  it('un teléfono con separadores sale normalizado a 10 dígitos', () => {
    expect(businessRegistrationSchema.parse({ ...valid, telefono: '  +52 (55) 1234-5678 ' }).telefono).toBe('5512345678')
  })

  it('la casilla del aviso y los términos es obligatoria', () => {
    expect(firstError({ aceptaLegal: false }, 'aceptaLegal')).toBe(
      'Para continuar, acepta el Aviso de privacidad y los Términos.',
    )
    expect(firstError({ aceptaLegal: undefined }, 'aceptaLegal')).toBe(
      'Para continuar, acepta el Aviso de privacidad y los Términos.',
    )
    expect(firstError({ aceptaLegal: true }, 'aceptaLegal')).toBeUndefined()
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
