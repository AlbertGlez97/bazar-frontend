import type { Content, TDocumentDefinitions, TVirtualFileSystem } from 'pdfmake/interfaces'
import type { DistributionAgreement } from '@/types/finance-agreement.types'
import { agreementWarningText, formatAgreementInstant } from '@/utils/finance-agreements'
import { bpsToPercentText } from '@/utils/finance-distribution'
import { formatReservePeriod } from '@/utils/finance-reserves'
import { formatMinorMoney } from '@/utils/money'

export const agreementPdfFileName = (folio: string): string =>
  'acuerdo-' + (folio.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'documento') + '.pdf'
const money = formatMinorMoney
const heading = (text: string): Content => ({ text, style: 'section' })
const minutes = (value: number): string => Math.floor(value / 60) + ' h ' + value % 60 + ' min'

/** Pure snapshot projection: no live names, simulation requests or allocation arithmetic. */
export function buildAgreementPdfDefinition(snapshot: DistributionAgreement): TDocumentDefinitions {
  const s = snapshot, voided = s.status === 'voided'
  const content: Content[] = [
    { text: 'LA MARCHANTA', style: 'brand' },
    { text: 'ACUERDO DE REPARTO', style: 'title' },
    { text: s.folio, style: 'folio' },
    ...(voided ? [{ text: 'ANULADO', color: '#a12c25', bold: true, fontSize: 22, margin: [0, 8, 0, 8] } as Content] : []),
    { text: s.title, fontSize: 15, bold: true, margin: [0, 8, 0, 6] },
    { text: 'Contexto (identificador): ' + s.contextId, fontSize: 9 },
    { text: 'Fecha del acuerdo: ' + formatAgreementInstant(s.occurredAt) + ' (UTC-6)' },
    { text: 'Recibido: ' + formatAgreementInstant(s.receivedAt) + ' (UTC-6)' },
    { text: 'Período: ' + formatReservePeriod(s.period.from, s.period.to) },
    { text: 'Creado por: ' + s.createdBy.name },
    ...(s.note ? [{ text: 'Nota: ' + s.note, margin: [0, 6, 0, 6] } as Content] : []),
    ...(s.replacesAgreement ? [{ text: 'Sustituye a: ' + s.replacesAgreement.folio }] : []),
    ...(s.replacedBy ? [{ text: 'Sustituido por: ' + s.replacedBy.folio }] : []),
    ...(s.reversal ? [{ text: 'Motivo de anulación: ' + s.reversal.reason, color: '#a12c25', bold: true },
      { text: 'Anulado: ' + formatAgreementInstant(s.reversal.occurredAt) + ' (UTC-6)' }] : []),
    heading('Base financiera y regla conservadas'),
    { text: 'Base: ' + (s.financialBase.status === 'partial' ? 'Parcial' : 'Completa') + ' · Moneda: MXN' },
    { text: 'Monto potencialmente disponible: ' + money(s.financialBase.potentiallyAvailableMinor) },
    { text: 'Monto acordado: ' + money(s.financialBase.requestedAmountMinor), bold: true },
    { text: 'Restaría potencialmente: ' + money(s.financialBase.remainingAvailableMinor) },
    { text: bpsToPercentText(s.rule.partnerShareBps) + '% por ser socio · ' + bpsToPercentText(s.rule.workShareBps) + '% por trabajo' },
    { text: 'Socios por partes iguales (EQUAL). Trabajo por ' + (s.rule.workBasis === 'WORK_SHIFTS' ? 'jornadas.' : 'minutos conocidos (horas registradas).') },
    { text: 'Componente socios: ' + money(s.pools.partnerPoolMinor) + ' · Componente trabajo: ' + money(s.pools.workPoolMinor) },
    heading('Personas participantes'),
    ...s.participants.map((p): Content => ({
      table: { widths: ['*'], dontBreakRows: true, body: [[{ stack: [
        { text: p.name, bold: true, fontSize: 12 },
        { text: (p.role === 'socio' ? 'Socio' : 'Colaborador') + ' · ' + (p.isActive ? 'Activo' : 'Inactivo') + ' al crear el acuerdo' },
        { text: p.partnerEligible ? 'Participa como socio' : 'No participa como socio' },
        { text: 'Por ser socio: ' + money(p.partnerAmountMinor) + ' · Por trabajo: ' + money(p.workAmountMinor) },
        { text: 'Total acordado: ' + money(p.totalMinor), bold: true },
        { text: 'Trabajo usado: ' + (s.rule.workBasis === 'WORK_SHIFTS' ? p.workUnits + ' jornadas' : minutes(p.workUnits)) },
        { text: 'Jornadas: ' + p.shiftCount + ' · Tiempo conocido: ' + minutes(p.knownMinutes) + ' · Sin duración: ' + p.unknownDurationCount },
      ], margin: [8, 7, 8, 7] }]] }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 8],
    })),
    heading('Totales conservados'),
    { text: 'Total asignado: ' + money(s.totals.distributedMinor), bold: true },
    { text: 'Sin asignar: ' + money(s.totals.undistributedMinor) },
    ...(s.warnings.length ? [heading('Avisos conservados'), { ul: s.warnings.map(w => agreementWarningText(w.code)) } as Content] : []),
    { table: { widths: ['*'], dontBreakRows: true, body: [[{ stack: [
      heading('Código de verificación'),
      { text: 'Identificador de integridad del registro', fontSize: 9, color: '#65554c' },
      { text: s.snapshotFingerprint, fontSize: 8, noWrap: false, margin: [0, 4, 0, 4] },
      { text: 'No es una firma digital ni acredita autenticidad legal.', fontSize: 8, color: '#65554c' },
    ] }]] }, layout: 'noBorders' },
    heading('Alcance del documento'),
    { text: s.notice },
    { text: 'No registra pagos, retiros ni transferencias. No modifica aportaciones, gastos, jornadas o reservas.' },
    { text: 'Los nombres, datos y montos son los del documento guardado; no se recalculan al generar este PDF.' },
    heading('Firmas de las personas participantes'),
    { text: 'Espacios para firma manuscrita y fecha. La aplicación no registra firmas digitales.', margin: [0, 0, 0, 10] },
    ...s.participants.map((p): Content => ({ table: { widths: ['*'], dontBreakRows: true, body: [[{ stack: [
      { text: p.name, bold: true },
      { text: 'Firma: __________________________________________________', margin: [0, 20, 0, 8] },
      { text: 'Fecha: __________________________' },
    ], margin: [0, 8, 0, 8] }]] }, layout: 'noBorders', margin: [0, 0, 0, 10] })),
  ]
  return {
    pageSize: 'A4', pageMargins: [40, 52, 40, 52], content,
    info: { title: 'Acuerdo de reparto ' + s.folio, author: 'LA MARCHANTA', subject: 'Documento histórico de reparto; no registra pagos' },
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.2, color: '#292421' },
    styles: { brand: { fontSize: 11, bold: true, color: '#994a35' }, title: { fontSize: 22, bold: true },
      folio: { fontSize: 12, bold: true }, section: { fontSize: 13, bold: true, margin: [0, 16, 0, 7] } },
    header: { text: s.folio + (voided ? ' · ANULADO' : ' · ACUERDO DE REPARTO'), margin: [40, 22, 40, 0], fontSize: 9, color: voided ? '#a12c25' : '#65554c' },
    footer: (page, count) => ({ columns: [{ text: 'LA MARCHANTA · No registra pagos', width: '*' },
      { text: 'Página ' + page + ' de ' + count, alignment: 'right' }], margin: [40, 20, 40, 0], fontSize: 8 }),
  }
}
type PdfMakeApi = typeof import('pdfmake/build/pdfmake')
let ready: Promise<PdfMakeApi> | null = null
function loadPdfMake(): Promise<PdfMakeApi> {
  ready ??= Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]).then(([module, fonts]) => {
    const api = ((module as { default?: PdfMakeApi }).default ?? module) as PdfMakeApi
    api.addVirtualFileSystem(((fonts as { default?: TVirtualFileSystem }).default ?? fonts) as TVirtualFileSystem)
    return api
  }).catch(error => { ready = null; throw error })
  return ready
}
/** Generated only on demand; neither the Blob nor its URL is persisted. */
export async function renderAgreementPdfBlob(snapshot: DistributionAgreement): Promise<Blob> {
  const definition = buildAgreementPdfDefinition(snapshot)
  return (await loadPdfMake()).createPdf(definition).getBlob()
}
