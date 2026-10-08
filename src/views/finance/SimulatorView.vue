<template>
  <section
    v-if="allowed"
    class="sim-page"
    data-test="simulator-page"
  >
    <TabNav
      label="Secciones de Finanzas"
      :tabs="FINANCE_TABS"
      active="/app/finanzas/simulador"
    />
    <header>
      <p>Finanzas</p>
      <h1>Simulador de reparto</h1>
      <p>
        Prueba cómo se dividiría un monto del período entre las personas del
        equipo según una regla. Solo calcula: no guarda nada, no registra
        pagos, retiros ni movimientos de dinero.
      </p>
    </header>

    <div class="sim-layout">
      <div
        ref="configBox"
        class="sim-column"
        data-test="config"
      >
        <AppCard>
          <h2 class="sim-title">
            Período
          </h2>
          <ReportRangePicker
            :from="range.from"
            :to="range.to"
            :preset="preset"
            :error="rangeError"
            :disabled="store.simulating || store.baseLoading"
            @select-preset="selectPreset"
            @update:from="onFrom"
            @update:to="onTo"
            @apply="refresh"
          />
          <p
            class="sim-muted"
            data-test="exact-note"
          >
            Solo las reservas creadas para exactamente este período se restan
            del monto potencialmente disponible.
          </p>
          <p
            v-if="periodPending"
            class="sim-muted"
            role="status"
            data-test="period-pending"
          >
            Cambiaste las fechas: pulsa Actualizar para usarlas en la simulación.
          </p>
        </AppCard>

        <form
          class="sim-form"
          novalidate
          data-test="sim-form"
          @submit.prevent="calculate"
        >
          <section
            class="sim-block"
            aria-labelledby="sim-base-title"
            data-test="base-step"
          >
            <h2 id="sim-base-title">
              Base financiera
            </h2>
            <AppAlert
              v-if="store.baseError"
              type="error"
              title="No se pudo consultar el monto disponible"
            >
              <p>{{ store.baseError }}</p>
              <p v-if="store.baseIsStale">
                Se muestra el último monto confirmado; puede estar desactualizado.
              </p>
              <AppButton
                v-if="store.baseRetryable"
                variant="ghost"
                type="button"
                :disabled="store.baseLoading"
                data-test="base-retry"
                @click="refresh"
              >
                Reintentar
              </AppButton>
            </AppAlert>
            <p
              v-if="store.baseLoading"
              class="sim-muted"
              role="status"
              data-test="base-loading"
            >
              Consultando el monto potencialmente disponible…
            </p>
            <OverviewFigure
              v-if="baseForPeriod"
              label="Monto potencialmente disponible"
              :minor="baseForPeriod.potentiallyAvailableMinor"
              :partial="baseForPeriod.status === 'partial'"
              prominent
              data-test="base-figure"
            />
            <p
              v-else-if="!applied"
              class="sim-muted"
            >
              Elige un período válido arriba.
            </p>
            <p
              class="sim-muted"
              data-test="base-note"
            >
              Este monto proviene del resultado operativo registrado después de
              reservas. No representa necesariamente efectivo disponible.
            </p>
            <p
              v-if="baseForPeriod?.status === 'partial'"
              class="sim-warning"
              data-test="base-partial"
            >
              {{ PARTIAL_RESULT_COPY }}
            </p>
          </section>

          <section
            class="sim-block"
            aria-labelledby="sim-amount-title"
            data-test="amount-step"
          >
            <h2 id="sim-amount-title">
              Cuánto quiero simular
            </h2>
            <CashInput
              id="sim-amount"
              v-model="amountText"
              label="Monto a simular"
              :show-pad="false"
              :description-id="maxMinor !== null ? 'sim-amount-hint' : undefined"
              :disabled="store.simulating"
            />
            <p
              v-if="maxMinor !== null"
              id="sim-amount-hint"
              class="sim-muted"
              data-test="amount-max"
            >
              Máximo: {{ formatMinorMoney(maxMinor) }}
            </p>
            <p
              v-if="amountMessage"
              class="sim-error"
              role="alert"
              data-test="amount-error"
            >
              {{ amountMessage }}
            </p>
          </section>

          <SimulatorRuleForm
            v-model:partner-text="partnerText"
            v-model:work-text="workText"
            v-model:basis="basis"
            :disabled="store.simulating"
          />

          <p
            v-if="store.error"
            class="sim-error"
            role="alert"
            data-test="sim-error"
          >
            {{ store.error }}
          </p>
          <AppButton
            type="submit"
            :loading="store.simulating"
            :disabled="!canCalculate"
            data-test="calculate"
          >
            Calcular simulación
          </AppButton>
        </form>
      </div>

      <div
        class="sim-column"
        aria-live="polite"
        data-test="result-region"
      >
        <section
          class="sim-block sim-result"
          aria-labelledby="sim-result-title"
          data-test="result-section"
        >
          <h2
            id="sim-result-title"
            ref="resultHeading"
            tabindex="-1"
          >
            Resultado de la simulación
          </h2>

          <template v-if="result">
            <p
              v-if="resultIsStale"
              class="sim-stale"
              role="status"
              data-test="stale-note"
            >
              Resultado de una configuración anterior
            </p>
            <p
              class="sim-disclaimer"
              data-test="disclaimer"
            >
              {{ SIMULATION_DISCLAIMER }}
            </p>
            <AppAlert
              v-if="partialResult"
              type="warning"
              title="Resultado financiero parcial"
              data-test="partial-alert"
            >
              <p>{{ PARTIAL_RESULT_COPY }}</p>
            </AppAlert>

            <p
              class="sim-muted"
              data-test="result-period"
            >
              Período: {{ formatReservePeriod(result.period.from, result.period.to) }}
            </p>
            <div class="sim-figures">
              <OverviewFigure
                label="Monto simulado"
                :minor="result.financialBase.requestedAmountMinor"
                :partial="partialResult"
                prominent
                data-test="fig-requested"
              />
              <OverviewFigure
                label="Componente socios"
                :minor="result.pools.partnerPoolMinor"
                data-test="fig-partner"
              />
              <OverviewFigure
                label="Componente trabajo"
                :minor="result.pools.workPoolMinor"
                data-test="fig-work"
              />
            </div>
            <ul class="sim-facts">
              <li data-test="result-rule">
                Regla usada: {{ ruleSummary(result.rule) }}
              </li>
              <li data-test="result-base">
                Monto potencialmente disponible del período: {{ formatMinorMoney(result.financialBase.potentiallyAvailableMinor) }}.
                Restaría potencialmente: {{ formatMinorMoney(result.financialBase.remainingAvailableMinor) }}.
              </li>
            </ul>

            <h3 class="sim-subtitle">
              Por persona
            </h3>
            <p
              v-if="!result.members.length"
              class="sim-muted"
            >
              Este resultado no incluye personas.
            </p>
            <ul
              v-else
              class="sim-members"
              data-test="members"
            >
              <SimulatorMemberResult
                v-for="member in result.members"
                :key="member.memberId"
                :member="member"
                :members="result.members"
                :basis="result.rule.workBasis"
              />
            </ul>

            <div
              class="sim-totals"
              data-test="totals"
            >
              <p>
                Total simulado:
                <strong data-test="distributed-total">{{ formatMinorMoney(result.totals.distributedMinor) }}</strong>
              </p>
              <p
                v-if="result.totals.undistributedMinor !== 0"
                class="sim-muted"
                data-test="undistributed"
              >
                Sin asignar en la simulación: {{ formatMinorMoney(result.totals.undistributedMinor) }}
              </p>
            </div>

            <ul
              v-if="warnings.length"
              class="sim-warnings"
              data-test="warnings"
            >
              <li
                v-for="text in warnings"
                :key="text"
              >
                {{ text }}
              </li>
            </ul>

            <div class="sim-actions">
              <AppButton
                variant="secondary"
                type="button"
                data-test="change-rule"
                @click="changeRule"
              >
                Cambiar regla
              </AppButton>
              <AppButton
                variant="ghost"
                type="button"
                data-test="new-simulation"
                @click="newSimulation"
              >
                Nueva simulación
              </AppButton>
            </div>
          </template>
          <p
            v-else
            class="sim-muted"
            data-test="no-result"
          >
            Cuando calcules la simulación, aquí verás el desglose por persona.
            Nada de lo que veas aquí se guarda.
          </p>
        </section>
      </div>
    </div>
  </section>
  <p v-else>
    {{ ACCESS_COPY }}
  </p>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { AppAlert, AppButton, AppCard, CashInput, ReportRangePicker, TabNav } from '@/components'
import { useUiModeStore } from '@/stores/uiMode.store'
import { useSessionStore } from '@/stores/session.store'
import { useAuthStore } from '@/stores/auth.store'
import { useFinanceDistributionStore } from '@/stores/finance-distribution.store'
import { addDaysToKey, businessToday, validateRange, type RangePreset } from '@/utils/business-time'
import { formatMinorMoney, minorToDisplay, parseMoneyText } from '@/utils/money'
import { formatReservePeriod } from '@/utils/finance-reserves'
import {
  ACCESS_COPY,
  PARTIAL_RESULT_COPY,
  SIMULATION_DISCLAIMER,
  amountState,
  bpsToPercentText,
  buildSimulationRequest,
  isPartialResult,
  ruleState,
  ruleSummary,
  sameRequest,
  simulatorPreset,
  visibleWarnings,
  type SimulatorPeriod,
} from '@/utils/finance-distribution'
import type { DistributionSimulationRequest, DistributionWorkBasis } from '@/types/finance-distribution.types'
import { FINANCE_TABS } from './finance-tabs'
import OverviewFigure from './components/OverviewFigure.vue'
import SimulatorRuleForm from './components/SimulatorRuleForm.vue'
import SimulatorMemberResult from './components/SimulatorMemberResult.vue'

const session = useSessionStore(),
  auth = useAuthStore(),
  mode = useUiModeStore(),
  store = useFinanceDistributionStore()
const allowed = computed(() => session.member?.role === 'socio' && mode.currentMode === 'gestion')

const today = ref(businessToday())
/** The period end may be in the future (e.g. a full month) so reserves can match it. */
const FUTURE_END_OK = { allowFuture: true } as const

/** A result kept in memory from an earlier visit restores the inputs that produced it. */
function restoredInputs(request: DistributionSimulationRequest | null) {
  if (!request) return null
  return {
    period: { from: request.from, to: addDaysToKey(request.to, -1) },
    amount: minorToDisplay(request.requestedAmountMinor),
    partner: bpsToPercentText(request.partnerShareBps),
    work: bpsToPercentText(request.workShareBps),
    basis: request.workBasis,
  }
}
const restored = restoredInputs(store.resultRequest)

const initial: SimulatorPeriod = restored?.period ?? simulatorPreset('mes')
const range = reactive({ from: initial.from, to: initial.to })
const preset = ref<RangePreset | null>(restored ? null : 'mes')
const rangeError = computed(() => {
  const problem = validateRange(range.from, range.to, today.value, FUTURE_END_OK)
  return problem === 'incomplete'
    ? 'Escribe las dos fechas para consultar el monto.'
    : problem === 'inverted'
      ? 'La fecha inicial es posterior a la final. Cámbialas para consultar.'
      : undefined
})

/** Period the base and the simulation use (changes only when applied). */
const applied = ref<SimulatorPeriod | null>(null)
const periodPending = computed(
  () => !!applied.value && (applied.value.from !== range.from || applied.value.to !== range.to),
)

const amountText = ref(restored?.amount ?? '')
const partnerText = ref(restored?.partner ?? '50')
const workText = ref(restored?.work ?? '50')
const basis = ref<DistributionWorkBasis>(restored?.basis ?? 'WORK_SHIFTS')

const baseForPeriod = computed(() => {
  const base = store.base
  const period = applied.value
  return base && period && base.period.from === period.from && base.period.to === period.to ? base : null
})
/** UI convenience only: the server decides whether the amount is allowed. */
const maxMinor = computed(() => (baseForPeriod.value ? Math.max(0, baseForPeriod.value.potentiallyAvailableMinor) : null))
const amount = computed(() => amountState(amountText.value, maxMinor.value))
/** CashInput already explains text it cannot read; this covers the rest. */
const amountMessage = computed(() =>
  amount.value.error && parseMoneyText(amountText.value) !== null ? amount.value.error : '',
)
const rule = computed(() => ruleState(partnerText.value, workText.value))

const currentRequest = computed<DistributionSimulationRequest | null>(() => {
  if (!applied.value || amount.value.minor === null || !rule.value.valid) return null
  return buildSimulationRequest({
    period: applied.value,
    amountMinor: amount.value.minor,
    partnerPercent: rule.value.partner!,
    workPercent: rule.value.work!,
    workBasis: basis.value,
  })
})
const canCalculate = computed(
  () => allowed.value && !!currentRequest.value && !rangeError.value && !periodPending.value && !store.simulating,
)

const result = computed(() => store.result)
const resultIsStale = computed(() => !!result.value && !sameRequest(currentRequest.value, store.resultRequest))
const partialResult = computed(() => !!result.value && isPartialResult(result.value))
const warnings = computed(() => (result.value ? visibleWarnings(result.value) : []))

const configBox = ref<HTMLElement | null>(null)
const resultHeading = ref<HTMLElement | null>(null)

function refresh() {
  if (!allowed.value || rangeError.value) return
  applied.value = { from: range.from, to: range.to }
  void store.loadBase({ ...applied.value })
}
function selectPreset(next: RangePreset) {
  const value = simulatorPreset(next)
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

async function calculate() {
  const request = currentRequest.value
  if (!canCalculate.value || !request) return
  if (await store.simulate(request)) {
    await nextTick()
    resultHeading.value?.focus()
  }
}

function focusConfig(id: string) {
  const field = configBox.value?.querySelector<HTMLElement>(`#${id}`)
  field?.scrollIntoView?.({ block: 'center' })
  field?.focus()
}
async function changeRule() {
  await nextTick()
  focusConfig('sim-partner')
}
async function newSimulation() {
  store.clearResult()
  amountText.value = ''
  partnerText.value = '50'
  workText.value = '50'
  basis.value = 'WORK_SHIFTS'
  await nextTick()
  focusConfig('sim-amount')
}

// Access can stay allowed while the token, account, API, member or device changes.
watch(
  [allowed, () => auth.token, () => session.owner?.accountId, () => session.owner?.apiBase,
    () => session.memberId, () => session.deviceId],
  () => {
    store.reset()
    amountText.value = ''
    partnerText.value = '50'
    workText.value = '50'
    basis.value = 'WORK_SHIFTS'
    applied.value = null
    refresh()
  },
)
onMounted(() => {
  store.clearError()
  refresh()
})
</script>

<style scoped>
.sim-page {
  display: grid;
  gap: 1.25rem;
  max-width: 1100px;
  margin: 0 auto;
  min-width: 0;
}
.sim-layout {
  display: grid;
  gap: 1.25rem;
  align-items: start;
}
.sim-layout > *,
.sim-column > * {
  min-width: 0;
}
.sim-column {
  display: grid;
  gap: 1.25rem;
  align-content: start;
}
.sim-form {
  display: grid;
  gap: 1.25rem;
}
.sim-title,
.sim-block h2 {
  margin: 0;
  font-size: var(--font-size-lg);
}
.sim-block {
  display: grid;
  gap: var(--spacing-md);
  align-content: start;
  padding: var(--spacing-md);
  background: var(--color-surface-alt);
  border-radius: var(--radius-lg);
}
.sim-block h2:focus {
  outline: 3px solid var(--color-primary);
  outline-offset: 2px;
}
.sim-subtitle {
  margin: 0;
  font-size: var(--font-size-md, 1.05rem);
}
.sim-muted {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.sim-error {
  margin: 0;
  color: var(--color-danger);
}
.sim-warning {
  margin: 0;
  color: var(--color-warning);
  font-weight: 600;
}
.sim-disclaimer {
  margin: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-info-soft);
  border-radius: var(--radius-md);
  font-weight: 600;
}
.sim-stale {
  margin: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-warning-soft);
  border-radius: var(--radius-md);
  font-weight: 600;
}
.sim-figures {
  display: grid;
  gap: var(--spacing-sm);
}
.sim-facts,
.sim-warnings,
.sim-members {
  display: grid;
  gap: var(--spacing-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}
.sim-facts li,
.sim-warnings li {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.sim-totals {
  display: grid;
  gap: var(--spacing-xs);
}
.sim-totals p {
  margin: 0;
  font-size: var(--font-size-lg);
}
.sim-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}
/* The app sidebar takes ~184px: below ~1024px two columns would be too narrow to read. */
@media (min-width: 1024px) {
  .sim-layout {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  }
  .sim-figures {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
