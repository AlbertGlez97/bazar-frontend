<template>
  <!-- Molécula: resultado de registrar o reemitir un dispositivo. Dos formas:
       (1) SIN correo, el servidor devuelve el código de un solo uso y aquí se
       muestra UNA vez, seleccionable, con botón de copiar; (2) CON correo, el
       código NO vuelve en la respuesta: el aviso dice adónde fue, y si el
       proveedor estaba en modo de prueba (`approver-fallback`) lo dice con
       honestidad: no llegó a la persona. -->
  <div class="device-code-notice">
    <AppAlert
      :type="fellBack ? 'warning' : 'success'"
      :dismissible="false"
    >
      <template v-if="identifier">
        {{ action === 'created' ? `Listo, registramos «${deviceName}».` : `Listo, generamos un código nuevo para «${deviceName}».` }}
        {{ reissuedNote }}
        Este es su código de un solo uso.
      </template>
      <template v-else-if="fellBack">
        El correo con el código de «{{ deviceName }}» no llegó a {{ correo }}: el servicio de correo está en modo de prueba y mandó el código a la persona que aprueba los registros del negocio. Pídeselo a esa persona.
        {{ reissuedNote }}
      </template>
      <template v-else-if="deliveredTo === 'recipient'">
        Enviamos el código de «{{ deviceName }}» a {{ correo }}. Funciona una sola vez.
        {{ reissuedNote }}
      </template>
      <template v-else>
        Listo, «{{ deviceName }}» quedó actualizado.
      </template>
    </AppAlert>

    <template v-if="identifier">
      <!-- El código es texto seleccionable y enfocable: si copiar falla, se copia a mano -->
      <code
        class="device-code-notice__code"
        tabindex="0"
      >{{ identifier }}</code>
      <p class="device-code-notice__steps">
        En el dispositivo, escribe este código y el nombre exactamente así: «{{ deviceName }}». Funciona una sola vez.
      </p>
      <AppButton
        type="button"
        variant="primary"
        size="lg"
        class="device-code-notice__copy"
        @click="emit('copy')"
      >
        Copiar código
      </AppButton>
      <p
        v-if="copyState !== 'idle'"
        class="device-code-notice__copy-state"
        role="status"
      >
        {{ copyState === 'copied' ? 'Código copiado.' : 'No pudimos copiarlo: selecciónalo y cópialo a mano.' }}
      </p>
    </template>

    <AppButton
      type="button"
      variant="secondary"
      size="lg"
      @click="emit('dismiss')"
    >
      Entendido
    </AppButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppAlert from '@/components/ui/molecules/AppAlert.vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import type { DeviceEmailDelivery } from '@/types/device.types'

const props = withDefaults(defineProps<{
  deviceName: string
  /** El código, cuando el servidor lo devolvió (registro o reemisión SIN correo) */
  identifier?: string | null
  action: 'created' | 'reissued'
  /** Adónde fue el correo, cuando se pidió mandarlo por correo */
  deliveredTo?: DeviceEmailDelivery | null
  /** El correo que se escribió (el servidor no lo devuelve) */
  correo?: string
  copyState?: 'idle' | 'copied' | 'failed'
}>(), {
  identifier: null,
  deliveredTo: null,
  correo: '',
  copyState: 'idle',
})

const emit = defineEmits<{ copy: []; dismiss: [] }>()

const fellBack = computed(() => !props.identifier && props.deliveredTo === 'approver-fallback')
// Reemitir apaga el acceso anterior al instante: se dice siempre.
const reissuedNote = computed(() => (props.action === 'reissued' ? 'El acceso anterior dejó de funcionar.' : ''))
</script>

<style scoped>
.device-code-notice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-sm);
}

.device-code-notice__code {
  display: block;
  max-width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: var(--font-size-md);
  overflow-wrap: anywhere;
  user-select: all;
}
.device-code-notice__code:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.device-code-notice__steps,
.device-code-notice__copy-state { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }

/* Copiar: objetivo táctil de al menos 44x44 (guía de marca) */
.device-code-notice__copy {
  min-width: 44px;
  min-height: 44px;
}
</style>
