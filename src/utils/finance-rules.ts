import { formatMinorMoney } from './money'
import type {
  FinanceRulesConfig,
  ProfitBase,
  RuleSetView,
  RulesOverview,
  RulesPartnerStatus,
} from '@/types/finance-rules.types'

/** Lee un porcentaje escrito a mano: 0 a 100, hasta 2 decimales, coma o punto. */
export function parsePctText(text: string): number | null {
  const clean = text.trim().replace(/%$/, '').trim().replace(',', '.')
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(clean)) return null
  const value = Number(clean)
  return value <= 100 ? value : null
}

const BASE_KEYS = ['partnerPct', 'capitalPct', 'workPct'] as const
type BaseKey = (typeof BASE_KEYS)[number]
const hundredths = (pct: number) => Math.round(pct * 100)

/**
 * Cambia un campo de la división de utilidad y reajusta los otros para que
 * la suma siga en 100. Trabaja en centésimas para que la suma sea exacta.
 */
export function rebalanceBase(base: ProfitBase, key: BaseKey, value: number): ProfitBase {
  const next = Math.min(10000, Math.max(0, hundredths(value)))
  const others = BASE_KEYS.filter((k) => k !== key)
  const rest = 10000 - next
  const weights = others.map((k) => hundredths(base[k]))
  const weightSum = weights.reduce((a, b) => a + b, 0)
  const parts = new Map<BaseKey, number>([[key, next]])
  if (weightSum === 0) {
    // Nada que repartir en proporción: el sobrante va al campo que sigue.
    const following = BASE_KEYS[(BASE_KEYS.indexOf(key) + 1) % BASE_KEYS.length]!
    for (const other of others) parts.set(other, other === following ? rest : 0)
  } else {
    const shares = weights.map((w) => Math.floor((rest * w) / weightSum))
    const leftover = rest - shares.reduce((a, b) => a + b, 0)
    shares[weights.indexOf(Math.max(...weights))]! += leftover
    others.forEach((other, i) => parts.set(other, shares[i]!))
  }
  return {
    partnerPct: parts.get('partnerPct')! / 100,
    capitalPct: parts.get('capitalPct')! / 100,
    workPct: parts.get('workPct')! / 100,
  }
}

export interface BasePreset { id: string; label: string; base: ProfitBase }
/** Sugerencias: se pueden cambiar a mano después. */
export const BASE_PRESETS: readonly BasePreset[] = [
  { id: 'igual', label: 'Todos por igual', base: { partnerPct: 100, capitalPct: 0, workPct: 0 } },
  { id: 'capital', label: 'Por capital aportado', base: { partnerPct: 0, capitalPct: 100, workPct: 0 } },
  { id: 'mixto', label: 'Mixto: 60 % capital, 40 % igual', base: { partnerPct: 40, capitalPct: 60, workPct: 0 } },
  { id: 'trabajo', label: 'Por trabajo', base: { partnerPct: 0, capitalPct: 0, workPct: 100 } },
]

/** Punto de partida neutro: no cambia nada hasta que los socios lo ajusten. */
export function defaultRulesConfig(): FinanceRulesConfig {
  return {
    schemaVersion: 1,
    profitBase: { partnerPct: 100, capitalPct: 0, workPct: 0 },
    reinvestment: { currentPhase: 'operacion', arranquePct: 0, operacionPct: 0, cierrePct: 0, untilAmountMinor: null },
    capitalRecovery: { mode: 'ninguna', timing: 'durante' },
    work: { payHours: false, order: 'antes', pay: { kind: 'por_hora', rateMinorPerHour: 0 } },
    partnerExpenses: 'no_reembolsar',
    reserves: { kind: 'porcentaje', pct: 0 },
    partnerLoans: { repayBeforeCapital: false },
  }
}

export interface RuleGuide {
  title: string
  /** Qué decide este engrane. */
  what: string
  /** Por qué importa. */
  why: string
  /** "¿De dónde sale esto?" Sin enlaces inventados: `url` queda en null hasta verificarlo. */
  source: { label: string; text: string; url: string | null }
}

export const RULE_GUIDES = {
  profitBase: {
    title: 'Cómo se divide la utilidad',
    what: 'Decide cuánto pesa ser socio, el capital aportado y el trabajo.',
    why: 'Las tres partes deben sumar 100. Al cambiar una, las otras se ajustan.',
    source: {
      label: 'LGSM art. 18 y cuentas de capital',
      text: 'Es la base para repartir ganancias entre socios. Confírmalo con un contador.',
      url: null,
    },
  },
  reinvestment: {
    title: 'Cuánto se reinvierte',
    what: 'Es la parte de la utilidad que se queda en el negocio, según su fase.',
    why: 'Al arrancar suele reinvertirse más. Al cerrar, casi nada.',
    source: {
      label: 'Cascada de reparto',
      text: 'Primero se cubre el negocio y después se reparte lo que sobra.',
      url: null,
    },
  },
  capitalRecovery: {
    title: 'Cómo se recupera el capital',
    what: 'Decide si el dinero que cada socio puso regresa antes de repartir utilidad.',
    why: 'Cambia quién recibe primero y cuándo empieza a recibir utilidad.',
    source: {
      label: 'Cuentas de capital · ISR art. 78',
      text: 'La cuenta de capital lleva lo aportado y lo retirado. Valídalo con un contador.',
      url: null,
    },
  },
  work: {
    title: 'Cómo se paga el trabajo',
    what: 'Decide si las horas trabajadas se pagan, y si va antes o después del capital.',
    why: 'Evita que el trabajo quede sin pago o se cuente dos veces.',
    source: {
      label: 'Cascada de reparto',
      text: 'El trabajo puede pagarse por hora o como parte del reparto.',
      url: null,
    },
  },
  partnerExpenses: {
    title: 'Gastos que paga un socio',
    what: 'Decide qué pasa cuando un socio paga un gasto con su dinero.',
    why: 'Puede reembolsarse, contarse como aportación o quedar sin reembolso.',
    source: {
      label: 'Cuentas de capital',
      text: 'Un gasto pagado por un socio puede tratarse como aportación al capital.',
      url: null,
    },
  },
  reserves: {
    title: 'Reservas',
    what: 'Es lo que se aparta antes de repartir, por porcentaje o por monto fijo.',
    why: 'Sirve para cubrir imprevistos y gastos que aún no llegan.',
    source: {
      label: 'Cascada de reparto',
      text: 'Las reservas se apartan al inicio, antes de cualquier reparto.',
      url: null,
    },
  },
  partnerLoans: {
    title: 'Préstamos de socios',
    what: 'Decide si un préstamo de un socio se devuelve antes que el capital.',
    why: 'Un préstamo es una deuda. El capital aportado no lo es.',
    source: {
      label: 'Cuentas de capital',
      text: 'Préstamo y aportación son cosas distintas. Valídalo con un contador.',
      url: null,
    },
  },
} as const satisfies Record<string, RuleGuide>

export const RULES_INTRO = [
  'Configura estas reglas antes de repartir. Así todos saben cómo se calcula.',
  'Cada socio recibe un correo con las reglas y las aprueba desde ahí. Si falta uno, no entran en vigor.',
  'Cualquier cambio pide una nueva aprobación de todos. Tómalo con calma.',
] as const

export const RULES_DISCLAIMER =
  'Esta herramienta ayuda a organizar el reparto. No es asesoría contable ni legal. Conviene validar las reglas con un contador.'

const dateText = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(iso))
export const formatRuleDate = dateText
export const formatRuleDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))

export const STATUS_TEXT = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  vigente: 'Vigente',
  reemplazada: 'Reemplazada',
  descartada: 'Descartada',
  retirada: 'Descartada',
} as const

export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

export interface RulesStateText { tone: 'neutral' | 'warning' | 'success'; title: string; detail: string }

export function rulesStateText(overview: RulesOverview): RulesStateText {
  if (overview.state === 'en_revision' && overview.proposal) {
    const names = overview.proposal.objections.map((o) => o.name)
    return {
      tone: 'warning',
      title: 'En revisión',
      detail: `${joinNames(names)} no ${names.length === 1 ? 'está' : 'están'} de acuerdo. Modifiquen la propuesta o descártenla. Siguen las reglas anteriores.`,
    }
  }
  if (overview.state === 'pendiente' && overview.proposal) {
    const names = overview.proposal.missing.map((m) => m.name)
    const lead = names.length === 1 ? 'Falta' : 'Faltan'
    return { tone: 'warning', title: 'Pendiente', detail: `${lead} por responder: ${joinNames(names)}.` }
  }
  if (overview.state === 'vigente' && overview.inForce) {
    const since = dateText(overview.inForce.activatedAt ?? overview.inForce.createdAt)
    return { tone: 'success', title: 'Vigentes', detail: `Versión ${overview.inForce.version}, desde el ${since}.` }
  }
  return { tone: 'neutral', title: 'Sin aprobar', detail: 'Todavía no hay reglas de reparto aprobadas.' }
}

const RECOVERY_TEXT = {
  ninguna: 'no se recupera',
  por_diferencia: 'se recupera por diferencia',
  total: 'se recupera todo',
  proporcional: 'se recupera en proporción',
} as const
const PHASE_TEXT = { arranque: 'arranque', operacion: 'operación', cierre: 'cierre' } as const
const EXPENSE_TEXT = {
  no_reembolsar: 'no se reembolsan',
  reembolsar: 'se reembolsan',
  contar_como_aportacion: 'cuentan como aportación',
} as const

const pct = (value: number) => `${value} %`

/** Una frase corta por engrane, para el historial. */
export function versionSummary(config: FinanceRulesConfig): string[] {
  const { profitBase: b, reinvestment: r, capitalRecovery: c, work: w, reserves: v } = config
  const until = r.untilAmountMinor === null ? '' : `, hasta ${formatMinorMoney(r.untilAmountMinor)}`
  const timing = c.timing === 'durante' ? 'durante la operación' : 'solo al cierre'
  const pay = w.pay.kind === 'por_hora'
    ? `a ${formatMinorMoney(w.pay.rateMinorPerHour)} por hora`
    : `con ${pct(w.pay.pct)} del reparto`
  return [
    `Utilidad: ${pct(b.partnerPct)} por ser socio, ${pct(b.capitalPct)} por capital, ${pct(b.workPct)} por trabajo.`,
    `Reinversión: ${pct(r.arranquePct)} en arranque, ${pct(r.operacionPct)} en operación, ${pct(r.cierrePct)} en cierre${until}. Fase actual: ${PHASE_TEXT[r.currentPhase]}.`,
    c.mode === 'ninguna' ? 'Capital: no se recupera.' : `Capital: ${RECOVERY_TEXT[c.mode]}, ${timing}.`,
    w.payHours
      ? `Trabajo: se pagan las horas ${w.order === 'antes' ? 'antes' : 'después'} del capital, ${pay}.`
      : 'Trabajo: no se pagan horas aparte.',
    `Gastos de socio: ${EXPENSE_TEXT[config.partnerExpenses]}.`,
    v.kind === 'porcentaje' ? `Reservas: ${pct(v.pct)} de la utilidad.` : `Reservas: ${formatMinorMoney(v.amountMinor)} fijos.`,
    `Préstamos de socio: se devuelven ${config.partnerLoans.repayBeforeCapital ? 'antes' : 'después'} del capital.`,
  ]
}

const codeOf = (error: unknown): string => {
  const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code
  return typeof code === 'string' ? code : ''
}
const statusOf = (error: unknown): number | null => {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status
  return typeof status === 'number' ? status : null
}
const serverMessage = (error: unknown): string => {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message
  return typeof message === 'string' ? message.trim() : ''
}

const CODE_TEXT: Record<string, string> = {
  FINANCE_RULES_DRAFT_OWNED: 'Otro socio ya tiene un borrador abierto. Pídele que lo envíe o lo descarte.',
  FINANCE_RULES_PENDING_EXISTS: 'Ya hay una propuesta abierta. Descártenla o modifíquenla antes de enviar otra.',
  FINANCE_RULES_NOT_PROPOSER: 'Solo quien creó el borrador puede enviarlo.',
  FINANCE_RULES_WRONG_STATE: 'La propuesta cambió mientras tanto. Actualiza la pantalla.',
  FINANCE_RULES_NOT_FOUND: 'No encontramos esas reglas.',
  FINANCE_RULES_IN_REVIEW: 'Esta propuesta está en revisión. Modifícala o descártala.',
  FINANCE_RULES_INVALID: 'Revisa los datos de las reglas. Alguno no es válido.',
  MEMBER_EMAIL_INVALID: 'Escribe un correo válido, por ejemplo nombre@dominio.com',
  MEMBER_EMAIL_IN_USE: 'Ese correo ya está en uso. Usa otro correo.',
  MEMBER_EMAIL_ALREADY_SET: 'Ya tienes un correo registrado.',
  MEMBER_EMAIL_NOT_SENT: 'No pudimos enviar el correo. Revisa que esté bien escrito e inténtalo de nuevo.',
  MEMBER_EMAIL_TOO_MANY: 'Pediste muchos correos de confirmación. Espera una hora e inténtalo de nuevo.',
}

/** The server writes these in plain Spanish and puts the names in them: shown as they come. */
const SERVER_TEXT = new Set(['FINANCE_RULES_MISSING_EMAIL', 'FINANCE_RULES_DRAFT_EXISTS'])
const MISSING_EMAIL_FALLBACK = 'No se puede enviar. A algún socio le falta el correo.'
const DRAFT_EXISTS_FALLBACK = 'Ya existe otro borrador abierto. Envíalo o descártalo primero.'

/** Mensajes sencillos; los que llevan nombres los escribe el servidor en español. */
export function rulesErrorMessage(error: unknown): string {
  const code = codeOf(error)
  if (SERVER_TEXT.has(code))
    return serverMessage(error) || (code === 'FINANCE_RULES_MISSING_EMAIL' ? MISSING_EMAIL_FALLBACK : DRAFT_EXISTS_FALLBACK)
  if (CODE_TEXT[code]) return CODE_TEXT[code]
  switch (statusOf(error)) {
    case 401: return 'La sesión venció. Inicia sesión de nuevo.'
    case 403: return 'Solo las personas socias pueden usar las reglas de reparto.'
    default: return 'No pudimos completar la acción. Revisa tu conexión e inténtalo de nuevo.'
  }
}

/** What the screen says after sending a proposal: who the emails reached and who they did not. */
export function submitNotice(emails: { sent: readonly string[]; failed: readonly string[] }): string {
  const parts: string[] = []
  if (emails.sent.length) parts.push(`Enviamos el correo a ${joinNames(emails.sent)}.`)
  if (emails.failed.length)
    parts.push(`No pudimos enviar el correo a ${joinNames(emails.failed)}. Usa «Reenviar correo» para intentarlo otra vez.`)
  return parts.join(' ')
}

/** What the screen says after "Reenviar correo". */
export function resendNotice(result: {
  activated: boolean
  resent: readonly { name: string; emailSent: boolean }[]
  skipped: readonly { name: string }[]
  noEmail: readonly { name: string }[]
}): string {
  if (result.activated) return 'Ya respondieron todos. Las reglas quedaron vigentes.'
  const parts: string[] = []
  const sent = result.resent.filter((r) => r.emailSent).map((r) => r.name)
  const failed = result.resent.filter((r) => !r.emailSent).map((r) => r.name)
  if (sent.length) parts.push(`Reenviamos el correo a ${joinNames(sent)}.`)
  if (failed.length) parts.push(`No pudimos enviar el correo a ${joinNames(failed)}. Inténtalo otra vez.`)
  if (result.skipped.length) parts.push(`A ${joinNames(result.skipped.map((s) => s.name))} ya se le reenvió hace menos de 24 horas.`)
  if (result.noEmail.length) parts.push(`A ${joinNames(result.noEmail.map((s) => s.name))} le falta el correo.`)
  return parts.join(' ') || 'No falta nadie por responder.'
}

/** De dónde vino una aprobación: del enlace del correo (con el correo enmascarado) o de una sesión, antes. */
export function approvalSource(approval: { correo: string | null; via: 'correo' | 'sesion' }): string {
  return approval.via === 'correo' && approval.correo
    ? `Aprobó desde el correo ${approval.correo}.`
    : 'Aprobó desde su sesión, antes de que se aprobara por correo.'
}

/** Una línea por socio: qué respondió, o qué falta para que responda. */
export function partnerStatusText(partner: RulesPartnerStatus, proposal: RuleSetView): string {
  if (partner.response === 'aprobo') {
    const approval = proposal.approvals.find((a) => a.memberId === partner.memberId)
    return approval ? `${partner.name}: aprobó el ${formatRuleDateTime(approval.approvedAt)}.` : `${partner.name}: aprobó.`
  }
  if (partner.response === 'objeto') return `${partner.name}: no está de acuerdo.`
  if (!partner.hasCorreo) return `${partner.name}: falta su correo.`
  if (!partner.link) return `${partner.name}: falta responder.`
  if (partner.link.expired)
    return `${partner.name}: el enlace venció el ${formatRuleDate(partner.link.expiresAt)}. Reenvía el correo.`
  return `${partner.name}: falta responder. Correo enviado el ${formatRuleDateTime(partner.link.sentAt)}.`
}

/** "Reenviar correo": se puede mientras a alguien que falta no se le haya reenviado en las últimas 24 horas. */
export function resendState(partners: readonly RulesPartnerStatus[]): { allowed: boolean; hint: string } {
  const waiting = partners.filter((p) => p.response === null)
  if (!waiting.length) return { allowed: false, hint: 'No falta nadie por responder.' }
  const reachable = waiting.filter((p) => p.hasCorreo)
  if (!reachable.length) return { allowed: false, hint: 'A quienes faltan les falta el correo. Primero deben escribirlo.' }
  const blocked = reachable.map((p) => p.link?.canResendAt ?? null)
  if (blocked.some((at) => at === null)) return { allowed: true, hint: '' }
  const next = (blocked as string[]).reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b))
  return { allowed: false, hint: `Ya reenviaste el correo hace menos de 24 horas. Podrás hacerlo de nuevo el ${formatRuleDateTime(next)}.` }
}

/** Quién falta de dar su correo, para avisar antes de enviar. */
export function missingCorreoText(names: readonly string[]): string {
  if (!names.length) return ''
  return `Falta el correo de ${joinNames(names)}. Hasta que lo escriban, no se puede enviar la propuesta.`
}
