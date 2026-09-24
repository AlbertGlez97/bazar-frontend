<template>
  <!-- Molécula: formulario de registro de negocio. A diferencia de ContactForm
       (simulado), este SÍ dispara una llamada real — pero esa llamada vive en
       la vista (RegisterBusinessView), no aquí: las moléculas de ui/ no deben
       acceder a stores ni hacer fetch (ver reglas del barrel @/components). -->
  <form
    class="business-registration-form"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <AppInput
      v-model="form.nombreNegocio"
      label="Nombre del negocio"
      placeholder="Ej. Bazar Los Pinos"
      :disabled="loading"
      :error="errors.nombreNegocio"
      @blur="validateNombreNegocio"
    />

    <AppInput
      v-model="form.nombreSocio"
      label="Nombre del socio fundador"
      placeholder="Tu nombre completo"
      :disabled="loading"
      :error="errors.nombreSocio"
      @blur="validateNombreSocio"
    />

    <!-- Un solo campo de contacto (el backend solo tiene `contactoSocio`):
         acepta correo o teléfono, ver validateContactoSocio. -->
    <AppInput
      v-model="form.contactoSocio"
      label="Contacto del socio (correo o teléfono)"
      placeholder="tu@email.com o 55 1234 5678"
      :disabled="loading"
      :error="errors.contactoSocio"
      @blur="validateContactoSocio"
    />

    <AppButton
      type="submit"
      variant="primary"
      size="lg"
      block
      :loading="loading"
      :disabled="loading"
    >
      Enviar solicitud
    </AppButton>
  </form>
</template>

<script setup lang="ts">
// Molécula: agrupa átomos (AppInput, AppButton) + validación de cliente.
// No hace ninguna llamada HTTP — solo emite `submit` con un payload validado.
import { reactive } from 'vue'
import AppInput from '@/components/ui/atoms/AppInput.vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import type { BusinessRegistrationPayload } from '@/types/business-registration.types'

withDefaults(defineProps<{
  /** Controlado por el padre mientras espera la respuesta real del backend */
  loading?: boolean
}>(), {
  loading: false,
})

const emit = defineEmits<{
  /** Se emite únicamente cuando la validación de cliente pasa */
  submit: [payload: BusinessRegistrationPayload]
}>()

const form = reactive({ nombreNegocio: '', nombreSocio: '', contactoSocio: '' })
const errors = reactive({ nombreNegocio: '', nombreSocio: '', contactoSocio: '' })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Teléfono flexible: al menos 7 dígitos, permite espacios/paréntesis/guiones/+
const PHONE_RE = /^[+]?[\d\s()-]{7,}$/

function validateNombreNegocio() {
  errors.nombreNegocio = form.nombreNegocio.trim() ? '' : 'El nombre del negocio es requerido'
}

function validateNombreSocio() {
  errors.nombreSocio = form.nombreSocio.trim() ? '' : 'El nombre del socio es requerido'
}

function validateContactoSocio() {
  const value = form.contactoSocio.trim()
  if (!value) {
    errors.contactoSocio = 'El contacto del socio es requerido'
  } else if (!EMAIL_RE.test(value) && !PHONE_RE.test(value)) {
    errors.contactoSocio = 'Ingresa un correo o teléfono válido'
  } else {
    errors.contactoSocio = ''
  }
}

function isValid() {
  validateNombreNegocio()
  validateNombreSocio()
  validateContactoSocio()
  return !errors.nombreNegocio && !errors.nombreSocio && !errors.contactoSocio
}

function handleSubmit() {
  if (!isValid()) return

  emit('submit', {
    nombreNegocio: form.nombreNegocio.trim(),
    nombreSocio: form.nombreSocio.trim(),
    contactoSocio: form.contactoSocio.trim(),
  })
}
</script>

<style scoped>
.business-registration-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
</style>
