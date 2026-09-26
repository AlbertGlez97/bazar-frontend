<template>
  <!-- Molécula: formulario de "Cambiar mi contraseña". No hace fetch (regla del
       barrel @/components): valida en el cliente y emite `submit`; la vista
       llama a POST /auth/change-password y devuelve aquí lo que salió mal
       (contraseña actual incorrecta, contraseña nueva rechazada, error general).
       Las contraseñas viven solo en este estado local: nunca se guardan ni se
       escriben en consola, y la vista remonta el formulario tras el éxito. -->
  <form
    class="change-password-form"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <AppInput
      v-model="form.currentPassword"
      label="Contraseña actual"
      name="currentPassword"
      :type="inputType"
      size="lg"
      autocomplete="current-password"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      :disabled="loading"
      :error="errors.currentPassword || currentPasswordError || undefined"
    />

    <AppInput
      v-model="form.newPassword"
      label="Contraseña nueva"
      name="newPassword"
      :type="inputType"
      size="lg"
      autocomplete="new-password"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      :disabled="loading"
      :error="errors.newPassword || newPasswordError || undefined"
    />

    <AppInput
      v-model="form.confirmPassword"
      label="Confirma la contraseña nueva"
      name="confirmPassword"
      :type="inputType"
      size="lg"
      autocomplete="new-password"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      :disabled="loading"
      :error="errors.confirmPassword || undefined"
    />

    <!-- Interruptor real (aria-pressed): muestra o esconde los tres campos a la vez -->
    <button
      type="button"
      class="change-password-form__toggle"
      :aria-pressed="showPasswords"
      @click="showPasswords = !showPasswords"
    >
      {{ showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas' }}
    </button>

    <!-- Error general (red, servidor): el formulario sigue editable para reintentar -->
    <AppAlert
      v-if="error"
      type="error"
      :dismissible="false"
    >
      {{ error }}
    </AppAlert>

    <AppButton
      type="submit"
      variant="primary"
      size="lg"
      block
      :loading="loading"
      :disabled="loading"
    >
      Guardar contraseña nueva
    </AppButton>
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import AppInput from '@/components/ui/atoms/AppInput.vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import AppAlert from '@/components/ui/molecules/AppAlert.vue'
import { VOICE } from '@/config/voice'
import type { ChangePasswordPayload } from '@/types/auth.types'

const props = withDefaults(defineProps<{
  /** Controlado por la vista mientras espera la respuesta */
  loading?: boolean
  /** 403 del servidor: la contraseña actual no coincide */
  currentPasswordError?: string | null
  /** 400 del servidor: la contraseña nueva no se aceptó */
  newPasswordError?: string | null
  /** Error general (sin red, fallas del servidor) */
  error?: string | null
}>(), {
  loading: false,
  currentPasswordError: null,
  newPasswordError: null,
  error: null,
})

const emit = defineEmits<{
  /** Solo cuando la validación de cliente pasa; la confirmación no viaja */
  submit: [payload: ChangePasswordPayload]
}>()

// Reglas del contrato: 10 a 128 caracteres y distinta de la actual. Las
// contraseñas no se recortan (los espacios cuentan).
const MIN_LENGTH = 10
const MAX_LENGTH = 128

const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const errors = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const showPasswords = ref(false)
const inputType = computed(() => (showPasswords.value ? 'text' : 'password'))

function validate(): boolean {
  errors.currentPassword = form.currentPassword ? '' : 'Escribe tu contraseña actual.'

  if (!form.newPassword) errors.newPassword = 'Escribe la contraseña nueva.'
  else if (form.newPassword.length < MIN_LENGTH || form.newPassword.length > MAX_LENGTH) errors.newPassword = VOICE.changePassword.badLength
  else if (form.newPassword === form.currentPassword) errors.newPassword = VOICE.changePassword.sameAsCurrent
  else errors.newPassword = ''

  if (!form.confirmPassword) errors.confirmPassword = 'Confirma la contraseña nueva.'
  else if (form.confirmPassword !== form.newPassword) errors.confirmPassword = 'Las contraseñas no coinciden.'
  else errors.confirmPassword = ''

  return !errors.currentPassword && !errors.newPassword && !errors.confirmPassword
}

function handleSubmit() {
  if (props.loading) return
  if (!validate()) return
  emit('submit', { currentPassword: form.currentPassword, newPassword: form.newPassword })
}
</script>

<style scoped>
.change-password-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* Interruptor de mostrar/ocultar: objetivo táctil de 44 px (guía de marca) */
.change-password-form__toggle {
  align-self: flex-start;
  min-width: 44px;
  min-height: 44px;
  padding: 0 var(--spacing-sm);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--color-primary);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
}
.change-password-form__toggle:hover { text-decoration: underline; }
.change-password-form__toggle:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}
</style>
