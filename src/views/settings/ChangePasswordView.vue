<template>
  <!-- Vista: cambiar mi contraseña (cualquier persona con sesión). Contenedor:
       llama a POST /auth/change-password y decide dónde mostrar cada resultado.
       Un 403 (contraseña actual incorrecta) nunca cierra la sesión: el backend lo
       responde a propósito como 403 y no como 401. -->
  <section
    class="change-password-view"
    aria-labelledby="change-password-title"
  >
    <RouterLink
      to="/app/ajustes"
      class="change-password-view__back"
    >
      ← Volver a ajustes
    </RouterLink>

    <header>
      <h1
        id="change-password-title"
        class="change-password-view__title"
      >
        Cambiar mi contraseña
      </h1>
      <p class="change-password-view__lead">
        Escribe la que usas ahora y elige una nueva de 10 a 128 caracteres.
      </p>
    </header>

    <AppAlert
      v-if="succeeded"
      type="success"
      :dismissible="false"
    >
      {{ VOICE.changePassword.success }}
    </AppAlert>

    <!-- Se remonta tras el éxito: así los tres campos quedan vacíos -->
    <ChangePasswordForm
      :key="formKey"
      :loading="loading"
      :current-password-error="currentPasswordError"
      :new-password-error="newPasswordError"
      :error="error"
      @submit="submit"
    />
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { AppAlert, ChangePasswordForm } from '@/components'
import { VOICE, changePasswordError } from '@/config/voice'
import AuthService from '@/services/auth.service'
import type { ChangePasswordPayload } from '@/types/auth.types'

const loading = ref(false)
const succeeded = ref(false)
const currentPasswordError = ref<string | null>(null)
const newPasswordError = ref<string | null>(null)
const error = ref<string | null>(null)
const formKey = ref(0)

async function submit(payload: ChangePasswordPayload) {
  if (loading.value) return
  loading.value = true
  succeeded.value = false
  currentPasswordError.value = null
  newPasswordError.value = null
  error.value = null
  try {
    await AuthService.changePassword(payload)
    succeeded.value = true
    formKey.value += 1
  } catch (cause) {
    const failure = changePasswordError(cause)
    if (failure.field === 'currentPassword') currentPasswordError.value = failure.message
    else if (failure.field === 'newPassword') newPasswordError.value = failure.message
    else error.value = failure.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.change-password-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 32rem;
}
.change-password-view__title { font-size: var(--font-size-xl); margin: 0; }
.change-password-view__lead { color: var(--color-text-muted); margin: var(--spacing-xs) 0 0; }

/* "Volver": objetivo táctil de 44 px */
.change-password-view__back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: none;
}
.change-password-view__back:hover { text-decoration: underline; }
.change-password-view__back:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}
</style>
