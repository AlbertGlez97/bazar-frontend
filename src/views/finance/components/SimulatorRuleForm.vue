<template>
  <div class="sim-rule">
    <section
      class="sim-rule__step"
      aria-labelledby="sim-rule-title"
      data-test="rule-step"
    >
      <h2 id="sim-rule-title">
        Regla
      </h2>
      <p
        id="sim-rule-hint"
        class="sim-rule__muted"
      >
        Elige qué parte del monto se reparte en partes iguales entre los socios activos
        y qué parte según el trabajo registrado.
      </p>

      <div
        role="group"
        aria-label="Reglas rápidas (socios / trabajo)"
        class="sim-rule__presets"
      >
        <button
          v-for="p in RULE_PRESETS"
          :key="`${p.partner}-${p.work}`"
          type="button"
          class="sim-rule__preset"
          :class="{ 'sim-rule__preset--active': isActive(p) }"
          :aria-pressed="isActive(p) ? 'true' : 'false'"
          :disabled="disabled"
          :data-test="`preset-${p.partner}-${p.work}`"
          @click="apply(p)"
        >
          {{ p.partner }} / {{ p.work }}
        </button>
      </div>

      <div class="sim-rule__percents">
        <AppInput
          id="sim-partner"
          :model-value="partnerText"
          label="Parte por ser socio (%)"
          inputmode="numeric"
          autocomplete="off"
          :disabled="disabled"
          :aria-describedby="describedBy"
          @update:model-value="(v: string) => emit('update:partnerText', v)"
        />
        <AppInput
          id="sim-work"
          :model-value="workText"
          label="Parte por trabajo (%)"
          inputmode="numeric"
          autocomplete="off"
          :disabled="disabled"
          :aria-describedby="describedBy"
          @update:model-value="(v: string) => emit('update:workText', v)"
        />
      </div>

      <p
        id="sim-rule-total"
        class="sim-rule__total"
        :class="{ 'sim-rule__total--bad': !!rule.error }"
        data-test="rule-total"
      >
        Total: {{ rule.total }}%
      </p>
      <p
        v-if="rule.error"
        id="sim-rule-error"
        class="sim-rule__error"
        role="alert"
        data-test="rule-error"
      >
        {{ rule.error }}
      </p>
    </section>

    <section
      class="sim-rule__step"
      aria-labelledby="sim-basis-title"
      data-test="basis-step"
    >
      <h2 id="sim-basis-title">
        Base del trabajo
      </h2>
      <fieldset
        class="sim-rule__basis"
        :disabled="disabled"
      >
        <legend>¿Cómo se mide el trabajo de cada persona?</legend>
        <label
          v-for="option in BASES"
          :key="option"
          class="sim-rule__radio"
          :class="{ 'sim-rule__radio--active': basis === option }"
        >
          <input
            type="radio"
            name="sim-basis"
            :value="option"
            :checked="basis === option"
            :aria-describedby="`sim-basis-${option}`"
            :data-test="`basis-${option}`"
            @change="emit('update:basis', option)"
          >
          <span class="sim-rule__radio-text">
            <span class="sim-rule__radio-label">{{ WORK_BASIS_LABEL[option] }}</span>
            <span
              :id="`sim-basis-${option}`"
              class="sim-rule__muted"
            >{{ WORK_BASIS_HINT[option] }}</span>
          </span>
        </label>
      </fieldset>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AppInput } from '@/components'
import {
  RULE_PRESETS,
  WORK_BASIS_HINT,
  WORK_BASIS_LABEL,
  ruleState,
  type RulePreset,
} from '@/utils/finance-distribution'
import type { DistributionWorkBasis } from '@/types/finance-distribution.types'

const props = defineProps<{
  partnerText: string
  workText: string
  basis: DistributionWorkBasis
  disabled?: boolean
}>()
const emit = defineEmits<{
  'update:partnerText': [value: string]
  'update:workText': [value: string]
  'update:basis': [value: DistributionWorkBasis]
}>()

const BASES: readonly DistributionWorkBasis[] = ['WORK_SHIFTS', 'KNOWN_MINUTES']

const rule = computed(() => ruleState(props.partnerText, props.workText))
const describedBy = computed(() =>
  ['sim-rule-hint', 'sim-rule-total', rule.value.error ? 'sim-rule-error' : ''].filter(Boolean).join(' '),
)
const isActive = (p: RulePreset) => rule.value.partner === p.partner && rule.value.work === p.work

function apply(p: RulePreset) {
  emit('update:partnerText', String(p.partner))
  emit('update:workText', String(p.work))
}
</script>

<style scoped>
.sim-rule {
  display: grid;
  gap: var(--spacing-md);
}
.sim-rule__step {
  display: grid;
  gap: var(--spacing-sm);
  align-content: start;
}
.sim-rule__step h2 {
  margin: 0;
  font-size: var(--font-size-lg);
}
.sim-rule__muted {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.sim-rule__presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}
.sim-rule__preset {
  min-height: 2.75rem;
  padding: 0 var(--spacing-md);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}
.sim-rule__preset--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  font-weight: 600;
}
.sim-rule__preset:focus-visible,
.sim-rule__radio:focus-within {
  outline: 3px solid var(--color-primary);
  outline-offset: 2px;
}
.sim-rule__percents {
  display: grid;
  gap: var(--spacing-sm);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.sim-rule__total {
  margin: 0;
  font-weight: 700;
}
.sim-rule__total--bad,
.sim-rule__error {
  color: var(--color-danger);
}
.sim-rule__error {
  margin: 0;
}
.sim-rule__basis {
  display: grid;
  gap: var(--spacing-sm);
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.sim-rule__basis legend {
  padding: 0;
  margin-bottom: var(--spacing-xs);
  font-weight: 600;
}
.sim-rule__radio {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  min-height: 2.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
}
.sim-rule__radio--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}
.sim-rule__radio input {
  margin-top: 0.25rem;
  accent-color: var(--color-primary);
}
.sim-rule__radio-text {
  display: grid;
  gap: 2px;
}
.sim-rule__radio-label {
  font-weight: 600;
}
</style>
