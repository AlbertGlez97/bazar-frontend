<template>
  <!-- Molécula: la verificación de seguridad de Cloudflare Turnstile. No hace fetch propio ni
       toca stores: carga el script (useTurnstile), dibuja el widget y avisa por eventos.
       Si algo falla lo dice con palabras claras y deja reintentar sin perder lo escrito en
       el formulario (el formulario ni se entera: solo recibe `failed`). -->
  <div
    class="turnstile-widget"
    role="group"
    aria-label="Verificación de seguridad"
  >
    <div
      ref="container"
      class="turnstile-widget__box"
    />
    <div
      v-if="problem"
      class="turnstile-widget__problem"
      role="alert"
    >
      <p>
        {{ problem === 'load'
          ? 'No pudimos cargar la verificación de seguridad. Revisa tu internet.'
          : 'No pudimos hacer la verificación de seguridad. Intenta de nuevo.' }}
      </p>
      <AppButton
        v-if="problem !== 'config'"
        type="button"
        variant="secondary"
        size="sm"
        @click="retry"
      >
        Reintentar
      </AppButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import { loadTurnstile, type TurnstileApi } from '@/composables/useTurnstile'

const props = defineProps<{
  /** Clave PÚBLICA del sitio (VITE_TURNSTILE_SITE_KEY) */
  siteKey: string
}>()

const emit = defineEmits<{
  /** La persona pasó la verificación; el token es de UN solo uso */
  verified: [token: string]
  /** El token venció o se agotó el tiempo: hay que volver a verificar */
  expired: []
  /** No se pudo cargar o falló: 'load' (script), 'error' (widget) o 'config' (sin clave) */
  failed: [kind: 'load' | 'error' | 'config']
}>()

const container = ref<HTMLElement | null>(null)
const problem = ref<'load' | 'error' | 'config' | null>(null)
let api: TurnstileApi | null = null
let widgetId: string | null = null

function fail(kind: 'load' | 'error' | 'config') {
  problem.value = kind
  emit('failed', kind)
}

async function draw() {
  problem.value = null
  if (!props.siteKey) {
    fail('config')
    return
  }
  try {
    api = await loadTurnstile()
  } catch {
    fail('load')
    return
  }
  if (!container.value || widgetId !== null) return
  widgetId = api.render(container.value, {
    sitekey: props.siteKey,
    language: 'es',
    theme: 'auto',
    callback: (token) => emit('verified', token),
    'expired-callback': () => emit('expired'),
    'timeout-callback': () => emit('expired'),
    'error-callback': () => fail('error'),
  })
}

/** El token se gasta en cada envío (acierte o falle): pide uno nuevo. */
function reset() {
  if (api && widgetId !== null) api.reset(widgetId)
}

function retry() {
  if (api && widgetId !== null) {
    problem.value = null
    api.reset(widgetId)
  } else {
    void draw()
  }
}

onMounted(draw)
onBeforeUnmount(() => {
  if (api && widgetId !== null) api.remove(widgetId)
  widgetId = null
})

defineExpose({ reset })
</script>

<style scoped>
.turnstile-widget { display: flex; flex-direction: column; gap: var(--spacing-sm); }
.turnstile-widget__box { min-height: 65px; max-width: 100%; overflow: hidden; }
.turnstile-widget__problem {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}
.turnstile-widget__problem p { margin: 0; }
</style>
