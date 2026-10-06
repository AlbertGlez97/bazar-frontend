<template>
  <section
    v-if="allowed"
    class="finance-page"
  >
    <TabNav
      label="Secciones de Finanzas"
      :tabs="FINANCE_TABS"
      active="/app/finanzas/jornadas"
    />
    <header>
      <p>Finanzas</p>
      <h1>Jornadas</h1>
      <p>
        Registra el trabajo real de cada persona: quién trabajó, qué día y, si
        lo sabes, cuánto tiempo. Una jornada no es una venta ni un pago: solo
        deja constancia del trabajo y no calcula dinero.
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

    <AppCard title="Registrar jornada">
      <form
        data-test="create-form"
        class="finance-form"
        @submit.prevent="submitCreate"
      >
        <AppSelect
          id="work-shift-member"
          v-model="form.memberId"
          label="Quién trabajó"
          placeholder="Selecciona a la persona"
          :disabled="saving || !finance.workers.length"
          required
        >
          <option
            v-for="member in finance.workers"
            :key="member.id"
            :value="member.id"
          >
            {{ member.name }}
          </option>
        </AppSelect>
        <AppInput
          id="work-shift-date"
          v-model="form.workDate"
          label="Fecha"
          type="date"
          :disabled="saving"
          required
        />
        <DurationInput
          v-model:hours="form.hours"
          v-model:minutes="form.minutes"
          id-prefix="work-shift-duration"
          :disabled="saving"
        />
        <AppTextarea
          id="work-shift-note"
          v-model="form.note"
          class="finance-form__wide"
          label="Nota (opcional)"
          :maxlength="WORK_SHIFT_NOTE_MAX"
          :disabled="saving"
        />
        <p v-if="!finance.workers.length">
          No hay miembros disponibles en este dispositivo. Conéctate una vez
          para cargar el equipo.
        </p>
        <AppButton
          type="submit"
          :loading="saving"
          :disabled="!finance.workers.length"
        >
          Registrar jornada
        </AppButton>
      </form>
    </AppCard>

    <AppCard title="Resumen del periodo">
      <div
        v-if="summaryView.values"
        data-test="summary"
      >
        <div class="finance-summary">
          <AppStatCard
            label="Jornadas"
            :value="String(summaryView.values.totals.shiftCount)"
          />
          <AppStatCard
            label="Tiempo registrado"
            :value="formatRegisteredMinutes(summaryView.values.totals.knownMinutes)"
            tone="info"
          />
          <AppStatCard
            label="Sin duración"
            :value="String(summaryView.values.totals.unknownDurationCount)"
            tone="warning"
          />
        </div>
        <p
          v-if="!summaryView.values.members.length"
          class="finance-freshness"
        >
          No hay jornadas en este periodo.
        </p>
        <ul class="finance-list">
          <li
            v-for="entry in summaryView.values.members"
            :key="entry.memberId"
            class="finance-row finance-row--summary"
            data-test="summary-member"
          >
            <h3>{{ summaryName(entry) }}</h3>
            <p>{{ describeWorkShiftTotals(entry) }}</p>
          </li>
        </ul>
      </div>
      <p class="finance-freshness">
        {{ summaryView.note }}
      </p>
    </AppCard>

    <AppCard title="Jornadas registradas">
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
          id="work-shift-filter-member"
          v-model="filterMember"
          label="Persona"
        >
          <option value="">
            Todas
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
        No hay jornadas guardadas para este periodo y este filtro.
      </p>
      <ul class="finance-list">
        <li
          v-for="row in rows"
          :key="row.id"
          class="finance-row"
          data-test="work-shift-row"
        >
          <div>
            <h3>{{ memberName(row) }}</h3>
            <p>{{ formatDateKey(row.workDate) }}</p>
            <strong>{{ formatDuration(row.minutes) }}</strong>
            <p
              v-if="row.note"
              :title="row.note"
            >
              {{ shorten(row.note) }}
            </p>
            <p
              v-if="sameDayWarning(row)"
              role="status"
              data-test="same-day-warning"
            >
              {{ sameDayWarning(row) }}
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
              {{ row.reversal.replacementWorkShiftId ? 'Corregida' : 'Anulada' }}
            </AppBadge>
            <p
              v-if="row.pending?.lastError"
              role="status"
            >
              {{ row.pending.lastError }}
            </p>
            <AppButton
              v-if="row.pending && row.pending.state !== 'pending'"
              variant="ghost"
              :disabled="saving"
              @click="retry(row.pending)"
            >
              Reintentar con el origen original
            </AppButton>
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
  </section>
  <p v-else>
    Solo socios pueden administrar jornadas en Gestión.
  </p>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  AppBadge,
  AppButton,
  AppCard,
  AppInput,
  AppSelect,
  AppStatCard,
  AppTextarea,
  DurationInput,
  ReportRangePicker,
  TabNav,
} from '@/components'
import { useUiModeStore } from '@/stores/uiMode.store'
import { useSessionStore } from '@/stores/session.store'
import { useWorkShiftsStore } from '@/stores/work-shifts.store'
import {
  addDaysToKey,
  businessToday,
  formatBusinessDateTime,
  formatDateKey,
  presetRange,
  validateRange,
  type RangePreset,
} from '@/utils/business-time'
import {
  WorkShiftFormError,
  formatDuration,
  formatRegisteredMinutes,
} from '@/utils/work-shift-duration'
import {
  WORK_SHIFT_NOTE_MAX,
  emptyWorkShiftForm,
  workShiftFieldsFromForm,
  type WorkShiftFormState,
} from '@/utils/work-shift-form'
import {
  describeWorkShiftTotals,
  localWorkShiftSummary,
} from '@/utils/work-shift-summary'
import { FINANCE_TABS } from './finance-tabs'
import type {
  WorkShift,
  WorkShiftMemberSummary,
  WorkShiftPayload,
} from '@/types/work-shift.types'
import type { PendingWorkShift } from '@/services/work-shift-records'

const session = useSessionStore(),
  finance = useWorkShiftsStore()
const mode = useUiModeStore()
const allowed = computed(
  () => session.member?.role === 'socio' && mode.currentMode === 'gestion',
)

const today = ref(businessToday())
const form = ref<WorkShiftFormState>(emptyWorkShiftForm(today.value))
const saving = ref(false),
  loading = ref(false),
  message = ref(''),
  error = ref('')

// ── Period and filter ─────────────────────────────────────────────────────
const initial = presetRange('mes')
const range = reactive({ from: initial.from, to: initial.to })
const preset = ref<RangePreset | null>('mes')
const filterMember = ref(''),
  cursorFilter = ref('')
const filterSignature = computed(() =>
  JSON.stringify([range.from, range.to, filterMember.value]),
)
const rangeError = computed(() => {
  const problem = validateRange(range.from, range.to, today.value)
  return problem === 'incomplete'
    ? 'Escribe las dos fechas para consultar las jornadas.'
    : problem === 'inverted'
      ? 'La fecha inicial es posterior a la final. Cámbialas para consultar.'
      : problem === 'future'
        ? 'La fecha final no puede ser de mañana en adelante. Elige hasta hoy.'
        : undefined
})
/** Calendar dates: `from` is inclusive and `to` is exclusive (the day after the last one shown). */
const toExclusive = computed(() =>
  range.to && !rangeError.value ? addDaysToKey(range.to, 1) : '',
)
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
type Row = WorkShiftPayload & {
  warnings?: WorkShift['warnings']
  member?: WorkShift['member']
  reversal?: WorkShift['reversal']
  pending?: PendingWorkShift
}
const allRows = computed<Row[]>(() => {
  if (!allowed.value) return []
  const map = new Map<string, Row>(finance.history.map((r) => [r.id, { ...r }]))
  for (const op of finance.pending) {
    const existing = map.get(op.id)
    if (existing) existing.pending = op
    else map.set(op.id, { ...op.payload, pending: op })
  }
  return [...map.values()].sort(
    (a, b) => b.workDate.localeCompare(a.workDate) || b.id.localeCompare(a.id),
  )
})
const periodRows = computed(() =>
  allRows.value.filter(
    (r) =>
      (!range.from || r.workDate >= range.from) &&
      (!toExclusive.value || r.workDate < toExclusive.value),
  ),
)
const rows = computed(() =>
  periodRows.value.filter(
    (r) => !filterMember.value || r.memberId === filterMember.value,
  ),
)

// ── Summary: server figures when online, local ones only if consistent ────
const summaryView = computed(() => {
  const fromServer = finance.summary
  const queued = rows.value.filter((r) => r.pending?.state === 'pending').length
  if (
    fromServer &&
    fromServer.from === range.from &&
    fromServer.to === toExclusive.value &&
    fromServer.memberId === filterMember.value
  )
    return {
      values: fromServer.value,
      note:
        'Totales del servidor, sin jornadas anuladas. Las horas suman solo las duraciones registradas.' +
        (queued
          ? ` No incluyen ${queued} registro(s) pendientes de sincronizar.`
          : ''),
    }
  const local = localWorkShiftSummary(
    allRows.value.map((r) => ({
      memberId: r.memberId,
      workDate: r.workDate,
      minutes: r.minutes,
      reversed: !!r.reversal,
      uncertain: !!r.pending && r.pending.state !== 'pending',
    })),
    range.from,
    toExclusive.value,
    filterMember.value,
  )
  return local && !rangeError.value
    ? {
        values: local,
        note: 'Calculado con los registros guardados en este dispositivo; puede estar incompleto hasta conectarte. Las horas suman solo las duraciones registradas.',
      }
    : {
        values: null,
        note: rangeError.value
          ? 'Elige un periodo válido para ver el resumen.'
          : 'No se muestran totales: hay jornadas que requieren revisión o están en pausa. Resuélvelas o conéctate para consultar el resumen.',
      }
})

function nameOf(memberId: string, fallback?: string) {
  return (
    finance.allMembers.find((m) => m.id === memberId)?.name ??
    fallback ??
    'Miembro (referencia histórica)'
  )
}
const memberName = (row: Row) => nameOf(row.memberId, row.member?.name)
const summaryName = (entry: WorkShiftMemberSummary) =>
  nameOf(entry.memberId, entry.member?.name)
function shorten(text: string) {
  return text.length > 120 ? `${text.slice(0, 119)}…` : text
}
function statusLabel(row: Row) {
  if (!row.pending) return 'Sincronizada'
  return row.pending.state === 'pending'
    ? 'Pendiente'
    : row.pending.state === 'paused'
      ? 'En pausa'
      : 'Requiere revisión'
}
function statusColor(row: Row) {
  return !row.pending ? 'green' : row.pending.state === 'pending' ? 'amber' : 'red'
}
/** Only from the real receipt: a list never carries it, so nothing is inferred. */
function sameDayWarning(row: Row) {
  const warning = row.warnings?.find((w) => w.code === 'MULTIPLE_SHIFTS_SAME_DAY')
  if (!warning) return ''
  return warning.existingActiveShiftCount === 1
    ? 'Aviso: ese día ya había otra jornada registrada para esta persona. Se guardaron las dos.'
    : `Aviso: ese día ya había ${warning.existingActiveShiftCount} jornadas registradas para esta persona. Se guardaron todas.`
}

// ── Create ─────────────────────────────────────────────────────────────────
async function submitCreate() {
  if (saving.value || !allowed.value) return
  error.value = ''
  message.value = ''
  saving.value = true
  try {
    await finance.create(
      workShiftFieldsFromForm(form.value, finance.workers),
    )
    // Keep the date for the next entry: several people are usually registered for one day.
    form.value = emptyWorkShiftForm(form.value.workDate)
    message.value =
      'Jornada guardada en este dispositivo. Se sincronizará con su origen original.'
  } catch (e) {
    error.value =
      e instanceof WorkShiftFormError
        ? e.message
        : 'No se pudo guardar la jornada. No se registró éxito; conserva los datos e intenta nuevamente.'
  } finally {
    saving.value = false
  }
}

async function fetchHistory(more = false) {
  if (!allowed.value || loading.value) return
  error.value = ''
  if (rangeError.value) return
  loading.value = true
  const from = range.from,
    to = toExclusive.value
  try {
    await Promise.all([
      finance.refresh({
        from,
        to,
        ...(filterMember.value ? { memberId: filterMember.value } : {}),
        ...(more && finance.nextCursor ? { cursor: finance.nextCursor } : {}),
        limit: 50,
      }),
      more
        ? Promise.resolve()
        : finance.refreshSummary({
            from,
            to,
            ...(filterMember.value ? { memberId: filterMember.value } : {}),
          }),
    ])
    cursorFilter.value = filterSignature.value
  } catch {
    error.value =
      'No se pudo actualizar. Se muestra la copia local disponible; puede estar incompleta.'
  } finally {
    loading.value = false
  }
}
async function retry(record: PendingWorkShift) {
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
      'No se pudo acceder al almacenamiento local. No se registrarán jornadas sin guardarlas.'
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
  .finance-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .finance-form__wide,
  .finance-form > p,
  .finance-form > button {
    grid-column: 1 / -1;
  }
  .finance-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .finance-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .finance-row:not(.finance-row--summary) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}
@media (min-width: 1024px) {
  .finance-filters {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
