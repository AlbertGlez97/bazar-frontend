<template>
  <AppModal
    :model-value="modelValue"
    title="Crear acuerdo de reparto"
    size="lg"
    manage-focus
    hide-footer
    :hide-close="busy || pdfBusy"
    :close-on-backdrop="!busy && !pdfBusy"
    @update:model-value="close"
  >
    <section
      v-if="created"
      class="agreement-confirm"
      aria-live="polite"
      data-test="agreement-success"
    >
      <h3
        ref="successHeading"
        tabindex="-1"
      >
        {{ created.status === 'voided' ? 'Acuerdo recuperado' : 'Acuerdo creado' }}: {{ created.folio }}
      </h3>
      <AppAlert
        v-if="created.status === 'voided'"
        type="warning"
        title="Acuerdo anulado"
        data-test="replayed-voided"
      >
        <p>Este acuerdo ya fue anulado. El reintento recuperó el mismo documento; no creó otro acuerdo.</p>
        <template v-if="created.reversal">
          <p>Motivo: {{ created.reversal.reason }}</p>
          <p>Anulado: {{ formatAgreementInstant(created.reversal.occurredAt) }} (UTC-6)</p>
        </template>
        <p v-if="created.replacedBy">
          Sustituido por: {{ created.replacedBy.folio }}
        </p>
      </AppAlert>
      <p>{{ created.title }}</p>
      <p>{{ created.notice }}</p>
      <p
        v-if="pdfError"
        role="alert"
        data-test="created-pdf-error"
      >
        {{ pdfError }}
      </p>
      <div class="agreement-actions">
        <AppButton
          type="button"
          data-test="created-pdf"
          :disabled="!pdfAllowed || pdfBusy"
          :loading="pdfBusy"
          @click="generatePdf"
        >
          Generar PDF
        </AppButton>
        <RouterLink
          :to="'/app/finanzas/acuerdos/' + created.id"
          data-test="view-created"
        >
          Ver acuerdo
        </RouterLink>
        <AppButton
          type="button"
          variant="secondary"
          data-test="back-simulator"
          @click="close(false)"
        >
          Volver al simulador
        </AppButton>
      </div>
    </section>
    <form
      v-else
      class="agreement-confirm"
      novalidate
      data-test="agreement-form"
      :aria-busy="busy"
      @submit.prevent="submit"
    >
      <p>{{ AGREEMENT_NOTICE }}</p>
      <p
        v-if="replacement"
        data-test="replacement-confirmation"
      >
        Este nuevo acuerdo sustituirá a {{ replacement.folio }}. El documento anterior no se editará.
      </p>
      <p
        v-else-if="pending?.replacesAgreementId"
        data-test="replacement-confirmation"
      >
        El intento original conserva la sustitución del acuerdo {{ pending.replacesAgreementId }}.
      </p>
      <p>Revisa con las personas participantes antes de crear el acuerdo. Se conservará este resultado sin editarlo.</p>
      <AppAlert
        v-if="pending"
        type="warning"
        title="Intento pendiente de confirmación"
        data-test="pending-attempt"
      >
        <p>La respuesta anterior no se confirmó. Reintentar enviará exactamente el mismo título, monto, regla, período e identificador; no usará una nueva simulación ni los cambios del formulario.</p>
      </AppAlert>
      <AppAlert
        v-else-if="!eligible"
        type="warning"
        title="La simulación ya no está lista"
        data-test="ineligible-confirmation"
      >
        <p>Actualiza los datos y calcula una nueva simulación antes de crear el acuerdo.</p>
      </AppAlert>
      <!-- Lo disponible del período, lo que otros acuerdos vigentes ya reparten y lo que queda libre -->
      <CommitmentSummary
        :commitment="shownCommitment"
        :loading="commitmentLoading"
        :error="commitmentError"
      />
      <AppAlert
        v-if="commitmentBlock"
        type="warning"
        title="No hay suficiente disponible libre"
        role="alert"
        data-test="commitment-block"
      >
        <p>{{ commitmentBlock }}</p>
      </AppAlert>
      <AppInput
        id="agreement-title"
        v-model="title"
        label="Título del acuerdo"
        required
        :maxlength="120"
        :disabled="busy || !!pending"
      />
      <AppTextarea
        id="agreement-note"
        v-model="note"
        label="Nota (opcional)"
        :maxlength="1000"
        :rows="3"
        :disabled="busy || !!pending"
      />
      <section
        v-if="reviewRequest"
        aria-labelledby="agreement-review-title"
        data-test="agreement-review"
      >
        <h3 id="agreement-review-title">
          Resultado a conservar
        </h3>
        <p>Período: {{ formatReservePeriod(reviewRequest.from, reviewRequest.to) }}</p>
        <p>Monto: {{ formatMinorMoney(reviewRequest.requestedAmountMinor) }}</p>
        <p>Regla: {{ bpsToPercentText(reviewRequest.partnerShareBps) }}% por ser socio · {{ bpsToPercentText(reviewRequest.workShareBps) }}% por trabajo.</p>
        <p>Socios por partes iguales (EQUAL). Base del trabajo: {{ reviewRequest.workBasis === 'WORK_SHIFTS' ? 'Jornadas' : 'Horas registradas' }}.</p>
        <template v-if="reviewSimulation">
          <p>Base financiera: {{ formatMinorMoney(reviewSimulation.financialBase.potentiallyAvailableMinor) }} · {{ reviewSimulation.financialBase.status === 'partial' ? 'Parcial' : 'Completa' }}.</p>
          <p>Restaría potencialmente: {{ formatMinorMoney(reviewSimulation.financialBase.remainingAvailableMinor) }}.</p>
          <p>Componente socios: {{ formatMinorMoney(reviewSimulation.pools.partnerPoolMinor) }}. Componente trabajo: {{ formatMinorMoney(reviewSimulation.pools.workPoolMinor) }}.</p>
          <ul
            class="agreement-people"
            aria-label="Personas participantes"
          >
            <li
              v-for="person in reviewSimulation.members"
              :key="person.memberId"
            >
              <strong>{{ person.name }}</strong> · {{ person.role === 'socio' ? 'Socio' : 'Colaborador' }} · {{ person.isActive ? 'Activo' : 'Inactivo' }}
              <p>Por ser socio: {{ formatMinorMoney(person.partnerAmountMinor) }} · Por trabajo: {{ formatMinorMoney(person.workAmountMinor) }} · Total: {{ formatMinorMoney(person.totalMinor) }}</p>
              <p>Trabajo: {{ person.workUnits }} {{ reviewRequest.workBasis === 'WORK_SHIFTS' ? 'jornadas' : 'minutos conocidos' }}. Jornadas: {{ person.shiftCount }} · Minutos conocidos: {{ person.knownMinutes }} · Sin duración: {{ person.unknownDurationCount }}.</p>
            </li>
          </ul>
          <p>Total asignado: {{ formatMinorMoney(reviewSimulation.totals.distributedMinor) }}. Sin asignar: {{ formatMinorMoney(reviewSimulation.totals.undistributedMinor) }}.</p>
          <ul
            v-if="reviewSimulation.warnings.length"
            aria-label="Avisos del cálculo"
          >
            <li
              v-for="warning in reviewSimulation.warnings"
              :key="warning.code"
            >
              {{ agreementWarningText(warning.code) }}
            </li>
          </ul>
        </template>
        <p v-else-if="pending">
          Se reintentará el cuerpo original. El servidor devolverá el documento confirmado; no sustituiremos sus participantes por los de otro cálculo.
        </p>
      </section>
      <p
        v-if="formError || error"
        ref="errorBox"
        role="alert"
        tabindex="-1"
        data-test="agreement-form-error"
      >
        {{ formError || error }}
      </p>
      <div class="agreement-actions">
        <AppButton
          v-if="pending"
          type="button"
          :loading="busy"
          :disabled="!retryAllowed || busy"
          data-test="retry-agreement"
          @click="retry"
        >
          Reintentar el mismo intento
        </AppButton>
        <AppButton
          v-else
          type="submit"
          :loading="busy"
          :disabled="!eligible || busy || !title.trim() || title.trim().length > 120 || note.trim().length > 1000 || !!commitmentBlock"
          data-test="confirm-agreement"
        >
          Crear acuerdo de reparto
        </AppButton>
        <AppButton
          type="button"
          variant="ghost"
          :disabled="busy"
          data-test="cancel-agreement"
          @click="close(false)"
        >
          Cancelar
        </AppButton>
      </div>
    </form>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { AppAlert, AppButton, AppInput, AppModal, AppTextarea, CommitmentSummary } from '@/components'
import { AGREEMENT_NOTICE, formatAgreementInstant, agreementWarningText, normalizeAgreementFields, agreementErrorMessage, commitmentNotice } from '@/utils/finance-agreements'
import { bpsToPercentText } from '@/utils/finance-distribution'
import { formatReservePeriod } from '@/utils/finance-reserves'
import { formatMinorMoney } from '@/utils/money'
import type { DistributionSimulation, DistributionSimulationRequest } from '@/types/finance-distribution.types'
import type { AgreementCommitment, AgreementFields, CreateAgreementPayload, DistributionAgreement } from '@/types/finance-agreement.types'

const props = defineProps<{
  modelValue: boolean
  simulation: DistributionSimulation | null
  request: DistributionSimulationRequest | null
  eligible: boolean
  retryAllowed: boolean
  busy: boolean
  error: string
  pending: CreateAgreementPayload | null
  pdfBusy?: boolean
  pdfAllowed?: boolean
  pdfError?: string
  replacement?: { id: string; folio: string } | null
  created: DistributionAgreement | null
  /** Disponible / comprometido / libre del período; solo un aviso, el servidor revisa de nuevo al crear. */
  commitment?: AgreementCommitment | null
  commitmentLoading?: boolean
  commitmentError?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; create: [fields: AgreementFields]; retry: []; pdf: [] }>()
const title = ref(''), note = ref(''), formError = ref('')
const errorBox = ref<HTMLElement | null>(null), successHeading = ref<HTMLElement | null>(null)
const reviewRequest = computed(() => props.pending ?? props.request)
// Solo vale la cifra del mismo período que se va a guardar; una de otro período no se usa.
const shownCommitment = computed(() => {
  const value = props.commitment, target = reviewRequest.value
  return value && target && value.from === target.from && value.to === target.to ? value : null
})
// Repetir un intento ya enviado no es un acuerdo nuevo: el aviso solo frena una creación nueva.
const commitmentBlock = computed(() => {
  if (props.pending || !shownCommitment.value || !props.request) return ''
  return commitmentNotice(shownCommitment.value, props.request.requestedAmountMinor).message
})
const reviewSimulation = computed(() => props.simulation && (!props.pending || props.simulation.simulationFingerprint === props.pending.simulationFingerprint) ? props.simulation : null)
watch(() => props.modelValue, (open) => {
  if (!open) return
  title.value = props.pending?.title ?? ''
  note.value = props.pending?.note ?? ''
  formError.value = ''
}, { immediate: true })
watch(() => props.created, async (document) => { if (document && props.modelValue) { await nextTick(); successHeading.value?.focus() } })
watch(() => props.error, async (error) => { if (error && props.modelValue) { await nextTick(); errorBox.value?.focus() } })
function close(open: boolean) { if (!props.busy && !props.pdfBusy) emit('update:modelValue', open) }
function generatePdf() { if (props.created && props.pdfAllowed && !props.pdfBusy) emit('pdf') }
function retry() { if (props.pending && props.retryAllowed && !props.busy) emit('retry') }
async function submit() {
  if (!props.eligible || props.busy || props.pending || !props.request || !props.simulation || commitmentBlock.value) return
  try {
    const fields = normalizeAgreementFields({ ...props.request, title: title.value, note: note.value,
      simulationFingerprint: props.simulation.simulationFingerprint,
      ...(props.replacement ? { replacesAgreementId: props.replacement.id } : {}) })
    formError.value = ''
    emit('create', fields)
  } catch (cause) {
    formError.value = agreementErrorMessage(cause)
    await nextTick()
    errorBox.value?.focus()
  }
}
</script>

<style scoped>
.agreement-confirm { display: grid; gap: var(--spacing-md); min-width: 0; overflow-wrap: anywhere; }
.agreement-confirm p { margin: 0; }
.agreement-confirm h3 { margin: 0 0 var(--spacing-sm); }
.agreement-people { display: grid; gap: var(--spacing-sm); list-style: none; padding: 0; }
.agreement-people li { padding: var(--spacing-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.agreement-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-sm); }
.agreement-actions :deep(.app-btn) { white-space: normal; }
[role='alert'] { color: var(--color-danger); }
</style>
