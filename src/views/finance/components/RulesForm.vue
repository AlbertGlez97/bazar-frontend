<template>
  <form
    class="rules-form"
    novalidate
    data-test="rules-form"
    @submit.prevent
  >
    <fieldset class="rules-form__section">
      <legend>1. {{ RULE_GUIDES.profitBase.title }}</legend>
      <RuleGuide :guide="RULE_GUIDES.profitBase" />
      <div
        class="rules-form__shortcuts"
        role="group"
        aria-label="Atajos para dividir la utilidad"
      >
        <AppButton
          v-for="preset in BASE_PRESETS"
          :key="preset.id"
          type="button"
          size="sm"
          variant="secondary"
          :disabled="disabled"
          :data-test="`preset-${preset.id}`"
          @click="update((c) => { c.profitBase = { ...preset.base } })"
        >
          {{ preset.label }}
        </AppButton>
      </div>
      <div class="rules-form__grid">
        <PercentField
          :model-value="modelValue.profitBase.partnerPct"
          label="Por ser socio (igual para todos)"
          :disabled="disabled"
          data-test="base-partner"
          @update:model-value="setBase('partnerPct', $event)"
        />
        <PercentField
          :model-value="modelValue.profitBase.capitalPct"
          label="Por capital aportado"
          :disabled="disabled"
          data-test="base-capital"
          @update:model-value="setBase('capitalPct', $event)"
        />
        <PercentField
          :model-value="modelValue.profitBase.workPct"
          label="Por trabajo"
          :disabled="disabled"
          data-test="base-work"
          @update:model-value="setBase('workPct', $event)"
        />
      </div>
      <p class="rules-form__note">
        Las tres partes siempre suman 100 %. Si cambias una, las otras se ajustan.
      </p>
    </fieldset>

    <fieldset class="rules-form__section">
      <legend>2. {{ RULE_GUIDES.reinvestment.title }}</legend>
      <RuleGuide :guide="RULE_GUIDES.reinvestment" />
      <SegmentedControl
        :model-value="modelValue.reinvestment.currentPhase"
        :options="PHASE_OPTIONS"
        label="Fase actual del negocio"
        :disabled="disabled"
        @update:model-value="update((c) => { c.reinvestment.currentPhase = $event as BusinessPhase })"
      />
      <div class="rules-form__grid">
        <PercentField
          :model-value="modelValue.reinvestment.arranquePct"
          label="Se reinvierte en arranque"
          :disabled="disabled"
          @update:model-value="update((c) => { c.reinvestment.arranquePct = $event })"
        />
        <PercentField
          :model-value="modelValue.reinvestment.operacionPct"
          label="Se reinvierte en operación"
          :disabled="disabled"
          @update:model-value="update((c) => { c.reinvestment.operacionPct = $event })"
        />
        <PercentField
          :model-value="modelValue.reinvestment.cierrePct"
          label="Se reinvierte en cierre"
          :disabled="disabled"
          @update:model-value="update((c) => { c.reinvestment.cierrePct = $event })"
        />
      </div>
      <div class="rules-form__shortcuts">
        <AppButton
          type="button"
          size="sm"
          variant="secondary"
          :disabled="disabled"
          data-test="preset-reinvest"
          @click="update((c) => { Object.assign(c.reinvestment, { arranquePct: 100, operacionPct: 50, cierrePct: 0 }) })"
        >
          Sugerido: 100 % · 50 % · 0 %
        </AppButton>
      </div>
      <AppSwitch
        :model-value="untilOn"
        :disabled="disabled"
        data-test="until-switch"
        @update:model-value="toggleUntil"
      >
        Dejar de reinvertir al llegar a un monto
      </AppSwitch>
      <AmountInput
        v-if="untilOn"
        :model-value="untilText"
        label="Monto total a reinvertir"
        :disabled="disabled"
        @update:model-value="setUntil"
      />
    </fieldset>

    <fieldset class="rules-form__section">
      <legend>3. {{ RULE_GUIDES.capitalRecovery.title }}</legend>
      <RuleGuide :guide="RULE_GUIDES.capitalRecovery" />
      <AppSelect
        :model-value="modelValue.capitalRecovery.mode"
        label="Cómo se recupera"
        :disabled="disabled"
        data-test="recovery-mode"
        @update:model-value="update((c) => { c.capitalRecovery.mode = $event as RecoveryMode })"
      >
        <option
          v-for="option in RECOVERY_OPTIONS"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </AppSelect>
      <SegmentedControl
        v-if="modelValue.capitalRecovery.mode !== 'ninguna'"
        :model-value="modelValue.capitalRecovery.timing"
        :options="TIMING_OPTIONS"
        label="Cuándo se recupera"
        :disabled="disabled"
        @update:model-value="update((c) => { c.capitalRecovery.timing = $event as RecoveryTiming })"
      />
    </fieldset>

    <fieldset class="rules-form__section">
      <legend>4. {{ RULE_GUIDES.work.title }}</legend>
      <RuleGuide :guide="RULE_GUIDES.work" />
      <AppSwitch
        :model-value="modelValue.work.payHours"
        :disabled="disabled"
        data-test="pay-hours"
        @update:model-value="update((c) => { c.work.payHours = $event })"
      >
        Pagar las horas trabajadas entre socios
      </AppSwitch>
      <template v-if="modelValue.work.payHours">
        <SegmentedControl
          :model-value="modelValue.work.order"
          :options="ORDER_OPTIONS"
          label="Cuándo se paga el trabajo"
          :disabled="disabled"
          @update:model-value="update((c) => { c.work.order = $event as WorkOrder })"
        />
        <SegmentedControl
          :model-value="modelValue.work.pay.kind"
          :options="PAY_OPTIONS"
          label="Cómo se paga el trabajo"
          :disabled="disabled"
          @update:model-value="setPayKind($event)"
        />
        <AmountInput
          v-if="modelValue.work.pay.kind === 'por_hora'"
          :model-value="rateText"
          label="Tarifa por hora"
          :disabled="disabled"
          @update:model-value="setRate"
        />
        <PercentField
          v-else
          :model-value="modelValue.work.pay.pct"
          label="Parte del reparto para el trabajo"
          :disabled="disabled"
          @update:model-value="update((c) => { c.work.pay = { kind: 'porcentaje', pct: $event } })"
        />
      </template>
    </fieldset>

    <fieldset class="rules-form__section">
      <legend>5. {{ RULE_GUIDES.partnerExpenses.title }}</legend>
      <RuleGuide :guide="RULE_GUIDES.partnerExpenses" />
      <SegmentedControl
        :model-value="modelValue.partnerExpenses"
        :options="EXPENSE_OPTIONS"
        label="Qué pasa con ese gasto"
        :disabled="disabled"
        @update:model-value="update((c) => { c.partnerExpenses = $event as PartnerExpenseMode })"
      />
    </fieldset>

    <fieldset class="rules-form__section">
      <legend>6. {{ RULE_GUIDES.reserves.title }}</legend>
      <RuleGuide :guide="RULE_GUIDES.reserves" />
      <SegmentedControl
        :model-value="modelValue.reserves.kind"
        :options="RESERVE_OPTIONS"
        label="Cómo se aparta"
        :disabled="disabled"
        @update:model-value="setReserveKind($event)"
      />
      <AmountInput
        v-if="modelValue.reserves.kind === 'monto'"
        :model-value="reserveText"
        label="Monto que se aparta"
        :disabled="disabled"
        @update:model-value="setReserveAmount"
      />
      <PercentField
        v-else
        :model-value="modelValue.reserves.pct"
        label="Parte de la utilidad que se aparta"
        :disabled="disabled"
        @update:model-value="update((c) => { c.reserves = { kind: 'porcentaje', pct: $event } })"
      />
    </fieldset>

    <fieldset class="rules-form__section">
      <legend>7. {{ RULE_GUIDES.partnerLoans.title }}</legend>
      <RuleGuide :guide="RULE_GUIDES.partnerLoans" />
      <AppSwitch
        :model-value="modelValue.partnerLoans.repayBeforeCapital"
        :disabled="disabled"
        data-test="loans-switch"
        @update:model-value="update((c) => { c.partnerLoans.repayBeforeCapital = $event })"
      >
        Devolver los préstamos antes que el capital
      </AppSwitch>
    </fieldset>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { AmountInput, AppButton, AppSelect, AppSwitch, PercentField, RuleGuide, SegmentedControl } from '@/components'
import { minorToDisplay, parseMoneyText } from '@/utils/money'
import { BASE_PRESETS, RULE_GUIDES, rebalanceBase } from '@/utils/finance-rules'
import type {
  BusinessPhase,
  FinanceRulesConfig,
  PartnerExpenseMode,
  ProfitBase,
  RecoveryMode,
  RecoveryTiming,
  WorkOrder,
} from '@/types/finance-rules.types'

const props = withDefaults(defineProps<{ modelValue: FinanceRulesConfig; disabled?: boolean }>(), { disabled: false })
const emit = defineEmits<{ 'update:modelValue': [config: FinanceRulesConfig] }>()

const PHASE_OPTIONS = [
  { value: 'arranque', label: 'Arranque' },
  { value: 'operacion', label: 'Operación' },
  { value: 'cierre', label: 'Cierre' },
] as const
const RECOVERY_OPTIONS = [
  { value: 'ninguna', label: 'No se devuelve' },
  { value: 'por_diferencia', label: 'Por diferencia' },
  { value: 'total', label: 'Todo el capital' },
  { value: 'proporcional', label: 'En proporción' },
] as const
const TIMING_OPTIONS = [
  { value: 'durante', label: 'Durante la operación' },
  { value: 'al_cierre', label: 'Solo al cierre' },
] as const
const ORDER_OPTIONS = [
  { value: 'antes', label: 'Antes del capital' },
  { value: 'despues', label: 'Después del capital' },
] as const
const PAY_OPTIONS = [
  { value: 'por_hora', label: 'Por hora' },
  { value: 'porcentaje', label: '% del reparto' },
] as const
const EXPENSE_OPTIONS = [
  { value: 'no_reembolsar', label: 'No se reembolsan' },
  { value: 'reembolsar', label: 'Se reembolsan' },
  { value: 'contar_como_aportacion', label: 'Cuentan como aportación' },
] as const
const RESERVE_OPTIONS = [
  { value: 'porcentaje', label: '% de la utilidad' },
  { value: 'monto', label: 'Monto fijo' },
] as const

/** Cada cambio produce una copia nueva: el padre decide cuándo guardar. */
function update(change: (draft: FinanceRulesConfig) => void) {
  const next = JSON.parse(JSON.stringify(props.modelValue)) as FinanceRulesConfig
  change(next)
  emit('update:modelValue', next)
}
function setBase(key: keyof ProfitBase, value: number) {
  update((c) => { c.profitBase = rebalanceBase(c.profitBase, key, value) })
}

// Los montos se escriben como texto; solo se emiten cuando se entienden.
const startText = (minor: number | null) => (minor === null ? '' : minorToDisplay(minor))
const untilOn = ref(props.modelValue.reinvestment.untilAmountMinor !== null)
const untilText = ref(startText(props.modelValue.reinvestment.untilAmountMinor))
const rateText = ref(startText(props.modelValue.work.pay.kind === 'por_hora' ? props.modelValue.work.pay.rateMinorPerHour : null))
const reserveText = ref(startText(props.modelValue.reserves.kind === 'monto' ? props.modelValue.reserves.amountMinor : null))

function toggleUntil(on: boolean) {
  untilOn.value = on
  update((c) => { c.reinvestment.untilAmountMinor = on ? (parseMoneyText(untilText.value) ?? 0) : null })
}
function setUntil(text: string) {
  untilText.value = text
  const minor = parseMoneyText(text)
  if (minor !== null) update((c) => { c.reinvestment.untilAmountMinor = minor })
}
function setPayKind(kind: string) {
  update((c) => {
    c.work.pay = kind === 'por_hora'
      ? { kind: 'por_hora', rateMinorPerHour: parseMoneyText(rateText.value) ?? 0 }
      : { kind: 'porcentaje', pct: 0 }
  })
}
function setRate(text: string) {
  rateText.value = text
  const minor = parseMoneyText(text)
  if (minor !== null) update((c) => { c.work.pay = { kind: 'por_hora', rateMinorPerHour: minor } })
}
function setReserveKind(kind: string) {
  update((c) => {
    c.reserves = kind === 'monto'
      ? { kind: 'monto', amountMinor: parseMoneyText(reserveText.value) ?? 0 }
      : { kind: 'porcentaje', pct: 0 }
  })
}
function setReserveAmount(text: string) {
  reserveText.value = text
  const minor = parseMoneyText(text)
  if (minor !== null) update((c) => { c.reserves = { kind: 'monto', amountMinor: minor } })
}
</script>

<style scoped>
.rules-form { display: grid; gap: var(--spacing-md); }
.rules-form__section {
  display: grid; gap: var(--spacing-sm); min-width: 0; margin: 0; padding: var(--spacing-md);
  border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface);
}
.rules-form__section legend { padding: 0 var(--spacing-xs); font-weight: 700; color: var(--color-text); }
.rules-form__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-sm); }
.rules-form__shortcuts { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
.rules-form__note { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
@media (max-width: 40rem) { .rules-form__grid { grid-template-columns: 1fr; } }
</style>
