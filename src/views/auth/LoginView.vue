<template>
  <div class="login">

    <!-- Título -->
    <div class="login__header">
      <h2 class="login__title">Bienvenido de vuelta</h2>
      <p class="login__subtitle">Ingresa tus credenciales para continuar</p>
    </div>

    <!-- Alerta de error global (molécula AppAlert) -->
    <AppAlert type="error" :show="!!authStore.error">
      {{ authStore.error }}
    </AppAlert>

    <!-- Formulario -->
    <form class="login__form" @submit.prevent="handleSubmit" novalidate>

      <!-- Email (átomo AppInput) -->
      <AppInput
        v-model="form.email"
        label="Correo electrónico"
        type="email"
        placeholder="tu@email.com"
        autocomplete="email"
        :disabled="authStore.loading"
        :error="errors.email"
        size="lg"
        @blur="validateEmail"
      >
        <template #icon-left>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="1.5"/>
            <path d="M22 6l-10 7L2 6" stroke="currentColor" stroke-width="1.5"/>
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </template>
        <template #icon-right>
          <!-- Toggle visibilidad contraseña -->
          <button
            type="button"
            class="login__eye-btn"
            @click="showPassword = !showPassword"
            :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          >
            <svg v-if="!showPassword" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
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

      <!-- Link de recuperación con Recovery Phrase -->
      <RouterLink to="/recuperar" class="login__forgot">
        ¿Olvidaste tu contraseña?
      </RouterLink>

    </form>

    <!-- Divisor -->
    <div class="login__divider">
      <span>¿Aún no tienes cuenta?</span>
    </div>

    <!-- Link a Registro (AppButton como RouterLink) -->
    <AppButton
      tag="RouterLink"
      to="/register"
      variant="secondary"
      size="lg"
      block
    >
      Crear cuenta gratis
    </AppButton>

    <!-- Footer de seguridad -->
    <p class="login__security">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
      Sesión protegida con JWT · Contraseña cifrada con BCrypt
    </p>

  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { AppButton, AppInput, AppAlert } from '@/components'

const authStore = useAuthStore()
// useToastStore nos permite disparar notificaciones no bloqueantes desde la vista (R31)
const toast     = useToastStore()
const router    = useRouter()

// ── Estado del formulario ──────────────────────────────────────────────────
const form = ref({
  email:    '',
  password: '',
})
const errors       = ref({ email: '', password: '' })
const showPassword = ref(false)

// ── Validaciones en tiempo real ────────────────────────────────────────────
function validateEmail() {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!form.value.email) {
    errors.value.email = 'El correo es requerido'
  } else if (!re.test(form.value.email)) {
    errors.value.email = 'Formato de correo inválido'
  } else {
    errors.value.email = ''
  }
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
  () => form.value.email.length > 0 && form.value.password.length > 0
)

// ── Envío ──────────────────────────────────────────────────────────────────
async function handleSubmit() {
  // Valida antes de enviar
  validateEmail()
  validatePassword()
  if (errors.value.email || errors.value.password) return

  try {
    await authStore.login({
      email:    form.value.email,
      password: form.value.password,
    })
    // Si el crypto subsystem falló (pero el backend respondió OK), avisamos sin bloquear la sesión (R31)
    if (authStore.cryptoWarning) {
      toast.info(authStore.cryptoWarning)
    }
    // Login exitoso → redirige al dashboard (siempre, incluso con cryptoWarning)
    router.push({ name: 'Dashboard' })
  } catch {
    // El error ya se almacena en authStore.error
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

/* ── Link de recuperación ────────────────────────────────────── */
.login__forgot {
  text-align: center;
  font-size: 0.85rem;
  color: var(--color-primary);
  text-decoration: none;
  padding: 4px 0;
}
.login__forgot:hover { text-decoration: underline; }

/* ── Divisor ────────────────────────────────────────────────── */
.login__divider {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--color-text-muted);
}
.login__divider::before,
.login__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

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
