<template>
  <section
    v-if="allowed"
    class="finance-page"
  >
    <header>
      <p>Finanzas</p>
      <h1>Aportaciones</h1>
      <p>
        Una aportación no es una venta, no es utilidad, no determina propiedad y
        no implica recuperación automática.
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
    <AppCard title="Registrar aportación">
      <form
        data-test="create-form"
        class="finance-form"
        @submit.prevent="submitCreate"
      >
        <AppSelect
          id="contribution-member"
          v-model="memberId"
          label="Socio"
          placeholder="Selecciona un socio"
          :disabled="saving || !finance.members.length"
          required
        >
          <option
            v-for="member in finance.members"
            :key="member.id"
            :value="member.id"
          >
            {{ member.name }}
          </option>
        </AppSelect>
        <AppInput
          id="contribution-amount"
          v-model="amount"
          label="Cantidad"
          inputmode="decimal"
          placeholder="$ 8,000.00"
          :disabled="saving"
          required
        />
        <AppInput
          id="contribution-date"
          v-model="date"
          label="Fecha"
          type="date"
          :disabled="saving"
          required
        />
        <AppTextarea
          id="contribution-note"
          v-model="note"
          label="Nota (opcional)"
          maxlength="1000"
          :disabled="saving"
        />
        <p v-if="!finance.members.length">
          No hay socios disponibles en este dispositivo. Conéctate una vez para
          cargar el equipo.
        </p>
        <AppButton
          type="submit"
          :loading="saving"
          :disabled="!finance.members.length"
        >
          Registrar aportación
        </AppButton>
      </form>
    </AppCard>
    <AppCard title="Aportaciones registradas">
      <form
        class="finance-filters"
        @submit.prevent="fetchHistory(false)"
      >
        <AppInput
          id="finance-from"
          v-model="from"
          label="Desde"
          type="date"
        />
        <AppInput
          id="finance-to"
          v-model="to"
          label="Hasta (inclusive)"
          type="date"
        />
        <AppSelect
          id="finance-member-filter"
          v-model="filterMember"
          label="Socio"
        >
          <option value="">
            Todos
          </option>
          <option
            v-for="member in finance.references?.members.filter(
              (m) => m.role === 'socio',
            ) ?? finance.members"
            :key="member.id"
            :value="member.id"
          >
            {{ member.name }}
          </option>
        </AppSelect>
        <AppButton
          type="submit"
          :loading="loading"
        >
          Actualizar
        </AppButton>
      </form>
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
        No hay aportaciones guardadas para este periodo.
      </p>
      <ul class="finance-list">
        <li
          v-for="row in rows"
          :key="row.id"
          class="finance-row"
        >
          <div>
            <h3>{{ memberName(row.memberId) }}</h3>
            <strong>${{ minorToDisplay(row.amountMinor) }}</strong>
            <p>{{ formatBusinessDate(row.occurredAt) }}</p>
            <p v-if="row.note">
              {{ row.note }}
            </p>
          </div>
          <div class="finance-actions">
            <AppBadge
              :color="
                row.pending
                  ? row.pending.state === 'pending'
                    ? 'amber'
                    : 'red'
                  : 'green'
              "
            >
              {{
                row.pending
                  ? row.pending.state === 'pending'
                    ? 'Pendiente'
                    : 'Requiere revisión'
                  : 'Sincronizada'
              }}
            </AppBadge>
            <AppBadge
              v-if="row.reversal"
              color="gray"
            >
              {{
                row.reversal.replacementContributionId ? 'Corregida' : 'Anulada'
              }}
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
      :title="replace ? 'Corregir aportación' : 'Anular aportación'"
      subtitle="Solo corrige el registro. No devuelve capital."
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
        <template v-if="replace">
          <AppSelect
            id="correction-member"
            v-model="correctionMember"
            label="Socio"
            required
            :disabled="saving"
          >
            <option
              v-for="member in finance.members"
              :key="member.id"
              :value="member.id"
            >
              {{ member.name }}
            </option>
          </AppSelect><AppInput
            id="correction-amount"
            v-model="correctionAmount"
            label="Cantidad correcta"
            inputmode="decimal"
            required
            :disabled="saving"
          /><AppInput
            id="correction-date"
            v-model="correctionDate"
            label="Fecha correcta"
            type="date"
            required
            :disabled="saving"
          /><AppTextarea
            v-model="correctionNote"
            label="Nota (opcional)"
            maxlength="1000"
            :disabled="saving"
          />
        </template>
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
    Solo socios pueden administrar aportaciones en Gestión.
  </p>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  AppButton,
  AppInput,
  AppSelect,
  AppTextarea,
  AppModal,
  AppCard,
  AppBadge,
} from '@/components'
import { useUiModeStore } from '@/stores/uiMode.store'
import { useSessionStore } from '@/stores/session.store'
import { useContributionsStore } from '@/stores/contributions.store'
import {
  businessToday,
  businessDayOf,
  addDaysToKey,
  isValidDateKey,
  formatBusinessDate,
  formatBusinessDateTime,
} from '@/utils/business-time'
import { parseMoneyText, minorToDisplay } from '@/utils/money'
import type {
  Contribution,
  ContributionPayload,
} from '@/types/contribution.types'
import type { PendingContribution } from '@/services/contributions-records'
const session = useSessionStore(),
  finance = useContributionsStore()
const mode = useUiModeStore()
const allowed = computed(
  () => session.member?.role === 'socio' && mode.currentMode === 'gestion',
)
const memberId = ref(''),
  amount = ref(''),
  date = ref(businessToday()),
  note = ref(''),
  saving = ref(false),
  loading = ref(false),
  message = ref(''),
  error = ref('')
const from = ref(businessToday().slice(0, 7) + '-01'),
  to = ref(businessToday()),
  filterMember = ref(''),
  cursorFilter = ref('')
const filterSignature = computed(() =>
  JSON.stringify([from.value, to.value, filterMember.value]),
)
type Row = ContributionPayload & {
  reversal?: Contribution['reversal']
  pending?: PendingContribution
  correction?: Extract<PendingContribution, { kind: 'reverse' }>
}
const rows = computed(() => {
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
      const row = map.get(op.contributionId)
      if (row) row.correction = op
    }
  return [...map.values()]
    .filter(
      (r) =>
        (!filterMember.value || r.memberId === filterMember.value) &&
        (!from.value || businessDayOf(r.occurredAt) >= from.value) &&
        (!to.value || businessDayOf(r.occurredAt) <= to.value),
    )
    .sort(
      (a, b) =>
        b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id),
    )
})
function memberName(id: string) {
  return (
    finance.references?.members.find((m) => m.id === id)?.name ??
    finance.members.find((m) => m.id === id)?.name ??
    finance.history.find((r) => r.memberId === id)?.member?.name ??
    'Socio (referencia histórica)'
  )
}
function fields(member: string, value: string, day: string, text: string) {
  const amountMinor = parseMoneyText(value)
  if (
    !finance.members.some((m) => m.id === member) ||
    amountMinor === null ||
    amountMinor < 1 ||
    amountMinor > 2147483647 ||
    !isValidDateKey(day) ||
    text.length > 1000
  )
    throw new Error(
      'Selecciona un socio, una cantidad válida mayor a cero y una fecha válida.',
    )
  return {
    memberId: member,
    amountMinor,
    occurredAt: `${day}T00:00:00-06:00`,
    note: text || undefined,
  }
}
async function submitCreate() {
  if (saving.value || !allowed.value) return
  error.value = ''
  message.value = ''
  saving.value = true
  try {
    await finance.create(
      fields(memberId.value, amount.value, date.value, note.value),
    )
    amount.value = ''
    note.value = ''
    message.value =
      'Aportación guardada en este dispositivo. Se sincronizará con su origen original.'
  } catch (e) {
    error.value =
      e instanceof Error && e.message.startsWith('Selecciona')
        ? e.message
        : 'No se pudo guardar la aportación. No se registró éxito; conserva los datos e intenta nuevamente.'
  } finally {
    saving.value = false
  }
}
async function fetchHistory(more = false) {
  if (!allowed.value || loading.value) return
  error.value = ''
  loading.value = true
  try {
    if (
      !isValidDateKey(from.value) ||
      !isValidDateKey(to.value) ||
      from.value > to.value
    )
      throw new Error('Rango inválido')
    await finance.refresh({
      from: `${from.value}T00:00:00-06:00`,
      to: `${addDaysToKey(to.value, 1)}T00:00:00-06:00`,
      ...(filterMember.value ? { memberId: filterMember.value } : {}),
      ...(more && finance.nextCursor ? { cursor: finance.nextCursor } : {}),
      limit: 50,
    })
    cursorFilter.value = filterSignature.value
  } catch {
    error.value =
      'No se pudo actualizar. Se muestra la copia local disponible; puede estar incompleta.'
  } finally {
    loading.value = false
  }
}
const correctionOpen = ref(false),
  replace = ref(false),
  selectedId = ref(''),
  reason = ref(''),
  correctionMember = ref(''),
  correctionAmount = ref(''),
  correctionDate = ref(''),
  correctionNote = ref(''),
  correctionError = ref('')
function openCorrection(row: Row, replacement: boolean) {
  selectedId.value = row.id
  replace.value = replacement
  reason.value = ''
  correctionMember.value = row.memberId
  correctionAmount.value = minorToDisplay(row.amountMinor)
  correctionDate.value = businessDayOf(row.occurredAt)
  correctionNote.value = row.note ?? ''
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
      throw new Error('Indica un motivo válido.')
    const replacement = replace.value
      ? fields(
          correctionMember.value,
          correctionAmount.value,
          correctionDate.value,
          correctionNote.value,
        )
      : undefined
    await finance.reverse(selectedId.value, reason.value, replacement)
    correctionOpen.value = false
    message.value =
      'Corrección guardada. El registro original se conserva; no se devuelve capital.'
  } catch (e) {
    correctionError.value =
      e instanceof Error ? e.message : 'No se pudo guardar la corrección.'
  } finally {
    saving.value = false
  }
}
async function retry(record: PendingContribution) {
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
    memberId.value = finance.members[0]?.id ?? ''
    await fetchHistory()
    if (!memberId.value) memberId.value = finance.members[0]?.id ?? ''
  } catch {
    error.value =
      'No se pudo acceder al almacenamiento local. No se registrarán aportaciones sin guardarlas.'
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
.finance-form > *,
.finance-filters > * {
  min-width: 0;
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
  .finance-form,
  .finance-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .finance-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}
@media (min-width: 1024px) {
  .finance-filters {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-items: end;
  }
}
</style>
