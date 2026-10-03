import type { Contribution, ContributionPayload, ReversalReceipt, ContributionReversal, ContributionPage } from '@/types/contribution.types'
import type { FinanceOrigin, PendingContribution } from './contributions-records'
import { financeScope } from './contributions-records'
import { confirmContribution, financeSnapshot, updateContributionAttempt } from './contributions-db'
const instant = (v: unknown): v is string => typeof v === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(v) && Number.isFinite(Date.parse(v))
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const object = (v: unknown): Record<string, unknown> | null => !!v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string,unknown> : null
export function isReversal(v: unknown): v is ContributionReversal {
  const r=object(v)
  return !!r && uuid(r.id) && uuid(r.contributionId) && (r.replacementContributionId===null || uuid(r.replacementContributionId)) && uuid(r.createdByMemberId) && uuid(r.deviceId) && typeof r.reason==='string' && !!r.reason.trim() && instant(r.occurredAt) && instant(r.receivedAt)
}
export function isContribution(v: unknown): v is Contribution {
  const r=object(v)
  return !!r && uuid(r.id) && uuid(r.memberId) && uuid(r.createdByMemberId) && uuid(r.deviceId) && typeof r.amountMinor==='number' && Number.isInteger(r.amountMinor) && r.amountMinor>0 && r.amountMinor<=2147483647 && r.currency==='MXN' && typeof r.contextId==='string' && !!r.contextId && typeof r.createdByAccountId==='string' && !!r.createdByAccountId && (r.note===null || typeof r.note==='string') && instant(r.occurredAt) && instant(r.receivedAt) && (r.reversal===undefined || r.reversal===null || (isReversal(r.reversal) && r.reversal.contributionId===r.id))
}
export function validContributionPage(v: unknown, origin: FinanceOrigin): v is ContributionPage {
  const page=object(v)
  return !!page && Array.isArray(page.items) && page.items.every((r)=>isContribution(r) && (!origin.contextId || r.contextId===origin.contextId)) && (page.nextCursor===null || typeof page.nextCursor==='string')
}
function sameContribution(receipt: unknown, payload: ContributionPayload, origin: FinanceOrigin): receipt is Contribution {
  return isContribution(receipt) && receipt.id===payload.id && receipt.memberId===payload.memberId && receipt.createdByMemberId===payload.createdByMemberId && receipt.deviceId===payload.deviceId && receipt.amountMinor===payload.amountMinor && new Date(receipt.occurredAt).toISOString()===new Date(payload.occurredAt).toISOString() && receipt.note===(payload.note??null) && receipt.createdByAccountId===origin.accountId && (!origin.contextId || receipt.contextId===origin.contextId)
}
function validReceipt(v: unknown, record: PendingContribution, original?: Contribution): v is Contribution | ReversalReceipt {
  if(record.kind==='create') return sameContribution(v,record.payload,record.origin)
  const r=object(v)
  if(!r || !isReversal(r) || r.id!==record.id || r.contributionId!==record.contributionId || r.reason!==record.payload.reason || r.createdByMemberId!==record.origin.memberId || r.deviceId!==record.origin.deviceId || new Date(r.occurredAt).toISOString()!==new Date(record.payload.occurredAt).toISOString() || r.createdByAccountId!==record.origin.accountId || typeof r.contextId!=='string' || !r.contextId || (record.origin.contextId && r.contextId!==record.origin.contextId)) return false
  if(!isContribution(r.original) || r.original.id!==record.contributionId || r.original.contextId!==r.contextId) return false
  if(original && (r.original.amountMinor!==original.amountMinor || r.original.memberId!==original.memberId || r.original.deviceId!==original.deviceId || r.original.note!==original.note || Date.parse(r.original.occurredAt)!==Date.parse(original.occurredAt))) return false
  return record.payload.replacement ? r.replacementContributionId===record.payload.replacement.id && sameContribution(r.replacement,record.payload.replacement,record.origin) && r.replacement.contextId===r.contextId : r.replacementContributionId===null && r.replacement===null
}
export interface FinanceSyncOptions { online?: () => boolean; canSend?: (origin: FinanceOrigin)=>boolean; now?: ()=>number }
const running = new Set<string>()
export async function syncContributions(origin: FinanceOrigin, send: (record: PendingContribution)=>Promise<unknown>, options: FinanceSyncOptions = {}): Promise<number> {
  const scope=financeScope(origin)
  if(running.has(scope)) return 0
  running.add(scope)
  const run=async()=>{
    let synced=0
    const snapshot=await financeSnapshot(origin)
    const ordered=[...snapshot.pending].sort((a,b)=>(a.kind==='create'?0:1)-(b.kind==='create'?0:1) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    for(const record of ordered) {
      if(record.state!=='pending' || record.nextAttemptAt>(options.now?.()??Date.now())) continue
      if(record.origin.accountId!==origin.accountId || record.origin.apiBase!==origin.apiBase || record.origin.deviceId!==origin.deviceId || (origin.contextId && record.origin.contextId && origin.contextId!==record.origin.contextId)) continue
      if(options.online && !options.online()) break
      if(options.canSend && !options.canSend(record.origin)) break
      let original: Contribution | undefined
      if(record.kind==='reverse') {
        const current=await financeSnapshot(origin);original=current.history.find(r=>r.id===record.contributionId)
        if(!original) {
          const dependency=current.pending.find(r=>r.kind==='create' && r.id===record.contributionId)
          if(!dependency || dependency.state!=='pending') await updateContributionAttempt(record,'needs_review','La aportación original requiere revisión antes de corregirse.')
          continue
        }
      }
      try {
        const receipt=await send(record)
        if(!validReceipt(receipt,record,original)) throw new Error('Uncertain financial acknowledgement')
        // Confirmation and pending removal are a single durable transaction.
        await confirmContribution(record,receipt);synced++
      } catch(error) {
        const status=(error as {response?:{status?:number}})?.response?.status
        const state=status===401 || status===403 ? 'paused' : status && status>=400 && status<500 && status!==408 && status!==429 ? 'needs_review' : 'pending'
        const message=state==='paused'?'La sesión o el dispositivo no están autorizados. Confirma el origen y reintenta.':state==='needs_review'?'El servidor rechazó el registro. Revisa los datos; no se modificó el movimiento.':'No se pudo confirmar la sincronización. El registro sigue guardado y se reenviará con el mismo ID.'
        await updateContributionAttempt(record,state,message,options.now?.()??Date.now())
        if(state!=='needs_review') break
      }
    }
    return synced
  }
  try {
    if(typeof navigator!=='undefined' && navigator.locks?.request) return await navigator.locks.request('marchanta-contributions:'+scope,{ifAvailable:true},async(lock)=>lock?run():0)
    return await run()
  } finally { running.delete(scope) }
}
