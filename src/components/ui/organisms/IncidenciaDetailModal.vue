<template>
  <!-- Organismo: detalle + resolver de una incidencia (D2). Sobre la lista,
       nunca una ruta `:id` (no existe ninguna en este proyecto). Al abrir pide
       GET /incidencias/:id (única llamada que trae la venta anidada); si está
       pendiente ofrece el formulario de resolver, si ya está resuelta solo
       muestra las notas. -->
  <AppModal
    :model-value="modelValue"
    :title="VOICE.incidencias.detailTitle"
    size="lg"
    hide-footer
    :close-on-backdrop="!resolving"
    @update:model-value="onModalChange"
  >
    <div
      v-if="status === 'loading'"
      class="incidencia-detail-modal__loading"
      role="status"
    >
      {{ VOICE.incidencias.detailLoading }}
    </div>

    <div
      v-else-if="status === 'error'"
      class="incidencia-detail-modal__error"
    >
      <AppAlert type="error">
        {{ loadError }}
      </AppAlert>
      <AppButton
        class="incidencia-detail-modal__retry"
        variant="secondary"
        @click="load"
      >
        {{ VOICE.incidencias.retry }}
      </AppButton>
    </div>

    <div
      v-else-if="detail"
      class="incidencia-detail-modal__body"
    >
      <AppAlert
        v-if="resolveError"
        type="error"
      >
        {{ resolveError }}
      </AppAlert>

      <section class="incidencia-detail-modal__section">
        <h3>{{ typeLabel(detail.type) }}</h3>
        <p class="incidencia-detail-modal__reason">
          {{ detail.reason }}
        </p>
        <p class="incidencia-detail-modal__detected">
          {{ formatDate(detail.detectedAt) }}
        </p>
      </section>

      <section class="incidencia-detail-modal__section">
        <h3>{{ VOICE.incidencias.saleTitle }}</h3>
        <template v-if="detail.sale">
          <p>{{ formatMinorMoney(detail.sale.totalMinor ?? 0) }} · {{ formatDate(detail.sale.occurredAt) }}</p>
          <p class="incidencia-detail-modal__sale-items">
            {{ detail.sale.items.length }} {{ detail.sale.items.length === 1 ? 'producto' : 'productos' }}
          </p>
        </template>
        <p
          v-else
          class="incidencia-detail-modal__sale-missing"
        >
          {{ VOICE.incidencias.saleMissing }}
        </p>
      </section>

      <section class="incidencia-detail-modal__section">
        <template v-if="detail.resolutionStatus === 'pendiente'">
          <AppTextarea
            v-model="notes"
            :label="VOICE.incidencias.resolutionNotesLabel"
            :placeholder="VOICE.incidencias.resolutionNotesPlaceholder"
            :error="notesError ?? undefined"
            :disabled="resolving"
            :rows="4"
          />
          <AppButton
            class="incidencia-detail-modal__resolve"
            variant="primary"
            :disabled="!notes.trim() || resolving"
            @click="submitResolve"
          >
            {{ resolving ? VOICE.incidencias.resolving : VOICE.incidencias.resolve }}
          </AppButton>
        </template>

        <template v-else>
          <h3>{{ VOICE.incidencias.resolvedNotesTitle }}</h3>
          <p>{{ detail.resolutionNotes }}</p>
          <p
            v-if="detail.resolvedAt"
            class="incidencia-detail-modal__resolved-at"
          >
            {{ VOICE.incidencias.resolvedByTitle }}: {{ formatDate(detail.resolvedAt) }}
          </p>
        </template>
      </section>

      <div class="incidencia-detail-modal__actions">
        <AppButton
          class="incidencia-detail-modal__close"
          variant="secondary"
          @click="close"
        >
          {{ VOICE.incidencias.close }}
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { AppAlert, AppButton, AppModal, AppTextarea } from '@/components'
import { VOICE, incidenciaLoadErrorMessage, incidenciaResolveErrorMessage, isIncidenciaNotesValidationError } from '@/config/voice'
import IncidenciasService from '@/services/incidencias.service'
import { formatMinorMoney } from '@/utils/money'
import type { Incidencia, IncidenciaType, IncidenciaWithSale } from '@/types/incidencia.types'

const props = defineProps<{
  modelValue: boolean
  incidenciaId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  resolved: [incidencia: Incidencia]
}>()

const detail = ref<IncidenciaWithSale | null>(null)
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const loadError = ref('')

const notes = ref('')
const notesError = ref<string | null>(null)
const resolving = ref(false)
const resolveError = ref<string | null>(null)

function typeLabel(type: IncidenciaType): string {
  return type === 'conflicto_stock' ? VOICE.incidencias.typeConflictoStock : VOICE.incidencias.typeIncidenciaFecha
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

async function load() {
  if (!props.incidenciaId) return
  status.value = 'loading'
  loadError.value = ''
  try {
    detail.value = await IncidenciasService.getIncidencia(props.incidenciaId)
    status.value = 'ready'
    notes.value = ''
    notesError.value = null
    resolveError.value = null
  } catch (cause) {
    loadError.value = incidenciaLoadErrorMessage(cause)
    status.value = 'error'
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) load()
    else {
      detail.value = null
      status.value = 'idle'
      notes.value = ''
      notesError.value = null
      resolveError.value = null
    }
  },
  { immediate: true },
)

async function submitResolve() {
  if (!props.incidenciaId || resolving.value) return
  const trimmed = notes.value.trim()
  if (!trimmed) {
    notesError.value = VOICE.incidencias.resolutionNotesRequired
    return
  }
  if (trimmed.length > 2000) {
    notesError.value = VOICE.incidencias.resolutionNotesTooLong
    return
  }
  notesError.value = null
  resolveError.value = null
  resolving.value = true
  try {
    const resolved = await IncidenciasService.resolverIncidencia(props.incidenciaId, trimmed)
    if (detail.value) detail.value = { ...detail.value, ...resolved }
    emit('resolved', resolved)
  } catch (cause) {
    if (isIncidenciaNotesValidationError(cause)) {
      resolveError.value = incidenciaResolveErrorMessage(cause)
    } else {
      // 409 (ya estaba resuelta) u otra falla: se refleja el estado más
      // reciente del servidor en vez de dejar el formulario obsoleto.
      resolveError.value = incidenciaResolveErrorMessage(cause)
      try {
        detail.value = await IncidenciasService.getIncidencia(props.incidenciaId)
      } catch {
        // Si tampoco se puede refrescar, se queda el aviso de arriba.
      }
    }
  } finally {
    resolving.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}

function onModalChange(open: boolean) {
  if (!open && resolving.value) return
  emit('update:modelValue', open)
}
</script>

<style scoped>
.incidencia-detail-modal__loading,
.incidencia-detail-modal__error {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.incidencia-detail-modal__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.incidencia-detail-modal__section h3 {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-md);
  color: var(--color-text);
}

.incidencia-detail-modal__reason {
  margin: 0;
  color: var(--color-text);
}

.incidencia-detail-modal__detected,
.incidencia-detail-modal__sale-items,
.incidencia-detail-modal__sale-missing,
.incidencia-detail-modal__resolved-at {
  margin: var(--spacing-xs) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.incidencia-detail-modal__actions {
  display: flex;
  justify-content: flex-end;
}
</style>
