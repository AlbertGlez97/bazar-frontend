import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v7 } from 'uuid'
import { useSessionStore } from './session.store'
import { currentQueueOrigin, canSendDebt } from '@/services/queue-origin'
import { enqueueContribution, financeSnapshot, mergeContributionHistory, saveFinanceReferences, retryContribution } from '@/services/contributions-db'
import { syncContributions } from '@/services/contributions-sync'
import { ContributionsService } from '@/services/contributions.service'
import MembersService from '@/services/members.service'
import type { Contribution, ContributionPayload, ContributionFilter, ReversalPayload } from '@/types/contribution.types'
import type { FinanceOrigin, PendingContribution, FinanceReferences } from '@/services/contributions-records'
import { financeScope } from '@/services/contributions-records'
import { isMember } from '@/utils/member'
export const useContributionsStore=defineStore('contributions',()=>{
  const session=useSessionStore()
  const history=ref<Contribution[]>([]), pending=ref<PendingContribution[]>([]), references=ref<FinanceReferences | null>(null)
  const syncing=ref(false), error=ref(''), lastFetchedAt=ref<string | null>(null), nextCursor=ref<string | null>(null)
  let timer:ReturnType<typeof setTimeout> | undefined, started=false, activeScope:string|null=null
  function origin():FinanceOrigin|null {
    if(session.member?.role!=='socio') return null
    const current=currentQueueOrigin()
    if(!current) return null
    const scope=financeScope(current)
    return {...current,...(activeScope===scope && references.value?.contextId?{contextId:references.value.contextId}:{})}
  }
  function clear(){history.value=[];pending.value=[];references.value=null;lastFetchedAt.value=null;nextCursor.value=null;activeScope=null}
  function visible(o:FinanceOrigin){const current=origin();return !!current && financeScope(current)===financeScope(o) && current.deviceId===o.deviceId}
  async function load(){
    const o=origin(); if(!o){clear();return}
    if(activeScope!==financeScope(o))clear()
    const data=await financeSnapshot(o)
    if(!visible(o))return
    activeScope=financeScope(o); history.value=data.history;pending.value=data.pending;references.value=data.references??null
  }
  async function refresh(filter:ContributionFilter={}){
    const o=origin();if(!o)throw new Error('Solo socios pueden administrar aportaciones.')
    const [page,members]=await Promise.all([ContributionsService.list(o,filter),MembersService.list()])
    if(!visible(o))return
    if(!Array.isArray(members)||!members.every(isMember))throw new Error('No se pudo validar el equipo del negocio.')
    const contexts=new Set(page.items.map(r=>r.contextId));if(contexts.size>1)throw new Error('Respuesta de negocio inconsistente.')
    const savedAt=new Date().toISOString(), contextId=page.items[0]?.contextId??references.value?.contextId
    await mergeContributionHistory(o,page.items)
    await saveFinanceReferences(o,{members,savedAt,...(contextId?{contextId}:{})})
    if(!visible(o))return
    lastFetchedAt.value=savedAt;nextCursor.value=page.nextCursor;await load()
  }
  async function create(fields:Pick<ContributionPayload,'memberId'|'amountMinor'|'occurredAt'|'note'>){
    const o=origin();if(!o)throw new Error('Solo socios pueden administrar aportaciones.')
    const payload={...fields,id:v7(),createdByMemberId:o.memberId,deviceId:o.deviceId}
    await enqueueContribution(o,{kind:'create',payload});await load();schedule(0);return payload.id
  }
  async function reverse(contributionId:string,reason:string,replacement?:Pick<ContributionPayload,'memberId'|'amountMinor'|'occurredAt'|'note'>){
    const o=origin();if(!o)throw new Error('Solo socios pueden administrar aportaciones.')
    const payload:ReversalPayload={id:v7(),createdByMemberId:o.memberId,deviceId:o.deviceId,occurredAt:new Date().toISOString(),reason,...(replacement?{replacement:{...replacement,id:v7(),createdByMemberId:o.memberId,deviceId:o.deviceId}}:{})}
    await enqueueContribution(o,{kind:'reverse',contributionId,payload});await load();schedule(0)
  }
  async function sync(){
    const o=origin();if(!o || syncing.value || !navigator.onLine)return
    syncing.value=true
    try {await syncContributions(o,ContributionsService.send,{online:()=>navigator.onLine,canSend:(r)=>!!origin()&&canSendDebt(r)});await load();error.value=''}
    catch {error.value='No se pudo acceder a los registros locales. No cierres ni borres los datos del navegador.'}
    finally{syncing.value=false}
  }
  async function retry(record:PendingContribution){if(!origin()||!canSendDebt(record.origin))throw new Error('Recupera la cuenta y el dispositivo originales antes de reintentar.');await retryContribution(record);await load();schedule(0)}
  function schedule(delay=30000){
    if(timer)clearTimeout(timer)
    if(!started||!origin()||!navigator.onLine)return
    const candidates=pending.value.filter(r=>r.state==='pending'&&canSendDebt(r.origin))
    if(!candidates.length)return
    const wait=delay===0?0:Math.max(1000,Math.min(...candidates.map(r=>Math.max(0,r.nextAttemptAt-Date.now())))||30000)
    timer=setTimeout(async()=>{await sync();schedule()},wait)
  }
  async function start(){if(started)return;started=true;window.addEventListener('online',online);try{await load();await sync()}finally{schedule()}}
  function stop(){started=false;if(timer)clearTimeout(timer);timer=undefined;window.removeEventListener('online',online)}
  function online(){schedule(0)}
  async function sessionChanged(){clear();if(started){try{await load();schedule(0)}catch{error.value='No se pudieron cargar los registros locales.'}}}
  const members=computed(()=>references.value?.members.filter(m=>m.role==='socio'&&m.active)??[])
  return {history,pending,references,members,syncing,error,lastFetchedAt,nextCursor,load,refresh,create,reverse,retry,sync,start,stop,sessionChanged}
})
