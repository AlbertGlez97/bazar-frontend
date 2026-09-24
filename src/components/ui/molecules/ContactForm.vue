<template>
  <!-- Molécula: formulario de contacto genérico de la landing -->
  <div class="contact-form">
    <!-- Confirmación simulada tras envío válido -->
    <AppAlert
      type="success"
      :show="submitted"
    >
      ¡Gracias, {{ form.name }}! Recibimos tu mensaje y te contactaremos pronto.
    </AppAlert>

    <form
      v-if="!submitted"
      class="contact-form__form"
      novalidate
      @submit.prevent="handleSubmit"
    >
      <AppInput
        v-model="form.name"
        label="Nombre"
        placeholder="Tu nombre"
        autocomplete="name"
        :error="errors.name"
        @blur="validateName"
      />

      <AppInput
        v-model="form.email"
        label="Correo electrónico"
        type="email"
        placeholder="tu@email.com"
        autocomplete="email"
        :error="errors.email"
        @blur="validateEmail"
      />

      <AppTextarea
        v-model="form.message"
        label="Mensaje"
        placeholder="Cuéntanos qué necesitas..."
        :rows="5"
        :error="errors.message"
        @blur="validateMessage"
      />

      <AppButton
        type="submit"
        variant="primary"
        size="lg"
        block
      >
        Enviar mensaje
      </AppButton>
    </form>
  </div>
</template>

<script setup lang="ts">
// Molécula: agrupa átomos (AppInput, AppTextarea, AppButton) + validación de
// cliente + envío. No hace ninguna llamada HTTP: ver TODO más abajo.
import { reactive, ref } from 'vue'
import AppInput from '@/components/ui/atoms/AppInput.vue'
import AppTextarea from '@/components/ui/atoms/AppTextarea.vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import AppAlert from '@/components/ui/molecules/AppAlert.vue'

/**
 * Payload que se emite al enviar el formulario con datos válidos.
 */
export interface ContactFormPayload {
  name: string
  email: string
  message: string
}

const emit = defineEmits<{
  /** Se emite únicamente cuando la validación de cliente pasa */
  submit: [payload: ContactFormPayload]
}>()

const form = reactive({ name: '', email: '', message: '' })
const errors = reactive({ name: '', email: '', message: '' })
const submitted = ref(false)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateName() {
  errors.name = form.name.trim() ? '' : 'El nombre es requerido'
}

function validateEmail() {
  if (!form.email.trim()) {
    errors.email = 'El correo es requerido'
  } else if (!EMAIL_RE.test(form.email)) {
    errors.email = 'Formato de correo inválido'
  } else {
    errors.email = ''
  }
}

function validateMessage() {
  errors.message = form.message.trim() ? '' : 'El mensaje es requerido'
}

function isValid() {
  validateName()
  validateEmail()
  validateMessage()
  return !errors.name && !errors.email && !errors.message
}

function handleSubmit() {
  if (!isValid()) return

  emit('submit', { name: form.name, email: form.email, message: form.message })

  // TODO(backend-contacto): Hoy no existe un endpoint de "contacto general"
  // en la API — solo POST /business-registration (registro de negocio, un
  // flujo distinto). Por eso este envío es 100% simulado en cliente: no hay
  // llamada HTTP. Falta decidir con negocio si estos mensajes deben llegar
  // por correo (ej. vía Resend) o crear un endpoint dedicado, y entonces
  // reemplazar este bloque por la llamada real al servicio correspondiente.
  submitted.value = true
}
</script>

<style scoped>
.contact-form { display: flex; flex-direction: column; gap: var(--spacing-md); }
.contact-form__form { display: flex; flex-direction: column; gap: var(--spacing-md); }
</style>
