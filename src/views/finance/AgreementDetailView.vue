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
    <p
      v-if="mutationNotice"
      role="status"
      data-test="void-notice"
    >
      {{ mutationNotice }}
    </p>
    <AppAlert
      v-if="store.pendingReversal && store.pendingReversal.agreementId !== id"
      type="warning"
      title="Anulación pendiente"
    >
      Resuelve el intento pendiente antes de cambiar otro acuerdo.
      <RouterLink :to="'/app/finanzas/acuerdos/' + store.pendingReversal.agreementId">
        Ver acuerdo pendiente
      </RouterLink>
    </AppAlert>
    <p
      v-if="store.pendingCreate"
      role="status"
    >
      Resuelve el acuerdo pendiente en el simulador antes de anular otro acuerdo.
    </p>
    <AppButton
      v-if="store.pendingReversal?.agreementId === id || (document?.status === 'active' && store.detailCurrent)"
      type="button"
      data-test="open-void"
      :disabled="!canVoid"
      @click="openVoid"
    >
      {{ store.pendingReversal?.agreementId === id ? 'Revisar anulación pendiente' : 'Anular acuerdo' }}
    </AppButton>
    <AgreementVoidForm
      v-model="voidOpen"
      :folio="voidFolio"
      :allowed="canVoid"
      :busy="store.reversing"
      :error="store.reverseError"
      :payments="paymentsState"
      :pending="store.pendingReversal?.agreementId === id ? store.pendingReversal.payload : null"
      @confirm="confirmVoid"
      @retry="retryVoid"
    />
    <p
      v-if="store.pdfError"
      role="alert"
      data-test="detail-pdf-error"
    >
      {{ store.pdfError }}
    </p>
    <AppButton
      v-if="document"
      type="button"
      data-test="detail-pdf"
      :loading="store.pdfLoading"
      :disabled="!online || store.pdfLoading || store.detailLoading || store.saving || store.reversing || !!store.pendingCreate || !!store.pendingReversal"
      @click="exportPdf"
    >
      Generar PDF
    </AppButton>
    <template v-if="document">
      <p
        v-if="!store.detailCurrent"
        role="status"
      >
        El documento recibido se conserva. Actualiza el detalle para confirmar su estado actual.
        <AppButton
          type="button"
          variant="ghost"
          :disabled="!online || store.detailLoading"
          @click="refresh"
        >
          Actualizar estado del acuerdo
        </AppButton>
      </p>
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
        <RouterLink
          v-if="document.status === 'voided' && !document.replacedBy && store.detailCurrent && online && !store.pendingCreate && !store.pendingReversal"
          :to="{ path: '/app/finanzas/simulador', query: { replacesAgreementId: document.id } }"
          data-test="create-replacement"
        >
          Crear acuerdo sustituto
        </RouterLink>
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
      <AgreementPayments
        :agreement-id="document.id"
        :agreement-status="document.status"
        :summary="paymentSummary"
        :online="online"
        @reload="reloadPayments"
        @changed="refreshDetailQuietly"
      />
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
import { useFinancePaymentsStore } from '@/stores/finance-payments.store'
import { validPaymentSummary } from '@/utils/finance-payment-guards'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import { formatReservePeriod } from '@/utils/finance-reserves'
import { ruleSummary } from '@/utils/finance-distribution'
import { formatMinorMoney } from '@/utils/money'
import { AGREEMENT_ACCESS_COPY, agreementWarningText, formatAgreementInstant, isAgreementId } from '@/utils/finance-agreements'
import AgreementPayments from './components/AgreementPayments.vue'
import AgreementVoidForm from './components/AgreementVoidForm.vue'
import { FINANCE_TABS } from './finance-tabs'

const route = useRoute(), store = useFinanceAgreementsStore(), payments = useFinancePaymentsStore(), auth = useAuthStore(), session = useSessionStore(), mode = useUiModeStore()
const allowed = computed(() => !!auth.token && session.member?.role === 'socio' && session.member.active === true && mode.currentMode === 'gestion')
const id = computed(() => typeof route.params.id === 'string' ? route.params.id : '')
const document = computed(() => store.detail?.id === id.value ? store.detail : null)
const viewActive = ref(true)
// Prefer the live summary of the payments read; the detail copy is only a validated fallback.
const paymentSummary = computed(() => payments.agreementId === id.value && payments.summary ? payments.summary :
  validPaymentSummary(document.value?.paymentSummary) ? document.value.paymentSummary : null)
const paymentsState = computed<'yes' | 'no' | 'unknown'>(() => !paymentSummary.value ? 'unknown' : paymentSummary.value.hasPayments ? 'yes' : 'no')
const voidOpen = ref(false), voidFolio = ref(''), mutationNotice = ref('')
const canVoid = computed(() => allowed.value && online.value && !store.saving && !store.reversing && !store.pdfLoading && !store.pendingCreate &&
  (!store.pendingReversal || store.pendingReversal.agreementId === id.value) &&
  (!!store.pendingReversal || (document.value?.status === 'active' && store.detailCurrent)))
function openVoid() {
  if (!canVoid.value) return
  voidFolio.value = document.value?.folio ?? 'el acuerdo pendiente'
  store.reverseError = ''; mutationNotice.value = ''; voidOpen.value = true
}
async function confirmVoid(reason: string) {
  if (!voidOpen.value || !canVoid.value || store.pendingReversal) return
  await sendVoid(reason)
}
async function retryVoid() {
  const attempt = store.pendingReversal
  if (!voidOpen.value || !canVoid.value || attempt?.agreementId !== id.value) return
  await sendVoid(attempt.payload.reason)
}
async function sendVoid(reason: string) {
  const selectedId = id.value
  const receipt = await store.reverse(selectedId, reason)
  if (!allowed.value || id.value !== selectedId) return
  if (receipt || store.alreadyVoided) {
    voidOpen.value = false
    mutationNotice.value = receipt ? 'Anulación confirmada. El documento original se conserva.' : store.reverseError
    await refresh()
    await nextTick(); heading.value?.focus()
  }
}
const heading = ref<HTMLElement | null>(null), online = ref(navigator.onLine)
async function exportPdf() {
  const selectedId = id.value
  if (!allowed.value || !online.value || !document.value) return
  await store.exportPdf(selectedId, () => viewActive.value && allowed.value && id.value === selectedId)
}
async function refresh() {
  if (!allowed.value) return
  if (!isAgreementId(id.value)) {
    store.detail = null
    store.detailError = 'El identificador del acuerdo no es válido.'
    return
  }
  void reloadPayments()
  if (!online.value) return
  const result = await store.loadDetail(id.value)
  if (result && allowed.value) { await nextTick(); heading.value?.focus() }
}
async function reloadPayments() {
  if (allowed.value && isAgreementId(id.value)) await payments.load(id.value)
}
/** After a payment change the agreement detail is re-read from the server without moving focus. */
async function refreshDetailQuietly() {
  const selectedId = id.value
  if (allowed.value && online.value && isAgreementId(selectedId)) await store.loadDetail(selectedId)
}
function onOnline() { online.value = true; if (!store.detailLoading) void refresh() }
function onOffline() { online.value = false }
watch([id, allowed, () => auth.token, () => session.owner?.accountId, () => session.owner?.apiBase,
  () => session.memberId, () => session.deviceId, () => session.deviceToken], () => {
  voidOpen.value = false; mutationNotice.value = ''
  if (!allowed.value) return
  if (!online.value && store.detail?.id !== id.value) store.detail = null
  void refresh()
}, { immediate: true })
onMounted(() => { window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline) })
onUnmounted(() => { viewActive.value = false; window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) })
</script>

<style scoped>
.agreement-page { display: grid; gap: var(--spacing-lg); max-width: 1000px; margin: 0 auto; min-width: 0; overflow-wrap: anywhere; }
.agreement-people { display: grid; gap: var(--spacing-md); list-style: none; padding: 0; }
.agreement-figures { display: grid; gap: var(--spacing-md); }
.agreement-figures dd { margin: 0; font-size: var(--font-size-xl, 1.35rem); font-weight: 700; font-variant-numeric: tabular-nums; }
h2, h3 { margin: 0 0 var(--spacing-sm); }
@media (min-width: 768px) { .agreement-figures { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
