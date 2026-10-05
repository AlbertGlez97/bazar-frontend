<template>
  <section
    v-if="allowed"
    class="finance-page"
  >
    <TabNav
      label="Secciones de Finanzas"
      :tabs="FINANCE_TABS"
      active="/app/finanzas/gastos"
    />
    <header>
      <p>Finanzas</p>
      <h1>Gastos</h1>
      <p>
        Registra lo que se gastó o se compró para el negocio, quién lo pagó y de
        dónde salió el dinero. Un gasto no es una aportación y una compra de
        inventario no cambia tus productos ni tus existencias.
      </p>
    </header>
    <p
      v-if="message"
      role="status"
    >
      {{ message }}
    </p>
    <p
      v-if="error || finance.error"
      role="alert"
    >
      {{ error || finance.error }}
    </p>

    <AppCard title="Registrar gasto">
      <form
        data-test="create-form"
        class="finance-form"
        @submit.prevent="submitCreate"
      >
        <ExpenseFormFields
          v-model="form"
          id-prefix="expense"
          :payers="finance.payers"
          :disabled="saving"
        />
        <p v-if="!finance.payers.length">
          No hay miembros disponibles en este dispositivo. Conéctate una vez
          para cargar el equipo.
        </p>
        <AppButton
          type="submit"
          :loading="saving"
          :disabled="!finance.payers.length"
        >
          Registrar gasto
        </AppButton>
      </form>
    </AppCard>

    <AppCard title="Resumen del periodo">
      <div
        v-if="summaryView.values"
        class="finance-summary"
        data-test="summary"
      >
        <AppStatCard
          label="Gastos operativos"
          :value="formatMinorMoney(summaryView.values.operatingMinor)"
        />
        <AppStatCard
          label="Compras de inventario"
          :value="formatMinorMoney(summaryView.values.inventoryMinor)"
          tone="info"
        />
        <AppStatCard
          label="Pagado con dinero personal"
          :value="formatMinorMoney(summaryView.values.personalMinor)"
          tone="warning"
        />
        <AppStatCard
          label="Pagado con fondos del negocio"
          :value="formatMinorMoney(summaryView.values.businessMinor)"
          tone="success"
        />
      </div>
      <p class="finance-freshness">
        {{ summaryView.note }}
      </p>
    </AppCard>

    <AppCard title="Gastos registrados">
      <ReportRangePicker
        :from="range.from"
        :to="range.to"
        :preset="preset"
        :max="today"
        :error="rangeError"
        :disabled="loading"
        @select-preset="selectPreset"
        @update:from="onFrom"
        @update:to="onTo"
        @apply="fetchHistory(false)"
      />
      <div class="finance-filters">
        <AppSelect
          id="expense-filter-nature"
          v-model="filterNature"
          label="Tipo"
        >
          <option value="">
            Todos
          </option>
          <option value="OPERATING_EXPENSE">
            {{ NATURE_LABELS.OPERATING_EXPENSE }}
          </option>
          <option value="INVENTORY_PURCHASE">
            {{ NATURE_LABELS.INVENTORY_PURCHASE }}
          </option>
        </AppSelect>
        <AppSelect
          id="expense-filter-category"
          v-model="filterCategory"
          label="Categoría"
        >
          <option value="">
            Todas
          </option>
          <option
            v-for="(label, code) in CATEGORY_LABELS"
            :key="code"
            :value="code"
          >
            {{ label }}
          </option>
        </AppSelect>
        <AppSelect
          id="expense-filter-member"
          v-model="filterMember"
          label="Pagado por"
        >
          <option value="">
            Todos
          </option>
          <option
            v-for="member in finance.allMembers"
            :key="member.id"
            :value="member.id"
          >
            {{ member.name }}{{ member.active ? '' : ' (inactivo)' }}
          </option>
        </AppSelect>
      </div>
      <p class="finance-freshness">
        Registros guardados en esta cuenta y API.
        {{
          finance.references
            ? `Equipo actualizado: ${formatBusinessDateTime(finance.references.savedAt)}.`
            : 'Sin copia del equipo.'
        }}
        La lista conserva lo consultado; sin conexión puede estar incompleta.
      </p>
      <p v-if="!rows.length">
        No hay gastos guardados para este periodo y estos filtros.
      </p>
      <ul class="finance-list">
        <li
          v-for="row in rows"
          :key="row.id"
          class="finance-row"
          data-test="expense-row"
        >
          <div>
            <h3>{{ CATEGORY_LABELS[row.category] }}</h3>
            <strong>{{ formatMinorMoney(row.amountMinor) }}</strong>
            <p>
              {{ formatBusinessDate(row.occurredAt) }} ·
              {{ NATURE_LABELS[row.nature] }}
            </p>
            <p>
              Pagó {{ payerName(row) }} · Origen:
              {{ FUNDS_SOURCE_LABELS[row.fundsSource] }}
            </p>
            <p :title="row.description">
              {{ shorten(row.description) }}
            </p>
          </div>
          <div class="finance-actions">
            <AppBadge :color="statusColor(row)">
              {{ statusLabel(row) }}
            </AppBadge>
            <AppBadge
              v-if="row.reversal"
              color="gray"
            >
              {{ row.reversal.replacementExpenseId ? 'Corregido' : 'Anulado' }}
            </AppBadge>
            <p v-if="row.reversal">
              {{ row.reversal.reason }}
            </p>
            <p v-if="row.correction">
              Corrección
              {{
                row.correction.state === 'pending'
                  ? 'pendiente'
                  : 'requiere revisión'
              }}: {{ row.correction.payload.reason }}
            </p>
            <p
              v-if="row.pending?.lastError || row.correction?.lastError"
              role="status"
            >
              {{ row.pending?.lastError || row.correction?.lastError }}
            </p>
            <AppButton
              v-if="row.pending && row.pending.state !== 'pending'"
              variant="ghost"
              :disabled="saving"
              @click="retry(row.pending)"
            >
              Reintentar con el origen original
            </AppButton>
            <AppButton
              v-if="row.correction && row.correction.state !== 'pending'"
              variant="ghost"
              :disabled="saving"
              @click="retry(row.correction)"
            >
              Reintentar corrección
            </AppButton>
            <template
              v-if="
                !row.reversal &&
                  !row.correction &&
                  (!row.pending || row.pending.state === 'pending')
              "
            >
              <AppButton
                variant="ghost"
                size="sm"
                @click="openCorrection(row, true)"
              >
                Corregir
              </AppButton><AppButton
                variant="ghost"
                size="sm"
                @click="openCorrection(row, false)"
              >
                Anular
              </AppButton>
            </template>
          </div>
        </li>
      </ul>
      <AppButton
        v-if="finance.nextCursor && cursorFilter === filterSignature"
        variant="ghost"
        :loading="loading"
        @click="fetchHistory(true)"
      >
        Cargar más
      </AppButton>
    </AppCard>

    <AppModal
      v-model="correctionOpen"
      manage-focus
      :title="replace ? 'Corregir gasto' : 'Anular gasto'"
      subtitle="El registro original se conserva. No se mueve dinero ni inventario."
      :hide-close="saving"
      :close-on-backdrop="!saving"
    >
      <form
        id="correction-form"
        class="finance-form"
        @submit.prevent="submitCorrection"
      >
        <AppTextarea
          id="correction-reason"
          v-model="reason"
          label="Motivo"
          maxlength="1000"
          required
          :disabled="saving"
        />
        <ExpenseFormFields
          v-if="replace"
          v-model="correctionForm"
          id-prefix="correction"
          :payers="finance.payers"
          :disabled="saving"
        />
        <p
          v-if="correctionError"
          role="alert"
        >
          {{ correctionError }}
        </p>
      </form>
      <template #footer>
        <AppButton
          variant="ghost"
          :disabled="saving"
          @click="correctionOpen = false"
        >
          Cancelar
        </AppButton><AppButton
          type="submit"
          form="correction-form"
          :loading="saving"
        >
          Guardar corrección
        </AppButton>
      </template>
    </AppModal>
  </section>
  <p v-else>
    Solo socios pueden administrar gastos en Gestión.
  </p>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  AppBadge,
  AppButton,
  AppCard,
  AppModal,
  AppSelect,
  AppStatCard,
  AppTextarea,
  ExpenseFormFields,
  ReportRangePicker,
  TabNav,
} from '@/components'
import { useUiModeStore } from '@/stores/uiMode.store'
import { useSessionStore } from '@/stores/session.store'
import { useExpensesStore } from '@/stores/expenses.store'
import {
  addDaysToKey,
  businessDayOf,
  businessToday,
  formatBusinessDate,
  formatBusinessDateTime,
  presetRange,
  validateRange,
  type RangePreset,
} from '@/utils/business-time'
import { formatMinorMoney } from '@/utils/money'
import {
  CATEGORY_LABELS,
  FUNDS_SOURCE_LABELS,
  NATURE_LABELS,
} from '@/utils/expense-catalog'
import {
  ExpenseFormError,
  emptyExpenseForm,
  expenseFieldsFromForm,
  formFromExpense,
  type ExpenseFormState,
} from '@/utils/expense-form'
import { localExpenseSummary } from '@/utils/expense-summary'
import { FINANCE_TABS } from './finance-tabs'
import type { Expense, ExpensePayload } from '@/types/expense.types'
import type { PendingExpense } from '@/services/expense-records'

const session = useSessionStore(),
  finance = useExpensesStore()
const mode = useUiModeStore()
const allowed = computed(
  () => session.member?.role === 'socio' && mode.currentMode === 'gestion',
)

const today = ref(businessToday())
const form = ref<ExpenseFormState>(emptyExpenseForm(today.value))
const saving = ref(false),
  loading = ref(false),
  message = ref(''),
  error = ref('')

// ── Period and filters ────────────────────────────────────────────────────
const initial = presetRange('mes')
const range = reactive({ from: initial.from, to: initial.to })
const preset = ref<RangePreset | null>('mes')
const filterNature = ref(''),
  filterCategory = ref(''),
  filterMember = ref(''),
  cursorFilter = ref('')
const filterSignature = computed(() =>
  JSON.stringify([
    range.from,
    range.to,
    filterNature.value,
    filterCategory.value,
    filterMember.value,
  ]),
)
const rangeError = computed(() => {
  const problem = validateRange(range.from, range.to, today.value)
  return problem === 'incomplete'
    ? 'Escribe las dos fechas para consultar los gastos.'
    : problem === 'inverted'
      ? 'La fecha inicial es posterior a la final. Cámbialas para consultar.'
      : problem === 'future'
        ? 'La fecha final no puede ser de mañana en adelante. Elige hasta hoy.'
        : undefined
})
function selectPreset(next: RangePreset) {
  const value = presetRange(next)
  range.from = value.from
  range.to = value.to
  preset.value = next
  void fetchHistory(false)
}
function onFrom(value: string) {
  range.from = value
  preset.value = null
}
function onTo(value: string) {
  range.to = value
  preset.value = null
}

// ── Rows: confirmed history merged with what is still pending ─────────────
type Row = ExpensePayload & {
  reversal?: Expense['reversal']
  paidByMember?: Expense['paidByMember']
  pending?: PendingExpense
  correction?: Extract<PendingExpense, { kind: 'reverse' }>
}
const allRows = computed<Row[]>(() => {
  if (!allowed.value) return []
  const map = new Map<string, Row>(finance.history.map((r) => [r.id, { ...r }]))
  for (const op of finance.pending)
    if (op.kind === 'create') {
      const existing = map.get(op.id)
      if (existing) existing.pending = op
      else map.set(op.id, { ...op.payload, pending: op })
    }
  for (const op of finance.pending)
    if (op.kind === 'reverse') {
      const row = map.get(op.expenseId)
      if (row) row.correction = op
    }
  return [...map.values()].sort(
    (a, b) =>
      b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id),
  )
})
const periodRows = computed(() =>
  allRows.value.filter((r) => {
    const day = businessDayOf(r.occurredAt)
    return (!range.from || day >= range.from) && (!range.to || day <= range.to)
  }),
)
const rows = computed(() =>
  periodRows.value.filter(
    (r) =>
      (!filterNature.value || r.nature === filterNature.value) &&
      (!filterCategory.value || r.category === filterCategory.value) &&
      (!filterMember.value || r.paidByMemberId === filterMember.value),
  ),
)

// ── Summary: server figures when online, local ones only if consistent ────
const summaryView = computed(() => {
  const fromServer = finance.summary
  const queued = periodRows.value.filter(
    (r) => r.pending?.state === 'pending',
  ).length
  if (
    fromServer &&
    fromServer.from === rangeIso().from &&
    fromServer.to === rangeIso().to
  )
    return {
      values: fromServer.value,
      note:
        'Totales del servidor, sin gastos anulados.' +
        (queued
          ? ` No incluyen ${queued} registro(s) pendientes de sincronizar.`
          : ''),
    }
  const local = localExpenseSummary(
    periodRows.value.map((r) => ({
      amountMinor: r.amountMinor,
      nature: r.nature,
      fundsSource: r.fundsSource,
      occurredAt: r.occurredAt,
      reversed: !!r.reversal,
      correctionQueued: !!r.correction,
      uncertain:
        (!!r.pending && r.pending.state !== 'pending') ||
        (!!r.correction && r.correction.state !== 'pending'),
    })),
    range.from,
    range.to,
  )
  return local
    ? {
        values: local,
        note: 'Calculado con los registros guardados en este dispositivo; puede estar incompleto hasta conectarte.',
      }
    : {
        values: null,
        note: 'No se muestran totales: hay gastos que requieren revisión o están en pausa. Resuélvelos o conéctate para consultar el resumen.',
      }
})

function rangeIso() {
  return {
    from: `${range.from}T00:00:00-06:00`,
    to: `${addDaysToKey(range.to, 1)}T00:00:00-06:00`,
  }
}

function payerName(row: Row) {
  return (
    finance.allMembers.find((m) => m.id === row.paidByMemberId)?.name ??
    row.paidByMember?.name ??
    'Miembro (referencia histórica)'
  )
}
function shorten(text: string) {
  return text.length > 80 ? `${text.slice(0, 79)}…` : text
}
function statusLabel(row: Row) {
  if (!row.pending) return 'Sincronizado'
  return row.pending.state === 'pending'
    ? 'Pendiente'
    : row.pending.state === 'paused'
      ? 'En pausa'
      : 'Requiere revisión'
}
function statusColor(row: Row) {
  return !row.pending ? 'green' : row.pending.state === 'pending' ? 'amber' : 'red'
}

// ── Create ─────────────────────────────────────────────────────────────────
async function submitCreate() {
  if (saving.value || !allowed.value) return
  error.value = ''
  message.value = ''
  saving.value = true
  try {
    await finance.create(expenseFieldsFromForm(form.value, finance.payers))
    // Keep type, payer and origin for the next entry: they usually repeat.
    form.value = {
      ...emptyExpenseForm(form.value.date),
      nature: form.value.nature,
      category: form.value.category,
      paidByMemberId: form.value.paidByMemberId,
      fundsSource: form.value.fundsSource,
    }
    message.value =
      'Gasto guardado en este dispositivo. Se sincronizará con su origen original.'
  } catch (e) {
    error.value =
      e instanceof ExpenseFormError
        ? e.message
        : 'No se pudo guardar el gasto. No se registró éxito; conserva los datos e intenta nuevamente.'
  } finally {
    saving.value = false
  }
}

async function fetchHistory(more = false) {
  if (!allowed.value || loading.value) return
  error.value = ''
  if (rangeError.value) return
  loading.value = true
  const { from, to } = rangeIso()
  try {
    await Promise.all([
      finance.refresh({
        from,
        to,
        ...(filterMember.value ? { paidByMemberId: filterMember.value } : {}),
        ...(filterNature.value
          ? { nature: filterNature.value as Expense['nature'] }
          : {}),
        ...(filterCategory.value
          ? { category: filterCategory.value as Expense['category'] }
          : {}),
        ...(more && finance.nextCursor ? { cursor: finance.nextCursor } : {}),
        limit: 50,
      }),
      more ? Promise.resolve() : finance.refreshSummary({ from, to }),
    ])
    cursorFilter.value = filterSignature.value
  } catch {
    error.value =
      'No se pudo actualizar. Se muestra la copia local disponible; puede estar incompleta.'
  } finally {
    loading.value = false
  }
}

// ── Correction (annul or replace) ──────────────────────────────────────────
const correctionOpen = ref(false),
  replace = ref(false),
  selectedId = ref(''),
  reason = ref(''),
  correctionForm = ref<ExpenseFormState>(emptyExpenseForm(today.value)),
  correctionError = ref('')
function openCorrection(row: Row, replacement: boolean) {
  selectedId.value = row.id
  replace.value = replacement
  reason.value = ''
  correctionForm.value = formFromExpense(row)
  correctionError.value = ''
  correctionOpen.value = true
}
async function submitCorrection() {
  if (saving.value || !allowed.value) return
  saving.value = true
  correctionError.value = ''
  message.value = ''
  try {
    if (!reason.value.trim() || reason.value.length > 1000)
      throw new ExpenseFormError('Indica un motivo válido.')
    // A deactivated payer is not selectable: the server only accepts active members.
    const replacement = replace.value
      ? expenseFieldsFromForm(correctionForm.value, finance.payers)
      : undefined
    await finance.reverse(selectedId.value, reason.value, replacement)
    correctionOpen.value = false
    message.value =
      'Corrección guardada. El registro original se conserva; no se mueve dinero ni inventario.'
  } catch (e) {
    correctionError.value =
      e instanceof ExpenseFormError
        ? e.message
        : 'No se pudo guardar la corrección.'
  } finally {
    saving.value = false
  }
}
async function retry(record: PendingExpense) {
  error.value = ''
  try {
    await finance.retry(record)
  } catch {
    error.value =
      'No se pudo reintentar. Recupera la cuenta y el dispositivo originales.'
  }
}

watch(allowed, (value) => {
  if (!value) {
    correctionOpen.value = false
    message.value = ''
    error.value = ''
  }
})
onMounted(async () => {
  if (!allowed.value) return
  try {
    await finance.load()
    await fetchHistory()
  } catch {
    error.value =
      'No se pudo acceder al almacenamiento local. No se registrarán gastos sin guardarlos.'
  }
})
</script>

<style scoped>
.finance-page {
  display: grid;
  gap: 1.25rem;
  max-width: 1100px;
  margin: 0 auto;
  min-width: 0;
}
.finance-form,
.finance-filters {
  display: grid;
  gap: 1rem;
}
.finance-filters {
  margin-top: 1rem;
}
.finance-form > *,
.finance-filters > * {
  min-width: 0;
}
.finance-summary {
  display: grid;
  gap: 1rem;
}
.finance-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}
.finance-row {
  display: grid;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--color-border);
  overflow-wrap: anywhere;
}
.finance-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.finance-actions p {
  flex-basis: 100%;
}
.finance-freshness {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin-top: 1rem;
}
@media (min-width: 640px) {
  .finance-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .finance-filters {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .finance-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}
@media (min-width: 1024px) {
  .finance-summary {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
