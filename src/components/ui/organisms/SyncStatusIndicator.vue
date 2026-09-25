<template>
  <!-- Organismo: indicador calmado de la cola de ventas offline. Es organismo
       porque incluye AppModal (la lista de ventas por revisar). Presentacional:
       recibe los contadores y los registros por props y emite `dismiss`.
       No dibuja nada cuando no hay nada que avisar. -->
  <div
    v-if="pendingCount > 0 || needsReviewCount > 0"
    class="sync-status"
    role="status"
    aria-live="polite"
  >
    <p
      v-if="pendingCount > 0"
      class="sync-status__pending"
    >
      <span
        class="sync-status__dot"
        :class="{ 'sync-status__dot--spin': isSyncing }"
        aria-hidden="true"
      />
      {{ isSyncing ? salesSyncingMessage(pendingCount) : salesPendingMessage(pendingCount) }}
    </p>

    <!-- Aparte y amable: no es un error de quien vende, pero alguien debe leerlo -->
    <p
      v-if="needsReviewCount > 0"
      class="sync-status__review"
    >
      {{ salesNeedReviewMessage(needsReviewCount) }}
      <button
        type="button"
        class="sync-status__see"
        data-action="see-review"
        aria-label="Ver las ventas que necesitan revisión"
        @click="open = true"
      >
        Ver
      </button>
    </p>

    <AppModal
      v-model="open"
      title="Ventas por revisar"
      size="md"
      hide-close
    >
      <p class="sync-status__intro">
        Estas ventas no se pudieron registrar en el servidor. Un socio puede
        revisarlas. Cuando ya las hayas leído, toca «Entendido».
      </p>
      <ul class="sync-status__list">
        <li
          v-for="record in records"
          :key="record.id"
          class="sync-status__record"
        >
          <div class="sync-status__record-head">
            <strong class="sync-status__amount">${{ minorToDisplay(record.totalMinorEstimate) }}</strong>
            <span class="sync-status__meta">
              {{ formatTime(record.createdAt) }}<template v-if="record.sellerName"> · {{ record.sellerName }}</template>
            </span>
          </div>
          <p
            v-if="record.lastError"
            class="sync-status__reason"
          >
            {{ record.lastError }}
          </p>
          <button
            type="button"
            class="sync-status__dismiss"
            data-action="dismiss"
            :aria-label="`Entendido: venta de $${minorToDisplay(record.totalMinorEstimate)}`"
            @click="emit('dismiss', record.id)"
          >
            Entendido
          </button>
        </li>
      </ul>
      <template #footer>
        <AppButton
          variant="secondary"
          size="lg"
          class="sync-status__close"
          @click="open = false"
        >
          Cerrar
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { minorToDisplay } from '@/utils/money'
import { salesNeedReviewMessage, salesPendingMessage, salesSyncingMessage } from '@/config/voice'
import AppButton from '../atoms/AppButton.vue'
import AppModal from './AppModal.vue'

const props = defineProps<{
  pendingCount: number
  needsReviewCount: number
  isSyncing: boolean
  /** Ventas en revisión (forma de `PendingSale` de la cola, solo lo que se muestra) */
  records: {
    id: string
    createdAt: string
    totalMinorEstimate: number
    sellerName?: string
    /** Motivo amable en español */
    lastError?: string
  }[]
}>()

const emit = defineEmits<{
  /** La persona ya leyó esta venta */
  dismiss: [id: string]
}>()

const open = ref(false)

// Sin registros la lista no tiene sentido: se cierra sola al descartar la última.
watch(() => props.records.length, (length) => {
  if (length === 0) open.value = false
})

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
}
</script>

<style scoped>
.sync-status { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-sm); }

.sync-status__pending,
.sync-status__review {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin: 0;
  padding: 0.25rem 0.75rem;
  font-size: var(--font-size-sm);
  font-weight: 600;
  border-radius: var(--radius-full);
}
.sync-status__pending { color: var(--color-info); background: var(--color-info-soft); }
.sync-status__review { color: var(--color-warning); background: var(--color-warning-soft); padding-right: 0.25rem; }

.sync-status__dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: var(--color-info);
}
.sync-status__dot--spin {
  background: none;
  border: 2px solid color-mix(in srgb, var(--color-info) 30%, transparent);
  border-top-color: var(--color-info);
  width: 0.9rem;
  height: 0.9rem;
  animation: sync-status-spin 0.8s linear infinite;
}
@keyframes sync-status-spin { to { transform: rotate(360deg); } }

/* "Ver": 44 px al tacto aunque el texto sea chico */
.sync-status__see {
  min-width: 44px;
  min-height: 44px;
  padding: 0 var(--spacing-md);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-warning);
  background: var(--color-surface);
  border: 2px solid var(--color-warning);
  border-radius: var(--radius-full);
  cursor: pointer;
  touch-action: manipulation;
}
.sync-status__see:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }

.sync-status__intro { margin: 0 0 var(--spacing-md); font-size: var(--font-size-md); color: var(--color-text); }
.sync-status__list { display: flex; flex-direction: column; gap: var(--spacing-md); margin: 0; padding: 0; list-style: none; }
.sync-status__record {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-warning-soft);
  border-radius: var(--radius-md);
}
.sync-status__record-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--spacing-sm); flex-wrap: wrap; }
.sync-status__amount { font-family: var(--font-display); font-size: var(--font-size-xl); color: var(--color-text); }
.sync-status__meta { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.sync-status__reason { margin: 0; font-size: var(--font-size-md); line-height: 1.5; color: var(--color-text); }

.sync-status__dismiss {
  align-self: flex-start;
  min-width: 44px;
  min-height: 44px;
  padding: 0 var(--spacing-lg);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--color-on-primary);
  background: var(--color-primary);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  touch-action: manipulation;
}
.sync-status__dismiss:hover { background: var(--color-primary-hover); border-color: var(--color-primary-hover); }
.sync-status__dismiss:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }

.sync-status .sync-status__close { width: 100%; min-height: 3.5rem; font-weight: 700; }
</style>
