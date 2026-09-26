<template>
  <!-- Vista: Dispositivos (solo socios). Contenedor: pide la lista, abre el registro
       y la confirmación de revocar/reemitir en cuadros, y decide qué mostrar según
       lo que responde el servidor. El código de un solo uso se muestra UNA vez (o
       se copia de la fila mientras el dispositivo sigue pendiente) y nunca se
       guarda en el navegador. El guard del router ya impide entrar a un colaborador;
       aquí se vigila si el rol cambia con la vista abierta. -->
  <section
    class="devices-view"
    aria-labelledby="devices-title"
  >
    <RouterLink
      to="/app/ajustes"
      class="devices-view__back"
    >
      ← Volver a ajustes
    </RouterLink>

    <header class="devices-view__header">
      <div>
        <h1
          id="devices-title"
          class="devices-view__title"
        >
          {{ VOICE.devices.title }}
        </h1>
        <p class="devices-view__lead">
          {{ VOICE.devices.lead }}
        </p>
      </div>
      <AppButton
        variant="primary"
        size="lg"
        @click="openCreate"
      >
        {{ VOICE.devices.register }}
      </AppButton>
    </header>

    <!-- Resultado de registrar o reemitir: el código (una vez) o adónde fue el correo -->
    <DeviceCodeNotice
      v-if="notice"
      :device-name="notice.deviceName"
      :identifier="notice.identifier"
      :action="notice.action"
      :delivered-to="notice.deliveredTo"
      :correo="notice.correo"
      :copy-state="copyState"
      @copy="copyNoticeCode"
      @dismiss="notice = null"
    />

    <!-- Confirmación de revocar, o aviso de un dispositivo que ya no existe -->
    <AppAlert
      v-if="flash"
      class="devices-view__flash"
      :type="flash.type"
      :dismissible="false"
    >
      {{ flash.text }}
    </AppAlert>

    <!-- Resultado de copiar el código de una fila -->
    <p
      v-if="rowCopy"
      class="devices-view__copy"
      role="status"
    >
      {{ rowCopy }}
    </p>

    <!-- Cargando: esqueleto con la forma del resultado -->
    <div
      v-if="status === 'loading'"
      class="devices-view__loading"
      role="status"
    >
      <p>{{ VOICE.devices.loading }}</p>
      <AppSkeleton
        height="4.5rem"
        rounded
      />
      <AppSkeleton
        height="4.5rem"
        rounded
      />
    </div>

    <!-- Error: qué pasó y qué hacer, sin el texto crudo del servidor -->
    <div
      v-else-if="status === 'error'"
      class="devices-view__error"
    >
      <AppAlert type="error">
        {{ loadError }}
      </AppAlert>
      <AppButton
        variant="secondary"
        size="lg"
        @click="load()"
      >
        {{ VOICE.devices.retry }}
      </AppButton>
    </div>

    <DeviceList
      v-else
      :devices="devices"
      :current-device-id="session.deviceId"
      :busy="saving"
      @copy-code="copyRowCode"
      @revoke="openConfirm('revoke', $event)"
      @reissue="openConfirm('reissue', $event)"
    />

    <!-- Registrar un dispositivo -->
    <AppModal
      :model-value="showCreate"
      :title="VOICE.devices.register"
      size="md"
      hide-footer
      :close-on-backdrop="!saving"
      @update:model-value="onCreateModalChange"
    >
      <DeviceCreateForm
        :loading="saving"
        :server-errors="serverErrors"
        :error="formError"
        @submit="createDevice"
        @cancel="onCreateModalChange(false)"
      />
    </AppModal>

    <!-- Confirmar revocar / reemitir -->
    <AppModal
      :model-value="!!pending"
      :title="pending?.action === 'revoke' ? 'Revocar dispositivo' : 'Reemitir código'"
      size="md"
      hide-footer
      :close-on-backdrop="!saving"
      @update:model-value="onConfirmModalChange"
    >
      <DeviceActionConfirm
        v-if="pending"
        :action="pending.action"
        :device-name="pending.device.name"
        :is-current-device="pending.device.id === session.deviceId"
        :loading="saving"
        :server-errors="serverErrors"
        :error="formError"
        @confirm="confirmAction"
        @cancel="onConfirmModalChange(false)"
      />
    </AppModal>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  AppAlert, AppButton, AppModal, AppSkeleton, DeviceActionConfirm, DeviceCodeNotice, DeviceCreateForm, DeviceList,
} from '@/components'
import { VOICE, deviceAdminError, type DeviceAdminField } from '@/config/voice'
import { useClipboard } from '@/composables/useClipboard'
import DevicesAdminService from '@/services/devices-admin.service'
import { useSessionStore } from '@/stores/session.store'
import type {
  CreateDevicePayload, DeviceEmailDelivery, DeviceWithCode, ManagedDevice, ReissueDevicePayload,
} from '@/types/device.types'

const router = useRouter()
const session = useSessionStore()
const { copy } = useClipboard()

// ── Permisos vivos ────────────────────────────────────────────────────────
// El guard del router ya impide entrar; aquí se vigila lo que cambia con la
// vista abierta (otra persona elige su nombre en el mismo dispositivo).
watch(
  () => session.member?.role,
  (role) => {
    if (role !== 'socio') router.replace({ name: 'AppHome' })
  },
)

// ── Lista ─────────────────────────────────────────────────────────────────
const devices = ref<ManagedDevice[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')
const loadError = ref('')
// Cada consulta lleva un número: si otra empieza mientras una sigue en camino, la
// respuesta vieja se descarta y nunca pisa a la nueva.
let loadToken = 0

async function load() {
  const token = ++loadToken
  // Recargar tras una acción no vuelve a poner el esqueleto: la lista sigue a la vista.
  if (!devices.value.length) status.value = 'loading'
  try {
    const result = await DevicesAdminService.list()
    if (token !== loadToken) return
    devices.value = result
    status.value = 'ready'
  } catch (cause) {
    if (token !== loadToken) return
    loadError.value = loadFailureMessage(cause)
    status.value = 'error'
  }
}

// Para la lista: sin red, sin permiso (no es socio) o "no pudimos cargar".
function loadFailureMessage(cause: unknown): string {
  const failure = cause as { response?: { status?: number } } | null
  if (!failure?.response) return VOICE.networkError
  return failure.response.status === 403 ? VOICE.devices.forbidden : VOICE.devices.loadError
}

load()

// ── Avisos (nada de esto se guarda en el navegador) ───────────────────────
interface CodeNotice {
  deviceName: string
  /** El código, solo si el servidor lo devolvió (sin correo) */
  identifier: string | null
  action: 'created' | 'reissued'
  deliveredTo: DeviceEmailDelivery | null
  correo: string
}
const notice = ref<CodeNotice | null>(null)
const flash = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const copyState = ref<'idle' | 'copied' | 'failed'>('idle')
const rowCopy = ref('')

function clearFeedback() {
  notice.value = null
  flash.value = null
  copyState.value = 'idle'
  rowCopy.value = ''
}

function showCodeNotice(action: CodeNotice['action'], result: DeviceWithCode, correo: string | undefined) {
  notice.value = {
    deviceName: result.name,
    identifier: result.identifier ?? null,
    action,
    deliveredTo: result.deliveredTo ?? null,
    correo: correo ?? '',
  }
  copyState.value = 'idle'
}

async function copyNoticeCode() {
  if (!notice.value?.identifier) return
  copyState.value = (await copy(notice.value.identifier)) ? 'copied' : 'failed'
}

async function copyRowCode(device: ManagedDevice) {
  rowCopy.value = ''
  if (!device.identifier) return
  rowCopy.value = (await copy(device.identifier))
    ? `Código copiado: ${device.name}.`
    : `No pudimos copiarlo: ${device.name}. Actualiza la lista o reemite el dispositivo.`
}

// ── Registrar ─────────────────────────────────────────────────────────────
const showCreate = ref(false)
const saving = ref(false)
const formError = ref<string | null>(null)
const serverErrors = ref<Partial<Record<DeviceAdminField, string>>>({})

function openCreate() {
  // El formulario se destruye al cerrar el cuadro: cada registro empieza vacío.
  clearFeedback()
  formError.value = null
  serverErrors.value = {}
  showCreate.value = true
}

// Mientras se envía no se puede cerrar el cuadro (Escape, fondo, "Cancelar"): el
// resultado llega de todos modos y conviene verlo.
function onCreateModalChange(open: boolean) {
  if (!open && saving.value) return
  showCreate.value = open
}

async function createDevice(payload: CreateDevicePayload) {
  if (saving.value) return
  saving.value = true
  formError.value = null
  serverErrors.value = {}
  try {
    const created = await DevicesAdminService.create(payload)
    showCreate.value = false
    showCodeNotice('created', created, payload.correoEnvio)
    await load()
  } catch (cause) {
    const failure = deviceAdminError(cause)
    serverErrors.value = failure.fields
    formError.value = failure.message
  } finally {
    saving.value = false
  }
}

// ── Revocar / reemitir ────────────────────────────────────────────────────
const pending = ref<{ action: 'revoke' | 'reissue'; device: ManagedDevice } | null>(null)

function openConfirm(action: 'revoke' | 'reissue', device: ManagedDevice) {
  clearFeedback()
  formError.value = null
  serverErrors.value = {}
  pending.value = { action, device }
}

function onConfirmModalChange(open: boolean) {
  if (!open && saving.value) return
  if (!open) pending.value = null
}

async function confirmAction(payload: ReissueDevicePayload) {
  const current = pending.value
  if (!current || saving.value) return
  saving.value = true
  formError.value = null
  serverErrors.value = {}
  const { action, device } = current
  try {
    if (action === 'revoke') {
      await DevicesAdminService.revoke(device.id)
      flash.value = {
        type: 'success',
        text: device.id === session.deviceId
          ? `Revocamos «${device.name}». Es el dispositivo que estás usando, así que dejará de funcionar en cuanto intentes hacer algo.`
          : `Revocamos «${device.name}». Ya no puede usar la app.`,
      }
    } else {
      const result = await DevicesAdminService.reissue(device.id, payload)
      showCodeNotice('reissued', result, payload.correoEnvio)
    }
    pending.value = null
    await load()
  } catch (cause) {
    const failure = deviceAdminError(cause)
    if ((cause as { response?: { status?: number } } | null)?.response?.status === 404) {
      // Ya no existe (otro socio lo borró o no es de este negocio): se cierra y se actualiza la lista.
      pending.value = null
      flash.value = { type: 'error', text: VOICE.devices.notFound }
      await load()
    } else {
      serverErrors.value = failure.fields
      formError.value = failure.message
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.devices-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 48rem;
}

.devices-view__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-md);
}
.devices-view__title { font-size: var(--font-size-xl); margin: 0; }
.devices-view__lead { color: var(--color-text-muted); margin: var(--spacing-xs) 0 0; }

.devices-view__copy { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }

.devices-view__loading,
.devices-view__error {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  align-items: flex-start;
}
.devices-view__loading { align-items: stretch; }

/* "Volver": objetivo táctil de 44 px */
.devices-view__back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: none;
}
.devices-view__back:hover { text-decoration: underline; }
.devices-view__back:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}
</style>
