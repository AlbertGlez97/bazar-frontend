<template>
  <section
    class="rules-proposal"
    aria-labelledby="rules-proposal-title"
    data-test="rules-proposal"
  >
    <div class="rules-proposal__head">
      <h3 id="rules-proposal-title">
        Propuesta: versión {{ proposal.version }}
      </h3>
      <AppBadge :color="inReview ? 'amber' : 'blue'">
        {{ STATUS_TEXT[proposal.status] }}
      </AppBadge>
    </div>
    <p>
      Propuso {{ proposal.proposedBy.name }}<template v-if="proposal.submittedAt">
        el {{ formatRuleDateTime(proposal.submittedAt) }}
      </template>. Mientras no la aprueben todos, siguen las reglas anteriores.
    </p>

    <section
      v-if="proposal.changes?.length"
      class="rules-proposal__changes"
      aria-labelledby="rules-changes-title"
      data-test="rules-changes"
    >
      <h4 id="rules-changes-title">
        Qué cambió
      </h4>
      <ul>
        <li
          v-for="change in proposal.changes"
          :key="change.topic"
        >
          <strong>{{ change.topic }}.</strong>
          Antes: {{ change.before }} Ahora: {{ change.after }}
        </li>
      </ul>
    </section>

    <ul>
      <li
        v-for="line in versionSummary(proposal.config)"
        :key="line"
      >
        {{ line }}
      </li>
    </ul>
    <WarningList :warnings="proposal.warnings" />

    <section
      class="rules-proposal__partners"
      aria-labelledby="rules-partners-title"
    >
      <h4 id="rules-partners-title">
        Quién respondió
      </h4>
      <ul data-test="rules-partners">
        <li
          v-for="partner in partners"
          :key="partner.memberId"
          :data-test="`partner-${partner.memberId}`"
        >
          {{ partnerStatusText(partner, proposal) }}
        </li>
      </ul>
    </section>

    <section
      v-if="proposal.objections.length"
      class="rules-proposal__objections"
      aria-labelledby="rules-objections-title"
    >
      <h4 id="rules-objections-title">
        Por qué no están de acuerdo
      </h4>
      <RulesObjections :items="proposal.objections" />
    </section>

    <div class="rules-proposal__actions">
      <AppButton
        v-if="!inReview"
        type="button"
        variant="secondary"
        :disabled="working || !resend.allowed"
        data-test="rules-resend"
        @click="emit('resend')"
      >
        Reenviar correo
      </AppButton>
      <AppButton
        type="button"
        variant="secondary"
        :disabled="working"
        data-test="rules-modify"
        @click="emit('modify')"
      >
        Modificar la propuesta
      </AppButton>
      <AppButton
        v-if="!confirmingDiscard"
        type="button"
        variant="soft-danger"
        :disabled="working"
        data-test="rules-discard-proposal"
        @click="confirmingDiscard = true"
      >
        Descartar la propuesta
      </AppButton>
    </div>
    <p
      v-if="!inReview && resend.hint"
      class="rules-proposal__note"
      data-test="rules-resend-hint"
    >
      {{ resend.hint }}
    </p>

    <div
      v-if="confirmingDiscard"
      class="rules-proposal__confirm"
      role="group"
      aria-labelledby="rules-discard-question"
      data-test="rules-discard-confirm"
    >
      <p id="rules-discard-question">
        ¿Descartar esta propuesta? Quedará en el historial y siguen las reglas anteriores.
      </p>
      <div class="rules-proposal__actions">
        <AppButton
          type="button"
          variant="danger"
          :disabled="working"
          data-test="rules-discard-yes"
          @click="discard"
        >
          Sí, descartar
        </AppButton>
        <AppButton
          type="button"
          variant="ghost"
          :disabled="working"
          data-test="rules-discard-no"
          @click="confirmingDiscard = false"
        >
          No, conservarla
        </AppButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { AppBadge, AppButton } from '@/components'
import { STATUS_TEXT, formatRuleDateTime, partnerStatusText, resendState, versionSummary } from '@/utils/finance-rules'
import type { RuleSetView, RulesPartnerStatus } from '@/types/finance-rules.types'
import RulesObjections from './RulesObjections.vue'
import WarningList from './RulesWarningList.vue'

const props = defineProps<{ proposal: RuleSetView; partners: readonly RulesPartnerStatus[]; working: boolean }>()
const emit = defineEmits<{ resend: []; modify: []; discard: [] }>()

const confirmingDiscard = ref(false)
const inReview = computed(() => props.proposal.status === 'en_revision')
const resend = computed(() => resendState(props.partners))

function discard() {
  confirmingDiscard.value = false
  emit('discard')
}
</script>

<style scoped>
.rules-proposal { display: grid; gap: var(--spacing-sm); padding-top: var(--spacing-sm); border-top: 1px solid var(--color-border); }
.rules-proposal__head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs); }
.rules-proposal h3, .rules-proposal h4 { margin: 0; }
.rules-proposal h3 { font-size: var(--font-size-md); }
.rules-proposal h4 { font-size: var(--font-size-base); }
.rules-proposal p { margin: 0; }
.rules-proposal ul { margin: 0; padding-left: var(--spacing-md); }
.rules-proposal__changes, .rules-proposal__partners, .rules-proposal__objections { display: grid; gap: var(--spacing-xs); }
.rules-proposal__actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
.rules-proposal__note { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.rules-proposal__confirm { display: grid; gap: var(--spacing-sm); padding: var(--spacing-sm); border: 1px solid var(--color-danger); border-radius: var(--radius-sm); }
</style>
