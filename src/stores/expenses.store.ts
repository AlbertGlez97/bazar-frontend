import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v7 } from 'uuid'
import { useSessionStore } from './session.store'
import { currentQueueOrigin, canSendDebt } from '@/services/queue-origin'
import {
  enqueueExpense,
  expenseSnapshot,
  mergeExpenseHistory,
  retryExpense,
} from '@/services/expense-db'
import { saveFinanceReferences } from '@/services/contributions-db'
import { syncExpenses } from '@/services/expense-sync'
import { ExpensesService } from '@/services/expenses.service'
import { ContributionsService } from '@/services/contributions.service'
import { financeScope } from '@/services/contributions-records'
import { isMember } from '@/utils/member'
import type {
  Expense,
  ExpenseFields,
  ExpenseFilter,
  ExpensePayload,
  ExpenseReversalPayload,
  ExpenseSummary,
} from '@/types/expense.types'
import type {
  FinanceOrigin,
  FinanceReferences,
} from '@/services/contributions-records'
import type { PendingExpense } from '@/services/expense-records'

const LOCAL_WRITE_WARNING =
  'El gasto se guardó, pero no se pudo actualizar la lista local.'

export const useExpensesStore = defineStore('expenses', () => {
  const session = useSessionStore()
  const history = ref<Expense[]>([]),
    pending = ref<PendingExpense[]>([]),
    references = ref<FinanceReferences | null>(null)
  const syncing = ref(false),
    error = ref(''),
    lastFetchedAt = ref<string | null>(null),
    nextCursor = ref<string | null>(null),
    summary = ref<{ key: string; value: ExpenseSummary } | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined,
    started = false,
    activeScope: string | null = null

  function origin(): FinanceOrigin | null {
    if (session.member?.role !== 'socio') return null
    const current = currentQueueOrigin()
    if (!current) return null
    const scope = financeScope(current)
    return {
      ...current,
      ...(activeScope === scope && references.value?.contextId
        ? { contextId: references.value.contextId }
        : {}),
    }
  }
  function clear() {
    history.value = []
    pending.value = []
    references.value = null
    summary.value = null
    lastFetchedAt.value = null
    nextCursor.value = null
    activeScope = null
  }
  function visible(o: FinanceOrigin) {
    const current = origin()
    return (
      !!current &&
      financeScope(current) === financeScope(o) &&
      current.deviceId === o.deviceId
    )
  }
  async function load() {
    const o = origin()
    if (!o) {
      clear()
      return
    }
    if (activeScope !== financeScope(o)) clear()
    const data = await expenseSnapshot(o)
    if (!visible(o)) return
    activeScope = financeScope(o)
    history.value = data.history
    pending.value = data.pending
    references.value = data.references ?? null
  }
  async function refresh(filter: ExpenseFilter = {}) {
    const o = origin()
    if (!o) throw new Error('Solo socios pueden administrar gastos.')
    const [page, members] = await Promise.all([
      ExpensesService.list(o, filter),
      ContributionsService.members(o),
    ])
    if (!visible(o)) return
    if (!Array.isArray(members) || !members.every(isMember))
      throw new Error('No se pudo validar el equipo del negocio.')
    const contexts = new Set(page.items.map((r) => r.contextId))
    if (contexts.size > 1) throw new Error('Respuesta de negocio inconsistente.')
    const savedAt = new Date().toISOString(),
      contextId = page.items[0]?.contextId ?? references.value?.contextId
    await mergeExpenseHistory(o, page.items)
    await saveFinanceReferences(o, {
      members,
      savedAt,
      ...(contextId ? { contextId } : {}),
    })
    if (!visible(o)) return
    await load() // may reset per-scope state, so set the freshness afterwards
    if (!visible(o)) return
    lastFetchedAt.value = savedAt
    nextCursor.value = page.nextCursor
  }
  /** Online summary for a period; `null` result means "use the local figures". */
  async function refreshSummary(range: { from: string; to: string }) {
    const o = origin()
    if (!o || !navigator.onLine) {
      summary.value = null
      return null
    }
    const key = JSON.stringify([financeScope(o), range.from, range.to])
    try {
      const value = await ExpensesService.summary(o, range)
      if (!visible(o)) return null
      summary.value = { key, value }
      return summary.value
    } catch {
      summary.value = null
      return null
    }
  }

  async function enqueue(operation: Parameters<typeof enqueueExpense>[1]) {
    const o = origin()
    if (!o) throw new Error('Solo socios pueden administrar gastos.')
    const record = await enqueueExpense(o, operation)
    if (visible(o)) {
      activeScope = financeScope(o)
      pending.value = [
        ...pending.value.filter((r) => r.id !== record.id),
        record,
      ]
    }
    try {
      await load()
    } catch {
      error.value = LOCAL_WRITE_WARNING
    }
    schedule(0)
  }
  function payloadFrom(o: FinanceOrigin, fields: ExpenseFields): ExpensePayload {
    return {
      ...fields,
      id: v7(),
      createdByMemberId: o.memberId,
      deviceId: o.deviceId,
    }
  }
  /** Persists to IndexedDB first; resolves only after the durable write. */
  async function create(fields: ExpenseFields) {
    const o = origin()
    if (!o) throw new Error('Solo socios pueden administrar gastos.')
    const payload = payloadFrom(o, fields)
    await enqueue({ kind: 'create', payload })
    return payload.id
  }
  async function reverse(
    expenseId: string,
    reason: string,
    replacement?: ExpenseFields,
  ) {
    const o = origin()
    if (!o) throw new Error('Solo socios pueden administrar gastos.')
    const payload: ExpenseReversalPayload = {
      id: v7(),
      createdByMemberId: o.memberId,
      deviceId: o.deviceId,
      occurredAt: new Date().toISOString(),
      reason,
      ...(replacement ? { replacement: payloadFrom(o, replacement) } : {}),
    }
    await enqueue({ kind: 'reverse', expenseId, payload })
  }
  async function sync() {
    const o = origin()
    if (!o || syncing.value || !navigator.onLine) return
    syncing.value = true
    try {
      await syncExpenses(o, ExpensesService.send, {
        online: () => navigator.onLine,
        canSend: (r) => !!origin() && canSendDebt(r),
      })
      await load()
      error.value = ''
    } catch {
      error.value =
        'No se pudo acceder a los registros locales. No cierres ni borres los datos del navegador.'
    } finally {
      syncing.value = false
    }
  }
  async function retry(record: PendingExpense) {
    if (!origin() || !canSendDebt(record.origin))
      throw new Error(
        'Recupera la cuenta y el dispositivo originales antes de reintentar.',
      )
    await retryExpense(record)
    await load()
    schedule(0)
  }
  function schedule(delay = 30000) {
    if (timer) clearTimeout(timer)
    if (!started || !origin() || !navigator.onLine) return
    const candidates = pending.value.filter(
      (r) => r.state === 'pending' && canSendDebt(r.origin),
    )
    if (!candidates.length) return
    const wait =
      delay === 0
        ? 0
        : Math.max(
            1000,
            Math.min(
              ...candidates.map((r) => Math.max(0, r.nextAttemptAt - Date.now())),
            ) || 30000,
          )
    timer = setTimeout(async () => {
      await sync()
      schedule()
    }, wait)
  }
  async function start() {
    if (started) return
    started = true
    window.addEventListener('online', online)
    try {
      await load()
      await sync()
    } finally {
      schedule()
    }
  }
  function stop() {
    started = false
    if (timer) clearTimeout(timer)
    timer = undefined
    window.removeEventListener('online', online)
  }
  function online() {
    schedule(0)
  }
  async function sessionChanged() {
    clear()
    if (started) {
      try {
        await load()
        schedule(0)
      } catch {
        error.value = 'No se pudieron cargar los registros locales.'
      }
    }
  }
  /** Any active member of the business can be the payer. */
  const payers = computed(
    () => references.value?.members.filter((m) => m.active) ?? [],
  )
  /** Every known member, including inactive ones, for historical names and filters. */
  const allMembers = computed(() => references.value?.members ?? [])
  return {
    history,
    pending,
    references,
    payers,
    allMembers,
    syncing,
    error,
    lastFetchedAt,
    nextCursor,
    summary,
    load,
    refresh,
    refreshSummary,
    create,
    reverse,
    retry,
    sync,
    start,
    stop,
    sessionChanged,
  }
})
