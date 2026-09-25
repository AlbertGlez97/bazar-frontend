<template>
  <div class="login">
    <!-- Título -->
    <div class="login__header">
      <h2 class="login__title">
        Bienvenido de vuelta
      </h2>
      <p class="login__subtitle">
        Ingresa tus credenciales para continuar
      </p>
    </div>

    <!-- Alerta de error global (molécula AppAlert) -->
    <AppAlert
      type="error"
      :show="!!authStore.error"
    >
      {{ authStore.error }}
    </AppAlert>

    <!-- Formulario -->
    <form
      class="login__form"
      novalidate
      @submit.prevent="handleSubmit"
    >
      <!-- Usuario (átomo AppInput) -->
      <AppInput
        v-model="form.username"
        label="Usuario"
        type="text"
        placeholder="tu.usuario"
        autocomplete="username"
        :disabled="authStore.loading"
        :error="errors.username"
        size="lg"
        @blur="validateUsername"
      >
        <template #icon-left>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="8"
              r="4"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </template>
      </AppInput>

      <!-- Contraseña (AppInput con toggle de visibilidad en icon-right) -->
      <AppInput
        v-model="form.password"
        label="Contraseña"
        :type="showPassword ? 'text' : 'password'"
        placeholder="••••••••"
        autocomplete="current-password"
        :disabled="authStore.loading"
        :error="errors.password"
        size="lg"
        @blur="validatePassword"
      >
        <template #icon-left>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <rect
              x="3"
              y="11"
              width="18"
              height="11"
              rx="2"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M7 11V7a5 5 0 0110 0v4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </template>
        <template #icon-right>
          <!-- Toggle visibilidad contraseña -->
          <button
            type="button"
            class="login__eye-btn"
            :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            @click="showPassword = !showPassword"
          >
            <svg
              v-if="!showPassword"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <circle
                cx="12"
                cy="12"
                r="3"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
            <svg
              v-else
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </template>
      </AppInput>

      <!-- Botón principal (átomo AppButton) -->
      <AppButton
        type="submit"
        variant="primary"
        size="lg"
        block
        :loading="authStore.loading"
        :disabled="!isFormValid"
      >
        Iniciar sesión
      </AppButton>
    </form>

    <!-- Footer de seguridad -->
    <p class="login__security">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
      </svg>
      Tus datos de acceso se almacenan de forma segura.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { AppButton, AppInput, AppAlert } from '@/components'

const authStore = useAuthStore()
const router    = useRouter()

// ── Estado del formulario ──────────────────────────────────────────────────
const form = ref({
  username: '',
  password: '',
})
const errors       = ref({ username: '', password: '' })
const showPassword = ref(false)

// ── Validaciones en tiempo real ────────────────────────────────────────────
function validateUsername() {
  errors.value.username = form.value.username.trim() ? '' : 'El usuario es requerido'
}

function validatePassword() {
  if (!form.value.password) {
    errors.value.password = 'La contraseña es requerida'
  } else if (form.value.password.length < 6) {
    errors.value.password = 'Mínimo 6 caracteres'
  } else {
    errors.value.password = ''
  }
}

// El botón solo se activa cuando ambos campos tienen contenido
const isFormValid = computed(
  () => form.value.username.length > 0 && form.value.password.length > 0
)

// ── Envío ──────────────────────────────────────────────────────────────────
async function handleSubmit() {
  // Valida antes de enviar
  validateUsername()
  validatePassword()
  if (errors.value.username || errors.value.password) return

  try {
    await authStore.login({
      username: form.value.username,
      password: form.value.password,
    })
    router.push({ name: 'AppHome' })
  } catch {
    // El error ya se almacena en authStore.error y se notifica vía toast
  }
}
</script>

<style scoped>
/* ── Contenedor ────────────────────────────────────────────── */
.login {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Header ────────────────────────────────────────────────── */
.login__header { text-align: center; }
.login__title {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 6px;
  letter-spacing: -.3px;
}
.login__subtitle {
  font-size: 14px;
  color: var(--color-text-muted);
}

/* ── Formulario ────────────────────────────────────────────── */
.login__form { display: flex; flex-direction: column; gap: 16px; }

/* ── Toggle de ojo en contraseña (dentro del icon-right slot) ── */
.login__eye-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 4px;
  transition: color var(--transition);
}
.login__eye-btn:hover { color: var(--color-text); }

/* ── Footer de seguridad ────────────────────────────────────── */
.login__security {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-light);
  text-align: center;
}
</style>
