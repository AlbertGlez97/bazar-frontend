<template>
  <!-- Organismo: lector de QR en un modal. Es organismo porque incluye AppModal.
       Presentacional: no lee stores. Recibe si está abierto (v-model) y la
       respuesta que dio quien lo usa a la última lectura (`feedback`); emite
       `scan(texto)` UNA vez por lectura distinta. La cámara vive detrás del
       adaptador `services/qr-scanner` (aquí solo se controla su ciclo de vida). -->
  <AppModal
    :model-value="modelValue"
    :title="VOICE.scan.title"
    size="md"
    hide-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="qr-scanner">
      <!-- El video siempre existe mientras el modal está abierto (hace falta
           para conectar la cámara); se oculta si todavía carga o falló. -->
      <div
        v-show="status === 'scanning'"
        class="qr-scanner__frame"
      >
        <video
          ref="videoEl"
          class="qr-scanner__video"
          aria-label="Vista de la cámara para leer el código QR"
          muted
          playsinline
        />
        <span
          class="qr-scanner__target"
          aria-hidden="true"
        />
      </div>

      <p
        v-if="status === 'loading'"
        class="qr-scanner__loading"
        role="status"
      >
        {{ VOICE.scan.loading }}
      </p>

      <template v-else-if="status === 'error'">
        <p
          class="qr-scanner__error"
          role="alert"
        >
          <span
            class="qr-scanner__error-icon"
            aria-hidden="true"
          >📷</span>
          {{ errorMessage }}
        </p>
        <AppButton
          v-if="canRetry"
          variant="secondary"
          size="lg"
          class="qr-scanner__action"
          @click="start"
        >
          {{ VOICE.scan.retry }}
        </AppButton>
      </template>

      <p
        v-else
        class="qr-scanner__hint"
      >
        {{ VOICE.scan.hint }}
      </p>

      <!-- Región viva: lo que pasó con la última lectura (agregado / no reconocido) -->
      <p
        class="qr-scanner__feedback"
        :class="feedback ? `qr-scanner__feedback--${feedback.kind}` : ''"
        role="status"
        aria-live="polite"
      >
        {{ feedback?.text }}
      </p>
    </div>

    <template #footer>
      <AppButton
        variant="primary"
        size="lg"
        class="qr-scanner__action qr-scanner__done"
        @click="emit('update:modelValue', false)"
      >
        {{ VOICE.scan.done }}
      </AppButton>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  createScanDeduper,
  getScanSupport,
  startQrScanner,
  QrScannerError,
  type QrScannerHandle,
} from '@/services/qr-scanner'
import { VOICE, cameraErrorMessage, type CameraFailure } from '@/config/voice'
import AppButton from '../atoms/AppButton.vue'
import AppModal from './AppModal.vue'

const props = defineProps<{
  /** Abierto (v-model). Abierto = cámara encendida; cerrado o desmontado = apagada. */
  modelValue: boolean
  /** Qué pasó con la última lectura; lo decide quien usa el modal. */
  feedback?: { kind: 'success' | 'warning'; text: string } | null
}>()

const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  scan: [text: string]
}>()

/** Una misma lectura dentro de este lapso cuenta una sola vez. */
const REPEAT_WINDOW_MS = 1500

type Status = 'loading' | 'scanning' | 'error'

const videoEl = ref<HTMLVideoElement | null>(null)
const status = ref<Status>('loading')
const failure = ref<CameraFailure>('unknown')

const errorMessage = computed(() => cameraErrorMessage(failure.value))
// Reintentar sirve cuando fue el permiso, la cámara ocupada o algo pasajero;
// con contexto inseguro o navegador sin soporte volvería a fallar igual.
const canRetry = computed(() => failure.value !== 'insecure-context' && failure.value !== 'unsupported')

let handle: QrScannerHandle | null = null
/** Cada arranque tiene su número: un arranque viejo que termina tarde se apaga solo. */
let attempt = 0
let accept = createScanDeduper(REPEAT_WINDOW_MS)

function stopCamera() {
  attempt += 1
  handle?.stop()
  handle = null
}

async function start() {
  stopCamera()
  const mine = attempt
  status.value = 'loading'
  accept = createScanDeduper(REPEAT_WINDOW_MS)

  const support = getScanSupport()
  if (support !== 'ok') {
    failure.value = support
    status.value = 'error'
    return
  }

  await nextTick()
  if (mine !== attempt || !videoEl.value) return

  try {
    const started = await startQrScanner(videoEl.value, (text) => {
      // Una lectura que llega después de cerrar no cuenta.
      if (mine === attempt && accept(text)) emit('scan', text)
    })
    if (mine !== attempt) {
      // Se cerró (o se reintentó) mientras arrancaba: no dejar la cámara encendida.
      started.stop()
      return
    }
    handle = started
    status.value = 'scanning'
  } catch (cause) {
    if (mine !== attempt) return
    failure.value = cause instanceof QrScannerError ? cause.code : 'unknown'
    status.value = 'error'
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) void start()
    else stopCamera()
  },
  { immediate: true, flush: 'post' },
)

onBeforeUnmount(stopCamera)
</script>

<style scoped>
.qr-scanner {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  color: var(--color-text);
}

/* Cuadro de la cámara: cuadrado, con marco de puntería decorativo */
.qr-scanner__frame {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  max-height: 60vh;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-text);
}
.qr-scanner__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.qr-scanner__target {
  position: absolute;
  inset: 18%;
  border: 3px solid var(--color-accent);
  border-radius: var(--radius-lg);
  box-shadow: 0 0 0 9999px color-mix(in srgb, var(--color-text) 35%, transparent);
  pointer-events: none;
}

.qr-scanner__loading,
.qr-scanner__hint {
  margin: 0;
  text-align: center;
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
}
.qr-scanner__hint { font-weight: 600; color: var(--color-text); }

.qr-scanner__error {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg) var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--color-warning-soft);
  color: var(--color-text);
  font-size: var(--font-size-md);
  line-height: 1.5;
  text-align: center;
}
.qr-scanner__error-icon { font-size: 2.5rem; line-height: 1; }

/* Respuesta a la última lectura: reserva su alto para que el video no salte */
.qr-scanner__feedback {
  margin: 0;
  min-height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: 600;
  text-align: center;
}
.qr-scanner__feedback--success { background: var(--color-success-soft); color: var(--color-success); }
.qr-scanner__feedback--warning { background: var(--color-warning-soft); color: var(--color-warning); }

/* Objetivo táctil grande (56 px): el botón "Listo" y el de reintentar */
.qr-scanner__action { min-height: 3.5rem; font-size: var(--font-size-md); font-weight: 700; }
.qr-scanner__done { width: 100%; }
</style>
