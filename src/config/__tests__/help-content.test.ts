import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { HELP_ARTICLES, HELP_EVIDENCE, CASH_HELP } from '../help-content'

describe('audited help content', () => {
  it('opens debt detail before checking product/type and names audited administrative controls', () => {
    const steps = (id: string) => HELP_ARTICLES.find((article) => article.id === id)!.steps.join(' ')
    const debt = steps('abonos')
    expect(debt).toMatch(/abre su detalle[^.]*\. Verifica el nombre del deudor, producto y tipo/)
    expect(debt).not.toContain('antes de abrir su detalle')
    expect(debt).toContain('Monto del abono')
    expect(debt).toContain('Registrar abono')
    expect(steps('equipo')).toContain('Agregar persona')
    expect(steps('dispositivos')).toContain('Registrar dispositivo')
    expect(steps('dispositivos')).toContain('Reemitir código')
  })
  it('does not invent report filters, retry buttons or optional creation cost', () => {
    const article = (id: string) => HELP_ARTICLES.find((item) => item.id === id)!
    expect(article('crear-producto').steps.join(' ')).toContain('Costo de compra')
    expect(article('crear-producto').steps.join(' ')).toContain('obligatorio')
    expect(article('reportes').steps.join(' ')).toContain('Por persona')
    expect(article('reportes').steps.join(' ')).not.toContain('filtros disponibles de personas')
    expect(article('sin-conexion').steps.join(' ')).not.toContain('Reintentar')
    expect(article('sin-conexion').steps.join(' ')).toContain('Entendido')
    expect(CASH_HELP.tips.join(' ')).toContain('$430')
    expect(CASH_HELP.tips.join(' ')).toContain('$70')
    expect(article('preguntas').questions?.length).toBeGreaterThan(2)
  })
  it('covers administrative workflows with socio boundaries and current limitations', () => {
    const expected = ['crear-producto', 'editar-producto', 'fotos', 'imprimir-qr', 'crear-deuda', 'abonos', 'calendario', 'incidencias', 'reportes', 'equipo', 'dispositivos', 'contrasena', 'instalar', 'preguntas']
    expect(HELP_ARTICLES.map((article) => article.id)).toEqual(expect.arrayContaining(expected))
    const debt = HELP_ARTICLES.find((article) => article.id === 'crear-deuda')!
    expect(debt.audience).toBe('socio')
    expect(debt.steps.join(' ')).toContain('0')
    expect(debt.tips.join(' ')).toContain('efectivo')
    expect(HELP_ARTICLES.find((article) => article.id === 'editar-producto')?.tips.join(' ')).toContain('existencia')
    expect(HELP_ARTICLES.find((article) => article.id === 'reportes')?.tips.join(' ')).toContain('contado')
  })
  it('provides stable unique articles with useful steps and evidence kept outside reader copy', () => {
    const ids = HELP_ARTICLES.map((article) => article.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const article of HELP_ARTICLES) {
      expect(article.questions?.length ?? article.steps.length).toBeGreaterThanOrEqual(3)
      expect(article.title).toBeTruthy()
      expect(article.intro).toBeTruthy()
      expect(article).not.toHaveProperty('evidence')
      expect(HELP_EVIDENCE[article.id]?.length).toBeGreaterThan(0)
      for (const path of HELP_EVIDENCE[article.id] ?? []) expect(existsSync(path)).toBe(true)
    }
  })

  it('covers getting started, first sale, quantities, cash, scanner and offline uncertainty', () => {
    expect(HELP_ARTICLES.map((article) => article.id)).toEqual(expect.arrayContaining([
      'acceso', 'modos', 'primera-venta', 'carrito', 'efectivo', 'escanear', 'sin-conexion',
    ]))
    expect(CASH_HELP.steps.join(' ')).toContain('su propia selección')
    expect(CASH_HELP.tips.join(' ')).toContain('1,250.50')
    expect(HELP_ARTICLES.find((article) => article.id === 'sin-conexion')?.tips.join(' ')).toContain('no confirma')
  })

  it('explains expenses in plain language, limited to what the Gastos screen does', () => {
    const gastos = HELP_ARTICLES.find((article) => article.id === 'gastos')!
    const fix = HELP_ARTICLES.find((article) => article.id === 'corregir-gasto')!
    for (const article of [gastos, fix]) {
      expect(article.category).toBe('Finanzas')
      expect(article.audience).toBe('socio')
    }
    const text = [gastos.intro, ...gastos.steps, ...gastos.tips].join(' ')
    expect(text).toContain('Gasto operativo')
    expect(text).toContain('Compra de inventario')
    expect(text).toContain('Origen del dinero')
    expect(gastos.tips.join(' ')).toContain('no convierte el gasto en una aportación automáticamente')
    expect(gastos.tips.join(' ')).toContain('no cambia tus productos')
    expect([fix.intro, ...fix.steps, ...fix.tips].join(' ')).toMatch(/Anular[\s\S]*Corregir/)
    expect(fix.tips.join(' ')).toContain('no mueve dinero ni inventario')
  })

  it('explains work shifts in plain language without money, and states that correcting is not available', () => {
    const guide = HELP_ARTICLES.find((article) => article.id === 'jornadas')!
    const faq = HELP_ARTICLES.find((article) => article.id === 'jornadas-preguntas')!
    for (const article of [guide, faq]) {
      expect(article.category).toBe('Finanzas')
      expect(article.audience).toBe('socio')
    }
    const steps = guide.steps.join(' ')
    for (const label of ['Jornadas', 'Quién trabajó', 'Fecha', 'Horas', 'Minutos', 'Nota', 'Registrar jornada'])
      expect(steps).toContain(label)
    expect(steps).toContain('deja los dos campos vacíos')
    expect(guide.intro).toContain('no es una venta ni un pago')
    expect(guide.tips.join(' ')).toContain('todavía no está disponible')
    const answers = Object.fromEntries((faq.questions ?? []).map((q) => [q.question, q.answer]))
    expect(Object.keys(answers)).toEqual(expect.arrayContaining([
      '¿Por qué puedo registrar una jornada sin horas?',
      '¿Una jornada es lo mismo que una venta?',
      '¿Registrar una jornada genera un pago?',
    ]))
    expect(answers['¿Por qué puedo registrar una jornada sin horas?']).toContain('Duración no registrada')
    expect(answers['¿Por qué puedo registrar una jornada sin horas?']).toContain('no se guarda como cero horas')
    expect(answers['¿Registrar una jornada genera un pago?']).toMatch(/^No\./)
    expect(answers['¿Puedo corregir o anular una jornada?']).toMatch(/^Todavía no/)
    // Not a payment feature: no amounts, percentages or distribution wording as capabilities.
    const text = JSON.stringify([guide, faq])
    expect(text).not.toMatch(/\$\d|%|comisi[oó]n|reparto|sueldo|salario|lo que te toca/i)
  })
  it('explains the finance overview in plain language without promising cash or distribution', () => {
    const guide = HELP_ARTICLES.find((article) => article.id === 'resumen-finanzas')!
    const faq = HELP_ARTICLES.find((article) => article.id === 'resumen-preguntas')!
    for (const article of [guide, faq]) {
      expect(article.category).toBe('Finanzas')
      expect(article.audience).toBe('socio')
    }
    const steps = guide.steps.join(' ')
    for (const label of ['Resumen', 'Resultado operativo registrado', 'Compras de inventario', 'Capital aportado registrado', 'Cobertura de costos', 'Última actualización'])
      expect(steps).toContain(label)
    const answers = Object.fromEntries((faq.questions ?? []).map((q) => [q.question, q.answer]))
    expect(Object.keys(answers)).toEqual([
      '¿Qué es el resultado operativo?',
      '¿Qué diferencia hay entre margen y resultado operativo?',
      '¿Qué son las compras de inventario?',
      '¿Qué es una reserva?',
      '¿Por qué mi reserva no aparece en este período?',
      '¿Qué es el monto potencialmente disponible?',
      '¿Por qué no es efectivo disponible?',
      '¿Por qué una aportación no es ingreso?',
    ])
    expect(answers['¿Qué es una reserva?']).toContain('solo un plan')
    expect(answers['¿Qué es una reserva?']).toContain('exactamente el mismo')
    expect(answers['¿Por qué mi reserva no aparece en este período?']).toContain('período exacto')
    expect(answers['¿Por qué mi reserva no aparece en este período?']).toContain('No cuentan en este período')
    expect(JSON.stringify([guide, faq])).not.toMatch(/llegará después|próximamente|todavía no se pueden/i)
    expect(guide.tips.join(' ')).toContain('pestaña Reservas')
    expect(answers['¿Por qué no es efectivo disponible?']).toContain('no representa necesariamente efectivo disponible')
    expect(answers['¿Por qué una aportación no es ingreso?']).toContain('no se suma al resultado operativo')
    expect(answers['¿Qué son las compras de inventario?']).toContain('no se suman a los gastos operativos')
    expect(JSON.stringify([guide, faq])).not.toMatch(/ganancia para repartir|reparto|comisi[oó]n|sueldo|salario|lo que te toca/i)
  })
  it('explains how to create and cancel reserves, the exact-period rule and that they are plans, not cash', () => {
    const guide = HELP_ARTICLES.find((article) => article.id === 'reservas-finanzas')!
    expect(guide.category).toBe('Finanzas')
    expect(guide.audience).toBe('socio')
    const steps = guide.steps.join(' ')
    for (const label of ['Reservas', 'Nueva reserva', 'Guardar reserva', 'Anular', 'Total reservas']) expect(steps).toContain(label)
    const answers = Object.fromEntries((guide.questions ?? []).map((q) => [q.question, q.answer]))
    expect(answers['¿Puedo editar una reserva?']).toMatch(/^No\. .*anula la reserva y crea una nueva/)
    expect(answers['¿Una reserva aparta dinero de la caja?']).toMatch(/^No\. /)
    expect(guide.tips.join(' ')).toContain('exactamente el mismo período')
    expect(guide.intro).toContain('no mueve dinero')
    expect(JSON.stringify(guide)).not.toMatch(/ganancia para repartir|reparto|comisi[oó]n|sueldo|salario|lo que te toca|porcentaje/i)
  })
})
