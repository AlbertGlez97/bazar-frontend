<template>
  <!-- Molécula: lista de dispositivos del negocio con su estado y sus acciones.
       Solo renderiza y emite: el estado se lee en texto (no solo por color), un
       dispositivo heredado (sin token) se dice con honestidad, y el CÓDIGO nunca se
       pinta aquí: solo se puede copiar. Cada botón lleva el nombre del dispositivo
       en su nombre accesible. -->
  <div class="device-list">
    <p
      v-if="!devices.length"
      class="device-list__empty"
    >
      Todavía no hay dispositivos registrados.
    </p>

    <ul
      v-else
      class="device-list__list"
      aria-label="Dispositivos del negocio"
    >
      <li
        v-for="device in devices"
        :key="device.id"
        class="device-list__item"
        :class="{ 'device-list__item--revoked': device.status === 'revocado' }"
      >
        <div class="device-list__info">
          <div class="device-list__heading">
            <span class="device-list__name">{{ device.name }}</span>
            <AppBadge
              class="device-list__status"
              :color="STATUS[device.status].color"
              :filled="device.status === 'activo'"
            >
              {{ STATUS[device.status].label }}
            </AppBadge>
            <span
              v-if="device.id === currentDeviceId"
              class="device-list__current"
            >Este dispositivo</span>
          </div>
          <p
            v-if="device.legacy"
            class="device-list__legacy"
          >
            Sin token: funciona con el acceso de antes. Para activar el acceso nuevo hay que reemitirlo.
          </p>
        </div>

        <div class="device-list__actions">
          <AppButton
            v-if="device.status === 'pendiente_activacion' && device.identifier"
            type="button"
            variant="secondary"
            size="lg"
            class="device-list__action"
            :aria-label="`Copiar código de ${device.name}`"
            :disabled="busy"
            @click="emit('copy-code', device)"
          >
            Copiar código
          </AppButton>
          <AppButton
            type="button"
            variant="secondary"
            size="lg"
            class="device-list__action"
            :aria-label="`Reemitir ${device.name}`"
            :disabled="busy"
            @click="emit('reissue', device)"
          >
            Reemitir
          </AppButton>
          <AppButton
            v-if="device.status !== 'revocado'"
            type="button"
            variant="soft-danger"
            size="lg"
            class="device-list__action"
            :aria-label="`Revocar ${device.name}`"
            :disabled="busy"
            @click="emit('revoke', device)"
          >
            Revocar
          </AppButton>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import AppBadge from '@/components/ui/atoms/AppBadge.vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import type { DeviceStatus, ManagedDevice } from '@/types/device.types'

withDefaults(defineProps<{
  devices: ManagedDevice[]
  /** Dispositivo que se está usando ahora (`session.deviceId`) */
  currentDeviceId?: string | null
  /** Deshabilita las acciones mientras la vista atiende otra */
  busy?: boolean
}>(), {
  currentDeviceId: null,
  busy: false,
})

const emit = defineEmits<{
  'copy-code': [device: ManagedDevice]
  revoke: [device: ManagedDevice]
  reissue: [device: ManagedDevice]
}>()

const STATUS: Record<DeviceStatus, { label: string; color: 'green' | 'amber' | 'red' }> = {
  activo: { label: 'Activo', color: 'green' },
  pendiente_activacion: { label: 'Pendiente de activar', color: 'amber' },
  revocado: { label: 'Revocado', color: 'red' },
}
</script>

<style scoped>
.device-list__empty { color: var(--color-text-muted); }

.device-list__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  list-style: none;
  margin: 0;
  padding: 0;
}

.device-list__item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.device-list__item--revoked { background: transparent; }
.device-list__item--revoked .device-list__name { color: var(--color-text-muted); }

.device-list__info { display: flex; flex-direction: column; gap: 4px; min-width: 10rem; flex: 1; }
.device-list__heading { display: flex; align-items: center; flex-wrap: wrap; gap: var(--spacing-sm); }
.device-list__name { font-weight: 600; }
.device-list__current { font-size: var(--font-size-sm); color: var(--color-text-muted); font-weight: 600; }
.device-list__legacy { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }

.device-list__actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }

/* Cada acción es un objetivo táctil de al menos 44x44 (guía de marca) */
.device-list__action {
  min-width: 44px;
  min-height: 44px;
}
</style>
