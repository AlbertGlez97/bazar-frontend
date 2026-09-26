<template>
  <!-- Molécula: confirmación visual de que se agregó a una persona y ADÓNDE fue el
       correo con su acceso. Si el proveedor de correo estaba en modo de prueba, las
       credenciales fueron a quien aprueba los registros y NO a la persona: se dice
       con honestidad, con aviso de advertencia. Nunca muestra una contraseña (el
       servidor no la devuelve). -->
  <div class="member-created-notice">
    <AppAlert
      :type="delivered ? 'success' : 'warning'"
      :dismissible="false"
    >
      <template v-if="delivered">
        Listo, agregamos a {{ created.name }} ({{ roleLabel }}). Enviamos un correo a {{ correo }} con su usuario y su contraseña temporal.
      </template>
      <template v-else>
        Agregamos a {{ created.name }} ({{ roleLabel }}), pero el correo no llegó a {{ correo }}: el servicio de correo está en modo de prueba y mandó el acceso a la persona que aprueba los registros del negocio. Pídele a esa persona la contraseña temporal para dársela a {{ created.name }}.
      </template>
      Su usuario es <strong>{{ created.username }}</strong>.
      <template v-if="created.role === 'colaborador'">
        {{ commissionText }}
      </template>
    </AppAlert>
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
import { bpsToPercentText } from '@/utils/commission'
import type { CreatedMember } from '@/types/member.types'

const props = defineProps<{
  created: CreatedMember
  /** El correo que se escribió al agregar a la persona (el servidor no lo guarda ni lo devuelve) */
  correo: string
}>()

const emit = defineEmits<{ dismiss: [] }>()

const delivered = computed(() => props.created.credentialsEmail === 'member')
const roleLabel = computed(() => (props.created.role === 'socio' ? 'Socio' : 'Colaborador'))
const commissionText = computed(() =>
  props.created.commissionRateBps === null
    ? 'Usa la comisión general del negocio.'
    : `Comisión: ${bpsToPercentText(props.created.commissionRateBps)} %.`,
)
</script>

<style scoped>
.member-created-notice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-sm);
}
</style>
