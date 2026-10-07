<template>
  <section
    v-if="allowed"
    class="reserves-page"
    data-test="reserves-page"
  >
    <TabNav
      label="Secciones de Finanzas"
      :tabs="FINANCE_TABS"
      active="/app/finanzas/reservas"
    />
    <header>
      <p>Finanzas</p>
      <h1>Reservas</h1>
      <p>
        Una reserva es un monto que planeas apartar de un periodo para un fin,
        por ejemplo cubrir un gasto futuro. Es solo un plan: no mueve dinero ni
        es efectivo apartado. No se edita: si algo cambia, anúlala y crea una
        nueva.
      </p>
    </header>

    <AppCard>
      <ReportRangePicker
        :from="range.from"
        :to="range.to"
        :preset="preset"
        :max="today"
        :error="rangeError"
        :disabled="finance.loading || finance.saving"
        @select-preset="selectPreset"
        @update:from="onFrom"
        @update:to="onTo"
        @apply="refresh"
      />
      <p
        class="reserves-muted"
        data-test="exact-note"
      >
        Solo las reservas creadas para exactamente este período se restan del
        monto potencialmente disponible.
      </p>
    </AppCard>

    <div
      ref="statusBox"
      class="reserves-status"
      tabindex="-1"
      aria-live="polite"
      data-test="status"
    >
      <p
        v-if="finance.savedName"
        data-test="saved"
      >
        Reserva guardada: {{ finance.savedName }}. Se resta del monto potencialmente disponible del período {{ savedPeriod }}.
      </p>
      <p
        v-if="finance.cancelledName"
        data-test="cancelled"
      >
        Reserva anulada: {{ finance.cancelledName }}.
      </p>
    </div>

    <div class="reserves-layout">
      <section
        class="reserves-block"
        aria-labelledby="rs-form"
        data-test="form-section"
      >
        <h2 id="rs-form">
          Nueva reserva
        </h2>
        <form
          class="reserves-form"
          novalidate
          data-test="create-form"
          @submit.prevent="submit"
        >
          <AppInput
            id="reserve-name"
            v-model="form.name"
            label="Nombre"
            :maxlength="RESERVE_NAME_MAX"
            :disabled="finance.saving"
            required
          />
          <CashInput
            id="reserve-amount"
            v-model="form.amount"
            label="Importe"
            :show-pad="false"
            :disabled="finance.saving"
          />
          <div
            class="reserves-period"
            data-test="form-period"
          >
            <p class="reserves-period__label">
              Período de la reserva
            </p>
            <p class="reserves-period__value">
              {{ appliedText }}
            </p>
            <p class="reserves-muted">
              Se toma del período elegido arriba.
            </p>
            <p
              v-if="periodPending"
              class="reserves-muted"
              role="status"
              data-test="period-pending"
            >
              Cambiaste las fechas: pulsa Actualizar para usarlas en la reserva.
            </p>
          </div>
          <AppTextarea
            id="reserve-note"
            v-model="form.note"
            label="Nota (opcional)"
            :rows="2"
            :maxlength="RESERVE_NOTE_MAX"
            :disabled="finance.saving"
          />
          <p
            v-if="formError || finance.saveError"
            role="alert"
            class="reserves-error"
            data-test="form-error"
          >
            {{ formError || finance.saveError }}
          </p>
          <AppButton
            type="submit"
            :loading="finance.saving"
            :disabled="!applied"
            data-test="save"
          >
            Guardar reserva
          </AppButton>
        </form>
      </section>

      <section
        class="reserves-block"
        aria-labelledby="rs-list"
        data-test="list-section"
      >
        <h2 id="rs-list">
          Reservas registradas
        </h2>

        <div class="reserves-filters">
          <div
            role="group"
            aria-label="Períodos a mostrar"
            class="reserves-segment"
          >
            <button
              type="button"
              class="reserves-segment__item"
              :class="{ 'reserves-segment__item--active': scope === 'period' }"
              :aria-pressed="scope === 'period' ? 'true' : 'false'"
              data-test="scope-period"
              @click="scope = 'period'"
            >
              Solo este período
            </button>
            <button
              type="button"
              class="reserves-segment__item"
              :class="{ 'reserves-segment__item--active': scope === 'all' }"
              :aria-pressed="scope === 'all' ? 'true' : 'false'"
              data-test="scope-all"
              @click="scope = 'all'"
            >
              Todos los períodos
            </button>
          </div>
          <AppSelect
            id="reserve-status"
            v-model="status"
            label="Estado"
            data-test="status-filter"
          >
            <option value="active">
              Activas
            </option>
            <option value="reversed">
              Anuladas
            </option>
          </AppSelect>
        </div>

        <AppAlert
          v-if="finance.error"
          type="error"
          title="No se pudo actualizar la lista"
        >
          <p>{{ finance.error }}</p>
          <p v-if="finance.shown">
            Se conserva la última lista cargada; puede estar desactualizada.
          </p>
          <AppButton
            variant="ghost"
            :disabled="finance.loading"
            data-test="retry"
            @click="refresh"
          >
            Reintentar
          </AppButton>
        </AppAlert>

        <div
          v-if="finance.loading && !finance.shown"
          class="reserves-skeleton"
          data-test="skeleton"
          role="status"
          aria-label="Cargando las reservas"
        >
          <AppSkeleton
            v-for="n in 3"
            :key="n"
            height="5rem"
            rounded
          />
        </div>
        <p
          v-else-if="finance.shown && !finance.items.length && !finance.error"
          class="reserves-empty"
          data-test="empty"
        >
          {{ emptyText }}
        </p>
        <template v-else-if="finance.shown">
          <p
            v-if="finance.loading"
            class="reserves-muted"
            role="status"
          >
            Actualizando las reservas…
          </p>
          <ul
            class="reserves-list"
            data-test="reserve-list"
          >
            <ReserveCard
              v-for="item in finance.items"
              :key="item.id"
              :item="item"
              :matching="isCounted(item)"
              :busy="finance.cancelling && cancelId === item.id"
              :error="cancelId === item.id ? finance.cancelError : ''"
              @cancel="(reason: string) => cancelReserve(item, reason)"
            />
          </ul>
          <AppButton
            v-if="finance.nextCursor"
            variant="ghost"
            :loading="finance.loadingMore"
            data-test="load-more"
            @click="finance.loadMore()"
          >
            Cargar más
          </AppButton>

          <div
            v-if="showTotals"
            class="reserves-totals"
            data-test="totals"
          >
            <p data-test="total-period">
              Total reservas de este período: <strong>{{ formatMinorMoney(periodTotal) }}</strong>
            </p>
            <p
              v-if="otherTotal > 0"
              class="reserves-muted"
              data-test="total-other"
            >
              Reservas activas de otros períodos (no cuentan en este período, no se suman): {{ formatMinorMoney(otherTotal) }}
            </p>
            <p
              v-if="finance.nextCursor"
              class="reserves-muted"
            >
              Hay más reservas por cargar: el total solo suma las que ya ves.
            </p>
          </div>
        </template>
      </section>
    </div>
  </section>
  <p v-else>
    Solo socios pueden administrar reservas en Gestión.
  </p>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  AppAlert,
  AppButton,
  AppCard,
  AppInput,
  AppSelect,
  AppSkeleton,
  AppTextarea,
  CashInput,
  ReportRangePicker,
  TabNav,
} from '@/components'
import { useUiModeStore } from '@/stores/uiMode.store'
import { useSessionStore } from '@/stores/session.store'
import { useFinanceReservesStore } from '@/stores/finance-reserves.store'
import {
  businessToday,
  isValidDateKey,
  presetRange,
  validateRange,
  type RangePreset,
} from '@/utils/business-time'
import { formatMinorMoney } from '@/utils/money'
import {
  RESERVE_NAME_MAX,
  RESERVE_NOTE_MAX,
  ReserveFormError,
  emptyReserveForm,
  formatPickedPeriod,
  matchesRange,
  plannedTotalForRange,
  reserveFieldsFromForm,
  type ReservePeriod,
} from '@/utils/finance-reserves'
import { FINANCE_TABS } from './finance-tabs'
import ReserveCard from './components/ReserveCard.vue'
import type { ReserveListItem, ReserveStatus } from '@/types/finance-reserve.types'

const session = useSessionStore(),
  mode = useUiModeStore(),
  finance = useFinanceReservesStore()
const route = useRoute()
const allowed = computed(
  () => session.member?.role === 'socio' && mode.currentMode === 'gestion',
)

const today = ref(businessToday())

/** The overview can link here with the period it was showing (`?from=&to=`). */
function linkedRange(): ReservePeriod | null {
  const from = route?.query?.from
  const to = route?.query?.to
  if (typeof from !== 'string' || typeof to !== 'string') return null
  if (!isValidDateKey(from) || !isValidDateKey(to)) return null
  return validateRange(from, to, today.value) ? null : { from, to }
}
const linked = linkedRange()
const initial = linked ?? presetRange('mes')
const range = reactive({ from: initial.from, to: initial.to })
const preset = ref<RangePreset | null>(linked ? null : 'mes')
const rangeError = computed(() => {
  const problem = validateRange(range.from, range.to, today.value)
  return problem === 'incomplete'
    ? 'Escribe las dos fechas para consultar las reservas.'
    : problem === 'inverted'
      ? 'La fecha inicial es posterior a la final. Cámbialas para consultar.'
      : problem === 'future'
        ? 'La fecha final no puede ser de mañana en adelante. Elige hasta hoy.'
        : undefined
})

/** Period the list shows and new reserves are created for (changes only when applied). */
const applied = ref<ReservePeriod | null>(null)
const appliedText = computed(() => (applied.value ? formatPickedPeriod(applied.value) : 'Elige un período válido arriba.'))
const periodPending = computed(
  () => !!applied.value && (applied.value.from !== range.from || applied.value.to !== range.to),
)

const scope = ref<'period' | 'all'>('period')
const status = ref<ReserveStatus>('active')

const form = ref(emptyReserveForm())
const formError = ref('')
const statusBox = ref<HTMLElement | null>(null)
const cancelId = ref('')
const savedPeriod = ref('')

function refresh() {
  if (!allowed.value || rangeError.value) return
  applied.value = { from: range.from, to: range.to }
  void finance.load({ range: { ...applied.value }, scope: scope.value, status: status.value })
}
function selectPreset(next: RangePreset) {
  const value = presetRange(next)
  range.from = value.from
  range.to = value.to
  preset.value = next
  refresh()
}
function onFrom(value: string) {
  range.from = value
  preset.value = null
}
function onTo(value: string) {
  range.to = value
  preset.value = null
}

const isCounted = (item: ReserveListItem) => !!applied.value && !!finance.shown && matchesRange(item, finance.shown.range)

const shownRange = computed(() => finance.shown?.range ?? null)
const showTotals = computed(() => !!shownRange.value && finance.shown?.status === 'active')
const periodTotal = computed(() => (shownRange.value ? plannedTotalForRange(finance.items, shownRange.value) : 0))
const otherTotal = computed(() => {
  const shown = shownRange.value
  if (!shown) return 0
  return finance.items
    .filter((i) => i.status === 'active' && !matchesRange(i, shown))
    .reduce((sum, i) => sum + i.amountMinor, 0)
})
const emptyText = computed(() => {
  const state = finance.shown?.status === 'reversed' ? 'anuladas' : 'activas'
  return finance.shown?.scope === 'all'
    ? `No hay reservas ${state} en ningún período.`
    : `No hay reservas ${state} para este período.`
})

async function focusStatus() {
  await nextTick()
  statusBox.value?.focus()
}

async function submit() {
  formError.value = ''
  finance.clearMessages()
  if (!applied.value) {
    formError.value = 'Elige un período válido arriba.'
    return
  }
  try {
    const fields = reserveFieldsFromForm(form.value, applied.value)
    if (await finance.create(fields)) {
      savedPeriod.value = formatPickedPeriod(applied.value)
      form.value = emptyReserveForm()
      await focusStatus()
    }
  } catch (e) {
    if (!(e instanceof ReserveFormError)) throw e
    formError.value = e.message
  }
}

async function cancelReserve(item: ReserveListItem, reason: string) {
  cancelId.value = item.id
  finance.clearMessages()
  if (await finance.cancel(item, reason)) await focusStatus()
}

// One request per filter change; the period itself is applied by the picker.
watch([scope, status], () => refresh())
watch(allowed, (value) => {
  if (value) refresh()
  else finance.reset()
})
onMounted(refresh)
</script>

<style scoped>
.reserves-page {
  display: grid;
  gap: 1.25rem;
  max-width: 1100px;
  margin: 0 auto;
  min-width: 0;
}
.reserves-page h2 {
  margin: 0;
  font-size: var(--font-size-lg);
}
.reserves-layout {
  display: grid;
  gap: 1.25rem;
  align-items: start;
}
.reserves-layout > * {
  min-width: 0;
}
.reserves-block {
  display: grid;
  gap: var(--spacing-md);
  align-content: start;
  padding: var(--spacing-md);
  background: var(--color-surface-alt);
  border-radius: var(--radius-lg);
}
.reserves-form,
.reserves-list,
.reserves-skeleton,
.reserves-totals {
  display: grid;
  gap: var(--spacing-md);
}
.reserves-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.reserves-status {
  display: grid;
  gap: var(--spacing-xs);
}
.reserves-status:empty {
  display: none;
}
.reserves-status p,
.reserves-totals p {
  margin: 0;
}
.reserves-muted {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.reserves-error {
  margin: 0;
  color: var(--color-danger);
}
.reserves-empty {
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--color-text-muted);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}
.reserves-period {
  display: grid;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.reserves-period p {
  margin: 0;
}
.reserves-period__label {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.reserves-period__value {
  font-weight: 700;
}
.reserves-filters {
  display: grid;
  gap: var(--spacing-sm);
}
.reserves-segment {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}
.reserves-segment__item {
  min-height: 2.75rem;
  padding: 0 var(--spacing-md);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}
.reserves-segment__item--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  font-weight: 600;
}
@media (min-width: 768px) {
  .reserves-layout {
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  }
}
</style>
