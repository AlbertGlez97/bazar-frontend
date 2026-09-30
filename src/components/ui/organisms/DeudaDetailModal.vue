<template>
  <!-- Organismo: detalle de una deuda (P4). Sobre la lista, nunca una ruta
       `:id` (no existe ninguna en este proyecto) — mismo patrón que
       IncidenciaDetailModal. Al abrir pide GET /deudas/:id y GET
       /products/:id (Deuda no trae el nombre del producto, solo su id).
       Decisión (documentada en el task doc): las cuotas planeadas se
       muestran aquí solo de forma INFORMATIVA (calendario de solo lectura);
       agregar/editar/borrar cuotas queda fuera de este modal — el único
       componente que usa el datepicker (CuotasPlaneadasEditor) es
       RegistrarDeudaModal, al CREAR la deuda. -->
  <AppModal
    :model-value="modelValue"
    :title="VOICE.deudasView.detailTitle"
    size="lg"
    hide-footer
    :close-on-backdrop="!submittingAbono"
    @update:model-value="onModalChange"
  >
    <div
      v-if="status === 'loading'"
      class="deuda-detail-modal__loading"
      role="status"
    >
      {{ VOICE.deudasView.detailLoading }}
    </div>

    <div
      v-else-if="status === 'error'"
      class="deuda-detail-modal__error"
    >
      <AppAlert type="error">
        {{ loadError }}
      </AppAlert>
      <AppButton
        variant="secondary"
        @click="load"
      >
        {{ VOICE.deudasView.retry }}
      </AppButton>
    </div>

    <div
      v-else-if="deuda"
      class="deuda-detail-modal__body"
    >
      <section class="deuda-detail-modal__section deuda-detail-modal__header">
        <AppBadge :color="deudaStatusColor(deuda)">
          {{ deudaStatusLabel(deuda) }}
        </AppBadge>
        <AppBadge :color="deuda.type === 'fiado' ? 'blue' : 'gray'">
          {{ deuda.type === 'fiado' ? VOICE.deuda.typeFiado : VOICE.deuda.typeApartado }}
        </AppBadge>
        <AppBadge
          v-if="atrasada"
          color="red"
        >
          {{ VOICE.deudasView.atrasadaBadge }}
        </AppBadge>
      </section>

      <section class="deuda-detail-modal__section">
        <h3>{{ deuda.deudor?.nombre ?? '—' }}</h3>
        <p v-if="deuda.deudor?.telefono">
          {{ deuda.deudor.telefono }}
        </p>
        <p v-if="deuda.deudor?.notas">
          {{ deuda.deudor.notas }}
        </p>
      </section>

      <section class="deuda-detail-modal__section">
        <p>{{ VOICE.deudasView.productLabel }}: {{ product?.name ?? '—' }}</p>
        <p>{{ VOICE.deudasView.quantityLabel }}: {{ deuda.cantidad }}</p>
        <p>{{ VOICE.reports.totalLabel }}: {{ formatMinorMoney(deuda.totalMinor) }}</p>
        <p>{{ VOICE.deudasView.columnSaldo }}: {{ formatMinorMoney(pendienteMinor) }}</p>
      </section>

      <section class="deuda-detail-modal__section">
        <h3>{{ VOICE.deudasView.abonosTitle }}</h3>
        <p
          v-if="deuda.abonos.length === 0"
          class="deuda-detail-modal__empty"
        >
          {{ VOICE.deudasView.abonosEmpty }}
        </p>
        <ul
          v-else
          class="deuda-detail-modal__list"
        >
          <li
            v-for="abono in deuda.abonos"
            :key="abono.id"
          >
            {{ formatMinorMoney(abono.montoMinor) }} · {{ formatDate(abono.receivedAt) }}
            <span v-if="abono.nota"> · {{ abono.nota }}</span>
          </li>
        </ul>
      </section>

      <section class="deuda-detail-modal__section">
        <h3>{{ VOICE.deudasView.cuotasTitle }}</h3>
        <p
          v-if="deuda.cuotasPlaneadas.length === 0"
          class="deuda-detail-modal__empty"
        >
          {{ VOICE.deudasView.cuotasEmpty }}
        </p>
        <ul
          v-else
          class="deuda-detail-modal__list"
        >
          <li
            v-for="cuota in deuda.cuotasPlaneadas"
            :key="cuota.id"
          >
            {{ formatDate(cuota.fechaEsperada) }} · {{ formatMinorMoney(cuota.montoEsperadoMinor) }}
          </li>
        </ul>
      </section>

      <section
        v-if="deuda.status === 'pendiente'"
        class="deuda-detail-modal__section"
      >
        <h3>{{ VOICE.deudasView.registerAbonoTitle }}</h3>
        <AppAlert
          v-if="abonoServerError"
          type="error"
        >
          {{ abonoServerError }}
        </AppAlert>
        <AppInput
          v-model="abonoText"
          :label="VOICE.deudasView.registerAbonoLabel"
          type="text"
          inputmode="decimal"
          placeholder="0.00"
          :error="abonoError ?? undefined"
          :disabled="submittingAbono"
        />
        <AppTextarea
          v-model="abonoNota"
          :label="VOICE.deudasView.registerAbonoNotaLabel"
          :rows="2"
          :disabled="submittingAbono"
        />
        <AppButton
          data-action="submit-abono"
          variant="primary"
          :disabled="submittingAbono"
          @click="submitAbono"
        >
          {{ submittingAbono ? VOICE.deudasView.registeringAbono : VOICE.deudasView.registerAbono }}
        </AppButton>
      </section>

      <div class="deuda-detail-modal__actions">
        <AppButton
          data-action="close-deuda-detail"
          variant="secondary"
          @click="close"
        >
          {{ VOICE.deudasView.close }}
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AppAlert, AppBadge, AppButton, AppInput, AppModal, AppTextarea } from '@/components'
import { VOICE } from '@/config/voice'
import { friendlyDeudaErrorMessage } from '@/services/deuda-errors'
import DeudasService from '@/services/deudas.service'
import ProductsService from '@/services/products.service'
import { formatMinorMoney, parseMoneyText } from '@/utils/money'
import { isDeudaAtrasada, pendienteMinorOf, deudaStatusColor, deudaStatusLabel } from '@/utils/deuda-status'
import type { Deuda } from '@/types/deuda.types'
import type { Product } from '@/types/product.types'

const props = defineProps<{
  modelValue: boolean
  deudaId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  'abono-registrado': [deuda: Deuda]
}>()

const deuda = ref<Deuda | null>(null)
const product = ref<Product | null>(null)
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const loadError = ref('')

const abonoText = ref('')
const abonoNota = ref('')
const abonoError = ref<string | null>(null)
const abonoServerError = ref<string | null>(null)
const submittingAbono = ref(false)

const pendienteMinor = computed(() => (deuda.value ? pendienteMinorOf(deuda.value) : 0))
const atrasada = computed(() => (deuda.value ? isDeudaAtrasada(deuda.value) : false))

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function load() {
  if (!props.deudaId) return
  status.value = 'loading'
  loadError.value = ''
  try {
    const [loadedDeuda] = await Promise.all([DeudasService.getDeuda(props.deudaId)])
    deuda.value = loadedDeuda
    product.value = await ProductsService.getProduct(loadedDeuda.productId)
    status.value = 'ready'
    abonoText.value = ''
    abonoNota.value = ''
    abonoError.value = null
    abonoServerError.value = null
  } catch {
    loadError.value = VOICE.deudasView.detailLoadError
    status.value = 'error'
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) load()
    else {
      deuda.value = null
      product.value = null
      status.value = 'idle'
    }
  },
  { immediate: true },
)

async function submitAbono() {
  if (!deuda.value || submittingAbono.value) return
  const montoMinor = parseMoneyText(abonoText.value)
  if (montoMinor === null || montoMinor <= 0) {
    abonoError.value = VOICE.deudasView.registerAbonoRequired
    return
  }
  abonoError.value = null
  abonoServerError.value = null
  submittingAbono.value = true
  try {
    const trimmedNota = abonoNota.value.trim()
    const updated = await DeudasService.createAbono(deuda.value.id, {
      montoMinor,
      ...(trimmedNota ? { nota: trimmedNota } : {}),
    })
    deuda.value = updated
    abonoText.value = ''
    abonoNota.value = ''
    emit('abono-registrado', updated)
  } catch (cause) {
    abonoServerError.value = friendlyDeudaErrorMessage(cause)
  } finally {
    submittingAbono.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}

function onModalChange(open: boolean) {
  if (!open && submittingAbono.value) return
  emit('update:modelValue', open)
}
</script>

<style scoped>
.deuda-detail-modal__loading,
.deuda-detail-modal__error {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.deuda-detail-modal__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.deuda-detail-modal__header { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }

.deuda-detail-modal__section h3 {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-md);
  color: var(--color-text);
}
.deuda-detail-modal__section p { margin: var(--spacing-xs) 0 0; color: var(--color-text); }

.deuda-detail-modal__empty { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }

.deuda-detail-modal__list {
  list-style: none;
  margin: var(--spacing-xs) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.deuda-detail-modal__actions { display: flex; justify-content: flex-end; }
</style>
