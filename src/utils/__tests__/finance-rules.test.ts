import { describe, expect, it } from 'vitest'
import {
  BASE_PRESETS,
  RULE_GUIDES,
  STATUS_TEXT,
  defaultRulesConfig,
  formatRuleDate,
  formatRuleDateTime,
  joinNames,
  parsePctText,
  rebalanceBase,
  rulesErrorMessage,
  rulesStateText,
  versionSummary,
} from '../finance-rules'
import type { ProfitBase, RulesOverview } from '@/types/finance-rules.types'

const total = (b: ProfitBase) => Math.round((b.partnerPct + b.capitalPct + b.workPct) * 100)

describe('parsePctText', () => {
  it.each([
    ['50', 50],
    ['  12.5 ', 12.5],
    ['12,5', 12.5],
    ['0', 0],
    ['100', 100],
    ['33.33', 33.33],
    ['7%', 7],
  ])('lee %j como %j', (text, value) => expect(parsePctText(text)).toBe(value))

  it.each(['', 'abc', '-1', '101', '12.345', '1e2', '5.5.5', '--3', '%'])('no entiende %j', (text) =>
    expect(parsePctText(text)).toBeNull(),
  )
})

describe('rebalanceBase: una división siempre suma 100', () => {
  const base = (partnerPct: number, capitalPct: number, workPct: number): ProfitBase => ({ partnerPct, capitalPct, workPct })

  it('al subir un campo, el resto se reparte en la misma proporción', () => {
    expect(rebalanceBase(base(50, 30, 20), 'partnerPct', 70)).toEqual(base(70, 18, 12))
  })

  it('con solo dos campos, el otro se completa solo', () => {
    expect(rebalanceBase(base(60, 40, 0), 'partnerPct', 25)).toEqual(base(25, 75, 0))
    expect(rebalanceBase(base(60, 40, 0), 'capitalPct', 10)).toEqual(base(90, 10, 0))
  })

  it('si los otros están en cero, el sobrante va al siguiente campo', () => {
    expect(rebalanceBase(base(100, 0, 0), 'partnerPct', 40)).toEqual(base(40, 60, 0))
    expect(rebalanceBase(base(0, 0, 100), 'workPct', 30)).toEqual(base(70, 0, 30))
  })

  it('en 100 los otros quedan en cero y en 0 se conserva la proporción', () => {
    expect(rebalanceBase(base(50, 30, 20), 'capitalPct', 100)).toEqual(base(0, 100, 0))
    expect(rebalanceBase(base(50, 30, 20), 'partnerPct', 0)).toEqual(base(0, 60, 40))
  })

  it('con decimales la suma es exacta y el residuo va al campo más grande', () => {
    const out = rebalanceBase(base(34, 33, 33), 'partnerPct', 33.33)
    expect(total(out)).toBe(10000)
    expect(out.partnerPct).toBe(33.33)
  })

  it('nunca produce negativos ni pasa de 100 con cualquier entrada', () => {
    for (const start of [base(100, 0, 0), base(0, 100, 0), base(10, 20, 70), base(33.34, 33.33, 33.33)])
      for (const key of ['partnerPct', 'capitalPct', 'workPct'] as const)
        for (const value of [0, 0.01, 12.34, 50, 99.99, 100]) {
          const out = rebalanceBase(start, key, value)
          expect(total(out), `${key}=${value}`).toBe(10000)
          for (const part of Object.values(out)) {
            expect(part).toBeGreaterThanOrEqual(0)
            expect(part).toBeLessThanOrEqual(100)
          }
          expect(out[key]).toBe(value)
        }
  })

  it('un valor fuera de rango se acota en vez de fallar', () => {
    expect(rebalanceBase(base(50, 50, 0), 'partnerPct', 140)).toEqual(base(100, 0, 0))
    expect(rebalanceBase(base(50, 50, 0), 'partnerPct', -5)).toEqual(base(0, 100, 0))
  })
})

describe('atajos', () => {
  it('son sugerencias que ya suman 100', () => {
    expect(BASE_PRESETS.length).toBeGreaterThanOrEqual(3)
    for (const preset of BASE_PRESETS) {
      expect(total(preset.base), preset.id).toBe(10000)
      expect(preset.label.length).toBeGreaterThan(0)
    }
  })
})

describe('defaultRulesConfig', () => {
  it('es una configuración completa, con reparto por igual y sin tope', () => {
    const config = defaultRulesConfig()
    expect(config.schemaVersion).toBe(1)
    expect(config.profitBase).toEqual({ partnerPct: 100, capitalPct: 0, workPct: 0 })
    expect(config.reinvestment.untilAmountMinor).toBeNull()
    expect(config.capitalRecovery).toEqual({ mode: 'ninguna', timing: 'durante' })
    expect(config.work.payHours).toBe(false)
    expect(config.partnerExpenses).toBe('no_reembolsar')
  })

  it('devuelve una copia nueva cada vez', () => {
    const a = defaultRulesConfig()
    a.profitBase.partnerPct = 1
    expect(defaultRulesConfig().profitBase.partnerPct).toBe(100)
  })
})

describe('textos de ayuda', () => {
  const guides = Object.values(RULE_GUIDES)

  it('hay uno por cada engrane', () => {
    expect(Object.keys(RULE_GUIDES).sort()).toEqual(
      ['capitalRecovery', 'partnerExpenses', 'partnerLoans', 'profitBase', 'reinvestment', 'reserves', 'work'],
    )
  })

  it('cada frase tiene 20 palabras o menos y no hay jerga de error', () => {
    for (const guide of guides)
      for (const sentence of [guide.what, guide.why, guide.source.text].flatMap((t) => t.split(/(?<=[.!?])\s+/)))
        expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(20)
  })

  it('las fuentes no inventan enlaces', () => {
    for (const guide of guides) {
      expect(guide.source.url).toBeNull()
      expect(guide.source.label.length).toBeGreaterThan(0)
    }
  })

  it('citan las fuentes que pidió el plan', () => {
    const labels = guides.map((g) => g.source.label).join(' | ')
    expect(labels).toMatch(/LGSM/)
    expect(labels).toMatch(/ISR/)
    expect(labels).toMatch(/capital/i)
  })
})

describe('rulesStateText', () => {
  const overview = (patch: Partial<RulesOverview>): RulesOverview => ({
    state: 'sin_aprobar', inForce: null, pending: null, draft: null, history: [], partners: [],
    me: { memberId: 'm', canApprove: true, cannotApproveReason: null, hasApproved: false, isProposer: false, reminderReceivedAt: null },
    disclaimer: '', ...patch,
  })

  it('sin reglas dice que no hay acuerdo aprobado', () => {
    expect(rulesStateText(overview({}))).toEqual({ tone: 'neutral', title: 'Sin aprobar', detail: 'Todavía no hay reglas de reparto aprobadas.' })
  })

  it('pendiente nombra a quien falta', () => {
    const pending = { missing: [{ memberId: '1', name: 'Ana' }, { memberId: '2', name: 'Beto' }] } as never
    expect(rulesStateText(overview({ state: 'pendiente', pending }))).toMatchObject({
      tone: 'warning', title: 'Pendiente', detail: 'Faltan por aprobar: Ana y Beto.',
    })
    const one = { missing: [{ memberId: '1', name: 'Ana' }] } as never
    expect(rulesStateText(overview({ state: 'pendiente', pending: one })).detail).toBe('Falta por aprobar: Ana.')
    const three = { missing: ['A', 'B', 'C'].map((name, i) => ({ memberId: String(i), name })) } as never
    expect(rulesStateText(overview({ state: 'pendiente', pending: three })).detail).toBe('Faltan por aprobar: A, B y C.')
  })

  it('vigentes muestra la fecha en que entraron', () => {
    const inForce = { version: 3, activatedAt: '2026-10-20T18:30:00.000Z' } as never
    const text = rulesStateText(overview({ state: 'vigente', inForce }))
    expect(text).toMatchObject({ tone: 'success', title: 'Vigentes' })
    expect(text.detail).toBe('Versión 3, desde el 20/10/2026.')
  })
})

describe('fechas y estados', () => {
  it('la fecha y la hora van en hora de Ciudad de México', () => {
    expect(formatRuleDate('2026-10-20T03:30:00.000Z')).toBe('19/10/2026')
    expect(formatRuleDateTime('2026-10-20T16:05:00.000Z')).toBe('20/10/2026, 10:05')
  })

  it('cada estado tiene un nombre sencillo', () => {
    expect(STATUS_TEXT).toEqual({
      borrador: 'Borrador', pendiente: 'Pendiente', vigente: 'Vigente', reemplazada: 'Reemplazada', retirada: 'Descartada',
    })
  })

  it('una lista de nombres se une con comas y "y"', () => {
    expect(joinNames([])).toBe('')
    expect(joinNames(['Ana'])).toBe('Ana')
    expect(joinNames(['Ana', 'Beto'])).toBe('Ana y Beto')
    expect(joinNames(['Ana', 'Beto', 'Carla'])).toBe('Ana, Beto y Carla')
  })
})

describe('versionSummary', () => {
  it('resume una versión en frases cortas', () => {
    const lines = versionSummary({
      ...defaultRulesConfig(),
      profitBase: { partnerPct: 40, capitalPct: 60, workPct: 0 },
      capitalRecovery: { mode: 'por_diferencia', timing: 'al_cierre' },
      work: { payHours: true, order: 'antes', pay: { kind: 'por_hora', rateMinorPerHour: 5000 } },
      reserves: { kind: 'monto', amountMinor: 120000 },
      partnerExpenses: 'reembolsar',
      partnerLoans: { repayBeforeCapital: true },
    })
    expect(lines).toContain('Utilidad: 40 % por ser socio, 60 % por capital, 0 % por trabajo.')
    expect(lines).toContain('Capital: se recupera por diferencia, solo al cierre.')
    expect(lines).toContain('Trabajo: se pagan las horas antes del capital, a $50.00 por hora.')
    expect(lines).toContain('Reservas: $1,200.00 fijos.')
    expect(lines).toContain('Gastos de socio: se reembolsan.')
    expect(lines).toContain('Préstamos de socio: se devuelven antes del capital.')
  })
})

describe('rulesErrorMessage', () => {
  const fail = (status: number, code?: string, message?: string) => ({ response: { status, data: { code, message } } })

  it('usa el mensaje en español que manda el servidor para el acceso compartido', () => {
    expect(rulesErrorMessage(fail(403, 'FINANCE_RULES_SHARED_LOGIN', 'Tu acceso es compartido.'))).toBe('Tu acceso es compartido.')
  })

  it.each([
    ['FINANCE_RULES_DRAFT_OWNED', 409, 'Otro socio ya tiene un borrador abierto.'],
    ['FINANCE_RULES_PENDING_EXISTS', 409, 'Ya hay una propuesta esperando aprobación.'],
    ['FINANCE_RULES_NOT_PROPOSER', 403, 'Solo quien creó la propuesta puede hacer esto.'],
    ['FINANCE_RULES_WRONG_STATE', 409, 'La propuesta cambió mientras tanto. Actualiza la pantalla.'],
    ['FINANCE_RULES_NOT_FOUND', 404, 'No encontramos esas reglas.'],
    ['FINANCE_RULES_DRAFT_EXISTS', 409, 'Ya existe otro borrador abierto.'],
  ])('traduce %s', (code, status, text) => expect(rulesErrorMessage(fail(status, code))).toContain(text))

  it('los demás casos dan un mensaje sencillo', () => {
    expect(rulesErrorMessage(fail(401))).toBe('La sesión venció. Inicia sesión de nuevo.')
    expect(rulesErrorMessage(fail(403))).toBe('Solo las personas socias pueden usar las reglas de reparto.')
    expect(rulesErrorMessage(fail(400, 'FINANCE_RULES_INVALID'))).toBe('Revisa los datos de las reglas. Alguno no es válido.')
    expect(rulesErrorMessage(new Error('x'))).toBe('No pudimos completar la acción. Revisa tu conexión e inténtalo de nuevo.')
  })
})
