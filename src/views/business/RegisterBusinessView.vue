<template>
  <section
    class="register-business"
    aria-label="Registro de negocio"
  >
    <div class="register-business__inner container">
      <template v-if="!submitted">
        <h1 class="register-business__title">
          Registra tu negocio
        </h1>
        <p class="register-business__subtitle">
          Cuéntanos de tu bazar y te contactamos para activar tu cuenta.
        </p>

        <BusinessRegistrationForm
          :loading="loading"
          @submit="handleSubmit"
        />
      </template>

      <!-- Confirmación tras envío exitoso — NO hay login ni sesión aquí:
           la aprobación es manual y posterior por parte de Alberto. -->
      <AppAlert
        v-else
        type="success"
        title="Solicitud enviada"
      >
        Tu solicitud fue enviada. Si es aprobada, recibirás tus credenciales de acceso.
      </AppAlert>
    </div>
  </section>
</template>

<script setup lang="ts">
// Vista: única responsable de la llamada real al backend (las moléculas de
// ui/ no acceden a stores ni hacen fetch, ver reglas del barrel @/components).
import { ref } from 'vue'
import { BusinessRegistrationForm, AppAlert } from '@/components'
import BusinessRegistrationService from '@/services/business-registration.service'
import { useToastStore } from '@/stores/toast.store'
import type { BusinessRegistrationPayload } from '@/types/business-registration.types'

const loading = ref(false)
const submitted = ref(false)
const toast = useToastStore()

async function handleSubmit(payload: BusinessRegistrationPayload) {
  loading.value = true
  try {
    await BusinessRegistrationService.register(payload)
    submitted.value = true
  } catch (cause) {
    const serverMessage = (cause as { response?: { data?: { message?: unknown } } } | null)
      ?.response?.data?.message
    toast.error(
      typeof serverMessage === 'string'
        ? serverMessage
        : 'No se pudo enviar tu solicitud, intenta de nuevo'
    )
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-business { padding: var(--spacing-2xl) var(--spacing-md); }
.register-business__inner { max-width: 32rem; margin: 0 auto; }
.register-business__title {
  font-size:   var(--font-size-xl);
  font-weight: 800;
  color:       var(--color-text);
  text-align:  center;
}
.register-business__subtitle {
  margin-top: var(--spacing-sm);
  color:      var(--color-text-muted);
  text-align: center;
}
</style>
