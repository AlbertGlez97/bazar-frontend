import { describe, expect, it } from 'vitest'
import { ARCO, LEGAL_CONTACT_EMAIL, LEGAL_JURISDICTION, LEGAL_RESPONSIBLE, RETENTION } from '../legal-config'
import { PRIVACY_NOTICE } from '../privacy-notice'
import { TERMS } from '../terms'
import { documentSentences, documentText } from '../text'
import type { LegalDocumentData } from '../types'

const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const privacy = plain(documentText(PRIVACY_NOTICE))
const terms = plain(documentText(TERMS))
/** Texto (sin acentos ni mayúsculas) de UNA sección: el resumen de arriba no cuenta. */
const sectionText = (id: string, doc: LegalDocumentData = PRIVACY_NOTICE) =>
  plain(documentText({ ...doc, title: '', summary: [], sections: doc.sections.filter((section) => section.id === id) }))
const docs: [string, LegalDocumentData][] = [['aviso de privacidad', PRIVACY_NOTICE], ['términos', TERMS]]
// Lo que el aviso dice que se RECABA (solo esa sección: una frase suelta en otra parte no cuenta)
const collected = sectionText('que-datos-recabamos')

describe.each(docs)('estructura: %s', (_name, doc) => {
  it('trae un resumen de exactamente 5 puntos', () => {
    expect(doc.summary).toHaveLength(5)
    for (const point of doc.summary) expect(point.trim().length).toBeGreaterThan(10)
  })

  it('las secciones tienen id único, título y contenido', () => {
    const ids = doc.sections.map((section) => section.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const section of doc.sections) {
      expect(section.id).toMatch(/^[a-z0-9-]+$/)
      expect(section.title.trim()).not.toBe('')
      expect(section.blocks.length).toBeGreaterThan(0)
    }
  })

  it('frases de 20 palabras o menos (lenguaje claro)', () => {
    for (const sentence of documentSentences(doc)) {
      expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(20)
    }
  })

  it('no afirma revisión de abogado, certificaciones ni garantías de seguridad', () => {
    const text = documentText(doc)
    expect(text).not.toMatch(/certificad|iso\s?27001|auditor/i)
    expect(text).not.toMatch(/revis(ó|o|ado|ados|ada)\s+(por\s+)?(un\s+)?abogad/i)
    expect(text).not.toMatch(/100\s?%|totalmente seguro|inviolable|infalible|garantizamos la seguridad/i)
    expect(text).not.toMatch(/provisional|borrador/i)
  })

  it('los plazos que dice el texto salen de las constantes (ningún número de días sobra)', () => {
    const allowed = new Set<number>([
      RETENTION.unconfirmedRegistrationDays,
      RETENTION.rejectedOrExpiredRegistrationDays,
      ARCO.responseDays,
      ARCO.effectDays,
    ])
    const days = [...documentText(doc).matchAll(/(\d+)\s+días/g)].map((m) => Number(m[1]))
    for (const n of days) expect(allowed.has(n), `${n} días no está en la configuración`).toBe(true)
  })
})

describe('Aviso de Privacidad: contenido mínimo', () => {
  it('dice quién es el responsable: nombre, domicilio y correo, tomados de la configuración', () => {
    expect(privacy).toContain(plain(LEGAL_RESPONSIBLE.name))
    expect(privacy).toContain(plain(LEGAL_RESPONSIBLE.address))
    expect(privacy).toContain(plain(LEGAL_CONTACT_EMAIL))
    expect(privacy).toContain('persona fisica')
  })

  it.each([
    ['nombre del negocio', /nombre del negocio/],
    ['tipo de negocio', /tipo de negocio/],
    ['qué vende', /que vende/],
    ['dónde vende', /donde vende/],
    ['nombre y apellidos', /nombre y apellidos/],
    ['correo', /correo/],
    ['confirmado con un enlace', /confirm\w+ con un enlace/],
    ['teléfono o WhatsApp', /telefono o whatsapp/],
    ['quién lo recomendó', /recomend/],
    ['aceptación con fecha y versión', /fecha y (la )?version/],
    ['nombre, correo y rol de cada persona', /rol/],
    ['identificadores de dispositivo', /identificadores? de (tus )?dispositivos?/],
    ['actividad de venta: quién vendió qué y cuándo', /quien vendio que y cuando/],
    ['productos, costos, ventas y deudas', /productos, costos, ventas y deudas/],
    ['nombre, teléfono y notas de deudores', /nombre, telefono y notas/],
  ])('cubre el dato: %s', (_label, pattern) => {
    expect(collected).toMatch(pattern)
  })

  it('aclara que NO se piden datos sensibles y pide no escribirlos en las notas', () => {
    expect(collected).toMatch(/no pedimos datos sensibles/)
    expect(collected).toMatch(/no los escribas|no escribas/)
    expect(collected).toContain('notas')
  })

  it('separa finalidades necesarias y voluntarias en dos listas', () => {
    const titles = PRIVACY_NOTICE.sections.flatMap((s) => s.blocks).filter((b) => b.kind === 'h3').map((b) => plain((b as { text: string }).text))
    expect(titles).toContain('finalidades necesarias')
    expect(titles).toContain('finalidades voluntarias')
    const idx = PRIVACY_NOTICE.sections.find((s) => s.id === 'para-que-usamos-tus-datos')!.blocks
    expect(idx.filter((b) => b.kind === 'list')).toHaveLength(2)
  })

  it('dice con quién se comparte y nombra a los proveedores técnicos reales', () => {
    expect(privacy).toContain('resend')
    expect(privacy).toContain('cloudflare')
    expect(privacy).toContain('google fonts')
    expect(privacy).toMatch(/no vendemos/)
  })

  it('explica cómo limitar el uso de los datos', () => {
    expect(PRIVACY_NOTICE.sections.map((s) => s.id)).toContain('limitar-el-uso')
  })

  it('explica los derechos ARCO, cómo ejercerlos, qué incluir y los plazos de la ley', () => {
    const arco = sectionText('derechos-arco')
    for (const right of ['acceso', 'rectificacion', 'cancelacion', 'oposicion']) expect(arco).toContain(right)
    expect(arco).toContain(plain(LEGAL_CONTACT_EMAIL))
    expect(arco).toContain(`${ARCO.responseDays} dias`)
    expect(arco).toContain(`${ARCO.effectDays} dias`)
    expect(arco).toMatch(/que incluir|incluye en tu mensaje/)
    expect(arco).toContain('gratis')
  })

  it('explica la revocación del consentimiento', () => {
    expect(PRIVACY_NOTICE.sections.map((s) => s.id)).toContain('revocar-tu-consentimiento')
    expect(privacy).toMatch(/revocar/)
  })

  it('los plazos de conservación salen de la configuración', () => {
    const retention = sectionText('cuanto-tiempo-guardamos-tus-datos')
    expect(retention).toContain(`${RETENTION.unconfirmedRegistrationDays} dias`)
    expect(retention).toContain(`${RETENTION.rejectedOrExpiredRegistrationDays} dias`)
    expect(retention).toMatch(/mientras (la cuenta )?este activa/)
    expect(retention).toMatch(/eliminamos|anonimizamos/)
    expect(retention).toMatch(/ley/)
  })

  it('describe la seguridad con honestidad: lo que hay y lo que no se promete', () => {
    const security = sectionText('como-cuidamos-tus-datos')
    expect(security).toMatch(/argon2|no guardamos tu contrasena/)
    expect(security).toMatch(/https/)
    expect(security).toMatch(/cada negocio|entre negocios/)
    expect(security).toMatch(/ningun sistema es totalmente seguro|no podemos prometer/)
  })

  it('explica el almacenamiento del navegador: localStorage, IndexedDB y cookies (ya no guarda la persona en sessionStorage)', () => {
    const storage = sectionText('almacenamiento-del-navegador')
    for (const word of ['localstorage', 'indexeddb', 'cookies', 'sin conexion']) expect(storage).toContain(word)
    expect(storage).not.toContain('sessionstorage')
  })

  it('explica los cambios al aviso: fecha, versión y nuevo consentimiento si cambian las finalidades', () => {
    const changes = sectionText('cambios-al-aviso')
    expect(changes).toContain('version')
    expect(changes).toContain('fecha')
    expect(changes).toMatch(/finalidades/)
    expect(changes).toMatch(/consentimiento/)
  })

  it('indica la autoridad competente', () => {
    expect(privacy).toContain('secretaria anticorrupcion y buen gobierno')
  })

  it('tiene la sección "Datos de tus clientes": el negocio es el responsable y La Marchanta procesa por su cuenta', () => {
    const section = PRIVACY_NOTICE.sections.find((s) => s.id === 'datos-de-tus-clientes')
    expect(section).toBeDefined()
    const text = sectionText('datos-de-tus-clientes')
    expect(text).toMatch(/tu negocio es (el )?responsable/)
    expect(text).toMatch(/por su cuenta|por cuenta de tu negocio/)
    expect(text).toMatch(/fiado|apartado/)
    expect(text).toContain('deudor')
  })
})

describe('Términos y Condiciones: contenido mínimo', () => {
  it.each([
    ['qué es el servicio y que está en piloto', /piloto/],
    ['quién puede registrarse y datos veraces', /veraces/],
    ['aprobación manual y derecho a rechazar', /aprobacion manual[\s\S]*rechazar/],
    ['contraseña temporal que se cambia', /contrasena temporal/],
    ['uso aceptable', /uso aceptable|no puedes/],
    ['los datos del negocio son del negocio', /son de tu negocio|son tuyos/],
    ['responsabilidad sobre los datos de sus clientes', /datos de tus clientes/],
    ['sin garantía de servicio continuo', /no garantizamos[\s\S]*continu/],
    ['respaldos sin garantía', /respaldos/],
    ['limitación de responsabilidad', /limitacion de responsabilidad|no somos responsables/],
    ['propiedad del software y la marca', /propiedad[\s\S]*marca/],
    ['suspensión y cierre de cuenta', /suspender|cerrar tu cuenta|cierre/],
    ['cambios a los términos', /cambios a estos terminos/],
  ])('cubre: %s', (_label, pattern) => {
    expect(terms).toMatch(pattern)
  })

  it('la ley aplicable y la jurisdicción salen de la configuración', () => {
    expect(terms).toContain(plain(LEGAL_JURISDICTION))
  })

  it('remite al aviso de privacidad', () => {
    expect(terms).toContain('aviso de privacidad')
  })

  it('el contacto es el correo de la configuración', () => {
    expect(terms).toContain(plain(LEGAL_CONTACT_EMAIL))
  })

  it('dice quién es el responsable del servicio', () => {
    expect(terms).toContain(plain(LEGAL_RESPONSIBLE.name))
  })

  it('las secciones piden que el negocio responda por los datos que captura de otras personas', () => {
    const section = TERMS.sections.find((s) => s.id === 'datos-de-tus-clientes')
    expect(section).toBeDefined()
  })
})
