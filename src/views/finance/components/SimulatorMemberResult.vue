<template>
  <li
    class="sim-member"
    :class="{ 'sim-member--inactive': !member.isActive }"
    data-test="member-card"
  >
    <div class="sim-member__head">
      <h4 class="sim-member__name">
        {{ member.name }}
      </h4>
      <AppBadge
        :color="member.role === 'socio' ? 'green' : 'blue'"
        data-test="role-badge"
      >
        {{ member.role === 'socio' ? 'Socio' : 'Colaborador' }}
      </AppBadge>
      <AppBadge
        v-if="!member.isActive"
        color="gray"
        data-test="inactive-badge"
      >
        Inactivo
      </AppBadge>
    </div>

    <dl class="sim-member__amounts">
      <div>
        <dt>Por ser socio</dt>
        <dd data-test="partner-amount">
          {{ formatMinorMoney(member.partnerAmountMinor) }}
        </dd>
        <dd
          v-if="!member.partnerEligible"
          class="sim-member__note"
          data-test="not-partner"
        >
          No participa como socio
        </dd>
      </div>
      <div>
        <dt>Por trabajo</dt>
        <dd data-test="work-amount">
          {{ formatMinorMoney(member.workAmountMinor) }}
        </dd>
      </div>
      <div class="sim-member__total">
        <dt>Total simulado</dt>
        <dd data-test="member-total">
          {{ formatMinorMoney(member.totalMinor) }}
        </dd>
      </div>
    </dl>

    <p
      class="sim-member__how"
      data-test="work-how"
    >
      <span class="sim-member__how-label">Cómo se calculó el trabajo:</span>
      {{ breakdown }}
    </p>
    <p
      v-if="unknown"
      class="sim-member__note"
      data-test="unknown-duration"
    >
      {{ unknown }}
    </p>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AppBadge } from '@/components'
import { formatMinorMoney } from '@/utils/money'
import { unknownDurationText, workBreakdownText } from '@/utils/finance-distribution'
import type { DistributionMember, DistributionWorkBasis } from '@/types/finance-distribution.types'

const props = defineProps<{
  member: DistributionMember
  basis: DistributionWorkBasis
  /** Every member of the same result: the work share is read against their total. */
  members: readonly DistributionMember[]
}>()

const breakdown = computed(() => workBreakdownText(props.member, props.basis, props.members))
const unknown = computed(() => unknownDurationText(props.member.unknownDurationCount))
</script>

<style scoped>
.sim-member {
  display: grid;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 0;
}
.sim-member--inactive {
  border-style: dashed;
}
.sim-member__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-xs) var(--spacing-sm);
}
.sim-member__name {
  margin: 0;
  font-size: var(--font-size-lg);
  overflow-wrap: anywhere;
}
.sim-member__amounts {
  display: grid;
  gap: var(--spacing-sm);
  margin: 0;
}
.sim-member__amounts > div {
  display: grid;
  gap: 2px;
}
.sim-member__amounts dt {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.sim-member__amounts dd {
  margin: 0;
  font-size: var(--font-size-xl, 1.35rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.sim-member__amounts dd.sim-member__note {
  font-size: var(--font-size-sm);
  font-weight: 400;
}
.sim-member__total {
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
}
.sim-member__total dd {
  font-size: 1.6rem;
}
.sim-member__how,
.sim-member__note {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.sim-member__how-label {
  font-weight: 600;
}
</style>
