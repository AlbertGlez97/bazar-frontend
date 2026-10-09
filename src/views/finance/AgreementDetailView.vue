<template>
  <section
    v-if="allowed"
    class="agreement-page"
    data-test="agreement-detail-page"
  >
    <TabNav
      label="Secciones de Finanzas"
      :tabs="FINANCE_TABS"
      active="/app/finanzas/acuerdos"
    />
    <RouterLink to="/app/finanzas/acuerdos">
      Volver a acuerdos
    </RouterLink>
    <header>
      <p>Finanzas</p><h1
        ref="heading"
        tabindex="-1"
      >
        {{ document ? document.folio + ' · ' + document.title : 'Detalle del acuerdo' }}
      </h1>
    </header>
    <p
      v-if="!online"
      role="status"
      data-test="detail-offline"
    >
      Sin conexión. Puedes consultar el documento ya recibido; las acciones que cambian acuerdos requieren conexión.
    </p>
    <p
      v-if="store.detailLoading"
      role="status"
      data-test="detail-loading"
    >
      Consultando el documento…
    </p>
    <AppAlert
      v-if="store.detailError"
      type="error"
      title="No se pudo consultar el acuerdo"
      data-test="detail-error"
    >
      <p>{{ store.detailError }}</p>
      <AppButton
        type="button"
        variant="ghost"
        :disabled="!online || store.detailLoading"
        data-test="retry-detail"
        @click="refresh"
      >
        Reintentar consulta
      </AppButton>
    </AppAlert>
    <template v-if="document">
      <AppCard>
        <AppBadge
          :color="document.status === 'voided' ? 'gray' : 'green'"
          data-test="agreement-status"
        >
          {{ document.status === 'voided' ? 'Anulado' : 'Activo' }}
        </AppBadge>
        <p data-test="agreement-notice">
          {{ document.notice }}
        </p>
        <p>Este documento conserva los nombres, datos y montos registrados al crearlo. No se recalcula ni se edita.</p>
        <p
          v-if="document.note"
          data-test="agreement-note"
        >
          {{ document.note }}
        </p>
        <p>Fecha del acuerdo: {{ formatAgreementInstant(document.occurredAt) }} (UTC−6).</p>
        <p>Recibido por el servidor: {{ formatAgreementInstant(document.receivedAt) }} (UTC−6).</p>
        <p>Creado por: {{ document.createdBy.name }}</p>
        <p v-if="document.replacesAgreement">
          Reemplaza a <RouterLink
            :to="'/app/finanzas/acuerdos/' + document.replacesAgreement.id"
            data-test="replaces-link"
          >
            {{ document.replacesAgreement.folio }}
          </RouterLink>.
        </p>
        <p v-if="document.replacedBy">
          Reemplazado por <RouterLink
            :to="'/app/finanzas/acuerdos/' + document.replacedBy.id"
            data-test="replaced-by-link"
          >
            {{ document.replacedBy.folio }}
          </RouterLink>.
        </p>
        <section
          v-if="document.reversal"
          aria-labelledby="agreement-reversal-title"
          data-test="agreement-reversal"
        >
          <h2 id="agreement-reversal-title">
            Anulación registrada
          </h2>
          <p>Motivo: {{ document.reversal.reason }}</p>
          <p>Anulado: {{ formatAgreementInstant(document.reversal.occurredAt) }} (UTC−6).</p>
          <p>El documento original sigue disponible sin cambios.</p>
        </section>
      </AppCard>
      <AppCard>
        <h2>Base y regla acordadas</h2>
        <p data-test="agreement-period">
          Período: {{ formatReservePeriod(document.period.from, document.period.to) }}
        </p>
        <p>Base financiera: {{ document.financialBase.status === 'partial' ? 'Parcial' : 'Completa' }}.</p>
        <dl class="agreement-figures">
          <div><dt>Monto potencialmente disponible</dt><dd>{{ formatMinorMoney(document.financialBase.potentiallyAvailableMinor) }}</dd></div>
          <div><dt>Monto acordado</dt><dd>{{ formatMinorMoney(document.financialBase.requestedAmountMinor) }}</dd></div>
          <div><dt>Restaría potencialmente</dt><dd>{{ formatMinorMoney(document.financialBase.remainingAvailableMinor) }}</dd></div>
          <div><dt>Componente socios</dt><dd>{{ formatMinorMoney(document.pools.partnerPoolMinor) }}</dd></div>
          <div><dt>Componente trabajo</dt><dd>{{ formatMinorMoney(document.pools.workPoolMinor) }}</dd></div>
        </dl>
        <p>{{ ruleSummary(document.rule) }}</p><p>Componente socios por partes iguales (EQUAL).</p>
      </AppCard>
      <section aria-labelledby="agreement-participants-title">
        <h2 id="agreement-participants-title">
          Personas participantes
        </h2>
        <ul
          class="agreement-people"
          data-test="agreement-participants"
        >
          <li
            v-for="person in document.participants"
            :key="person.memberId"
          >
            <AppCard data-test="agreement-person">
              <h3>{{ person.name }}</h3>
              <AppBadge :color="person.role === 'socio' ? 'green' : 'blue'">
                {{ person.role === 'socio' ? 'Socio' : 'Colaborador' }}
              </AppBadge>
              <AppBadge :color="person.isActive ? 'green' : 'gray'">
                {{ person.isActive ? 'Activo al crear el acuerdo' : 'Inactivo al crear el acuerdo' }}
              </AppBadge>
              <p>{{ person.partnerEligible ? 'Participa como socio' : 'No participa como socio' }}</p>
              <dl class="agreement-figures">
                <div><dt>Por ser socio</dt><dd>{{ formatMinorMoney(person.partnerAmountMinor) }}</dd></div>
                <div><dt>Por trabajo</dt><dd>{{ formatMinorMoney(person.workAmountMinor) }}</dd></div>
                <div><dt>Total acordado</dt><dd>{{ formatMinorMoney(person.totalMinor) }}</dd></div>
              </dl>
              <p>Unidades de trabajo: {{ person.workUnits }} {{ document.rule.workBasis === 'WORK_SHIFTS' ? 'jornadas' : 'minutos conocidos' }}.</p>
              <p>Jornadas: {{ person.shiftCount }} · Minutos conocidos: {{ person.knownMinutes }} · Jornadas sin duración: {{ person.unknownDurationCount }}.</p>
            </AppCard>
          </li>
        </ul>
      </section>
      <AppCard>
        <h2>Totales del acuerdo</h2>
        <p data-test="agreement-distributed">
          Total asignado: {{ formatMinorMoney(document.totals.distributedMinor) }}
        </p>
        <p>Sin asignar: {{ formatMinorMoney(document.totals.undistributedMinor) }}</p>
      </AppCard>
      <AppCard v-if="document.warnings.length">
        <h2>Avisos conservados</h2>
        <ul data-test="agreement-warnings">
          <li
            v-for="warning in document.warnings"
            :key="warning.code"
          >
            {{ agreementWarningText(warning.code) }}
          </li>
        </ul>
      </AppCard>
    </template>
  </section>
  <p v-else>
    {{ AGREEMENT_ACCESS_COPY }}
  </p>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { AppAlert, AppBadge, AppButton, AppCard, TabNav } from '@/components'
import { useFinanceAgreementsStore } from '@/stores/finance-agreements.store'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import { formatReservePeriod } from '@/utils/finance-reserves'
import { ruleSummary } from '@/utils/finance-distribution'
import { formatMinorMoney } from '@/utils/money'
import { AGREEMENT_ACCESS_COPY, agreementWarningText, formatAgreementInstant, isAgreementId } from '@/utils/finance-agreements'
import { FINANCE_TABS } from './finance-tabs'

const route = useRoute(), store = useFinanceAgreementsStore(), auth = useAuthStore(), session = useSessionStore(), mode = useUiModeStore()
const allowed = computed(() => !!auth.token && session.member?.role === 'socio' && session.member.active === true && mode.currentMode === 'gestion')
const id = computed(() => typeof route.params.id === 'string' ? route.params.id : '')
const document = computed(() => store.detail?.id === id.value ? store.detail : null)
const heading = ref<HTMLElement | null>(null), online = ref(navigator.onLine)
async function refresh() {
  if (!allowed.value) return
  if (!isAgreementId(id.value)) {
    store.detail = null
    store.detailError = 'El identificador del acuerdo no es válido.'
    return
  }
  if (!online.value) return
  const result = await store.loadDetail(id.value)
  if (result && allowed.value) { await nextTick(); heading.value?.focus() }
}
function onOnline() { online.value = true }
function onOffline() { online.value = false }
watch([id, allowed, () => auth.token, () => session.owner?.accountId, () => session.owner?.apiBase,
  () => session.memberId, () => session.deviceId, () => session.deviceToken], () => {
  if (!allowed.value) return
  if (!online.value && store.detail?.id !== id.value) store.detail = null
  void refresh()
}, { immediate: true })
onMounted(() => { window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline) })
onUnmounted(() => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) })
</script>

<style scoped>
.agreement-page { display: grid; gap: var(--spacing-lg); max-width: 1000px; margin: 0 auto; min-width: 0; overflow-wrap: anywhere; }
.agreement-people { display: grid; gap: var(--spacing-md); list-style: none; padding: 0; }
.agreement-figures { display: grid; gap: var(--spacing-md); }
.agreement-figures dd { margin: 0; font-size: var(--font-size-xl, 1.35rem); font-weight: 700; font-variant-numeric: tabular-nums; }
h2, h3 { margin: 0 0 var(--spacing-sm); }
@media (min-width: 768px) { .agreement-figures { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
