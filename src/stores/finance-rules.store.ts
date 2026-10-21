import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { FinanceRulesService } from '@/services/finance-rules.service'
import { currentQueueOrigin } from '@/services/queue-origin'
import { rulesErrorMessage, rulesStateText } from '@/utils/finance-rules'
import { useAuthStore } from './auth.store'
import { useSessionStore } from './session.store'
import type { FinanceOrigin } from '@/services/contributions-records'
import type { FinanceRulesConfig, ResendResult, RulesOverview, SubmitResult } from '@/types/finance-rules.types'

const sameOrigin = (a: FinanceOrigin | null, b: FinanceOrigin): boolean => !!a &&
  a.accountId === b.accountId && a.apiBase === b.apiBase && a.memberId === b.memberId && a.deviceId === b.deviceId

const ACCESS_MESSAGE = 'Confirma la sesión, la persona socia y el dispositivo antes de continuar.'
const OFFLINE_MESSAGE = 'Necesitas conexión para consultar o cambiar las reglas de reparto.'

/** Online-only and memory-only: the server owns the rules, this store only mirrors what it answers. */
export const useFinanceRulesStore = defineStore('finance-rules', () => {
  const auth = useAuthStore()
  const session = useSessionStore()
  const overview = ref<RulesOverview | null>(null)
  const loading = ref(false)
  const error = ref('')
  const working = ref(false)
  const actionError = ref('')
  /** Who the emails reached after the last "Enviar", and who they did not. */
  const submitted = ref<SubmitResult['emails'] | null>(null)
  const resent = ref<ResendResult | null>(null)
  /** The masked address a confirmation email was just sent to. */
  const correoSentTo = ref('')
  let revision = 0

  const stateText = computed(() => (overview.value ? rulesStateText(overview.value) : null))

  function origin(): FinanceOrigin | null {
    if (!auth.token || session.member?.role !== 'socio' || session.member.active !== true) return null
    const current = currentQueueOrigin()
    return current ? { ...current } : null
  }
  const online = () => navigator.onLine

  async function load(): Promise<void> {
    const mine = ++revision
    const selected = origin()
    error.value = ''
    if (!selected || !online()) {
      error.value = selected ? OFFLINE_MESSAGE : ACCESS_MESSAGE
      return
    }
    loading.value = true
    try {
      const data = await FinanceRulesService.overview(selected)
      if (mine === revision && sameOrigin(origin(), selected)) overview.value = data
    } catch (cause) {
      if (mine === revision) error.value = rulesErrorMessage(cause)
    } finally {
      if (mine === revision) loading.value = false
    }
  }

  /** Runs one change, then reads the overview again so the screen shows what the server decided. */
  async function change<T>(action: (selected: FinanceOrigin) => Promise<T>): Promise<T | null> {
    const selected = origin()
    actionError.value = ''
    if (!selected || !online()) {
      actionError.value = selected ? OFFLINE_MESSAGE : ACCESS_MESSAGE
      return null
    }
    working.value = true
    try {
      const result = await action(selected)
      await load()
      return result
    } catch (cause) {
      actionError.value = rulesErrorMessage(cause)
      // A refused change usually means the screen is stale: refresh it.
      await load()
      return null
    } finally {
      working.value = false
    }
  }

  const saveDraft = (config: FinanceRulesConfig) => change((o) => FinanceRulesService.saveDraft(o, config))
  const discard = (id: string) => change((o) => FinanceRulesService.discard(o, id))
  const modify = (id: string) => change((o) => FinanceRulesService.modify(o, id))
  async function submit(id: string): Promise<SubmitResult | null> {
    const result = await change((o) => FinanceRulesService.submit(o, id))
    submitted.value = result?.emails ?? null
    return result
  }
  async function resend(id: string): Promise<ResendResult | null> {
    const result = await change((o) => FinanceRulesService.resend(o, id))
    resent.value = result
    return result
  }
  /** Asks for the confirmation email of the caller's own address. */
  async function requestCorreo(correo: string): Promise<boolean> {
    const result = await change((o) => FinanceRulesService.requestCorreo(o, correo))
    correoSentTo.value = result?.correo ?? ''
    return result !== null
  }

  /** The notices of one action belong to that action only: a new proposal starts without them. */
  function clearNotices() {
    submitted.value = null
    resent.value = null
    correoSentTo.value = ''
    actionError.value = ''
  }

  function reset() {
    revision++
    overview.value = null
    error.value = ''
    actionError.value = ''
    submitted.value = null
    resent.value = null
    correoSentTo.value = ''
    loading.value = false
    working.value = false
  }

  return {
    overview, loading, error, working, actionError, submitted, resent, correoSentTo, stateText,
    load, saveDraft, discard, modify, submit, resend, requestCorreo, clearNotices, reset,
  }
})
