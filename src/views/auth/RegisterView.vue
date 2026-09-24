<template>
  <div class="register">
    <!-- Indicador de paso del wizard -->
    <div class="register__steps">
      <div
        v-for="(label, i) in STEP_LABELS"
        :key="i"
        class="register__step"
        :class="{
          'register__step--active':   step === i + 1,
          'register__step--done':     step > i + 1,
        }"
      >
        <span class="register__step-num">{{ step > i + 1 ? '✓' : i + 1 }}</span>
        <span class="register__step-label">{{ label }}</span>
      </div>
    </div>

    <AppAlert type="error" :show="!!authStore.error">{{ authStore.error }}</AppAlert>

    <!-- ══════════════════════════════════════════════════════════
         PASO 1 — Datos del usuario
    ══════════════════════════════════════════════════════════ -->
    <div v-if="step === 1" class="register__panel">
      <div class="register__header">
        <h2 class="register__title">Crea tu cuenta</h2>
        <p class="register__subtitle">Empieza a gestionar tus finanzas hoy</p>
      </div>

      <form class="register__form" @submit.prevent="goToStep2" novalidate>
        <AppInput
          v-model="form.name"
          label="Nombre completo"
          type="text"
          placeholder="Alberto González"
          autocomplete="name"
          :error="errors.name"
          size="lg"
          @blur="validateName"
        />

        <AppInput
          v-model="form.email"
          label="Correo electrónico"
          type="email"
          placeholder="tu@email.com"
          autocomplete="email"
          :error="errors.email"
          size="lg"
          @blur="validateEmail"
        />

        <AppInput
          v-model="form.password"
          label="Contraseña"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Mínimo 8 caracteres"
          autocomplete="new-password"
          :error="errors.password"
          size="lg"
          @blur="validatePassword"
        >
          <template #icon-right>
            <button type="button" class="register__eye-btn" @click="showPassword = !showPassword">
              {{ showPassword ? '🙈' : '👁' }}
            </button>
          </template>
        </AppInput>

        <AppInput
          v-model="form.confirm"
          label="Confirmar contraseña"
          :type="showConfirm ? 'text' : 'password'"
          placeholder="Repite tu contraseña"
          autocomplete="new-password"
          :error="errors.confirm"
          size="lg"
          @blur="validateConfirm"
        >
          <template #icon-right>
            <button type="button" class="register__eye-btn" @click="showConfirm = !showConfirm">
              {{ showConfirm ? '🙈' : '👁' }}
            </button>
          </template>
        </AppInput>

        <AppButton
          type="submit"
          variant="primary"
          size="lg"
          block
          :loading="preparing"
          :disabled="!isStep1Valid || preparing"
        >
          Continuar →
        </AppButton>
      </form>

      <div class="register__divider"><span>¿Ya tienes cuenta?</span></div>
      <AppButton tag="RouterLink" to="/login" variant="secondary" size="lg" block>
        Iniciar sesión
      </AppButton>
    </div>

    <!-- ══════════════════════════════════════════════════════════
         PASO 2 — Kit de Emergencia
    ══════════════════════════════════════════════════════════ -->
    <div v-if="step === 2 && material" class="register__panel">
      <EmergencyKit
        :phrase="material.recoveryPhrase"
        :email="form.email"
      />

      <label class="register__ack">
        <input type="checkbox" v-model="acknowledgedBackup" />
        <span>
          Guardé mi frase de recuperación en un lugar seguro y entiendo que
          <strong>sin ella no puedo recuperar mi cuenta</strong> si olvido la contraseña.
        </span>
      </label>

      <div class="register__actions">
        <AppButton variant="secondary" size="md" @click="goToStep1">← Volver</AppButton>
        <AppButton
          variant="primary"
          size="md"
          :disabled="!acknowledgedBackup"
          @click="step = 3"
        >
          Continuar →
        </AppButton>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════
         PASO 3 — Confirmación de la frase
    ══════════════════════════════════════════════════════════ -->
    <div v-if="step === 3 && material" class="register__panel">
      <PhraseConfirmation
        :phrase="material.recoveryPhrase"
        @confirmed="handleConfirmed"
        @request-reshow="step = 2"
      />

      <div class="register__actions register__actions--single">
        <AppButton variant="secondary" size="md" @click="step = 2">← Volver</AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useCryptoStore, type InitSessionResult } from '@/stores/crypto.store'
import { useToastStore } from '@/stores/toast.store'
import { AppButton, AppInput, AppAlert, EmergencyKit, PhraseConfirmation } from '@/components'

const authStore   = useAuthStore()
const cryptoStore = useCryptoStore()
const toast       = useToastStore()
const router      = useRouter()

const STEP_LABELS = ['Tus datos', 'Kit de Emergencia', 'Confirmación']

// ── Estado del wizard ────────────────────────────────────────────────────
const step     = ref<1 | 2 | 3>(1)
const preparing = ref(false)                                  // generando material
const material  = ref<InitSessionResult | null>(null)        // salts + wrapped DEKs + phrase
const acknowledgedBackup = ref(false)

// ── Estado del formulario (paso 1) ───────────────────────────────────────
const form = ref({
  name:     '',
  email:    '',
  password: '',
  confirm:  '',
})
const errors       = ref({ name: '', email: '', password: '', confirm: '' })
const showPassword = ref(false)
const showConfirm  = ref(false)

// ── Validaciones paso 1 ──────────────────────────────────────────────────
function validateName() {
  errors.value.name =
    !form.value.name                     ? 'El nombre es requerido'
    : form.value.name.trim().length < 2  ? 'Mínimo 2 caracteres'
    : ''
}
function validateEmail() {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  errors.value.email =
    !form.value.email       ? 'El correo es requerido'
    : !re.test(form.value.email) ? 'Formato de correo inválido'
    : ''
}
function validatePassword() {
  errors.value.password =
    !form.value.password          ? 'La contraseña es requerida'
    : form.value.password.length < 8 ? 'Mínimo 8 caracteres'
    : ''
}
function validateConfirm() {
  errors.value.confirm =
    !form.value.confirm                           ? 'Confirma tu contraseña'
    : form.value.password !== form.value.confirm   ? 'Las contraseñas no coinciden'
    : ''
}

const isStep1Valid = computed(() =>
  form.value.name.trim().length >= 2 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email) &&
  form.value.password.length >= 8 &&
  form.value.password === form.value.confirm
)

// ── Transiciones del wizard ──────────────────────────────────────────────

/**
 * Paso 1 → 2: genera el material criptográfico de forma local (initSession sin
 * userId — el servidor aún no creó el usuario). Muestra la phrase al user.
 */
async function goToStep2() {
  validateName(); validateEmail(); validatePassword(); validateConfirm()
  if (!isStep1Valid.value) return

  preparing.value = true
  try {
    material.value = await cryptoStore.initSession(form.value.password)
    step.value = 2
  } catch (e) {
    toast.error('No se pudo inicializar el cifrado. Probá de nuevo.')
    // Log útil en dev — en producción el error no es específico para el user
    console.error('[register] initSession failed', e)
  } finally {
    preparing.value = false
  }
}

/**
 * Paso 2 → 1: el usuario quiere modificar datos. Limpiamos el material generado
 * (la phrase se regenera al volver a paso 2) y la DEK en RAM.
 */
function goToStep1() {
  material.value = null
  acknowledgedBackup.value = false
  cryptoStore.clearSession()
  step.value = 1
}

/**
 * Paso 3 — confirmación OK: envía el payload final al backend.
 */
async function handleConfirmed() {
  if (!material.value) return

  try {
    await authStore.register({
      name:         form.value.name,
      email:        form.value.email,
      password:     form.value.password,
      saltPassword:       material.value.saltPassword,
      wrappedDekPassword: material.value.wrappedDekPassword,
      saltRecovery:       material.value.saltRecovery,
      wrappedDekRecovery: material.value.wrappedDekRecovery,
    })
    toast.success('¡Cuenta creada! Bienvenido.')
    router.push({ name: 'Dashboard' })
  } catch {
    // authStore.error ya está seteado; re-ofrecemos el paso 3 para reintentar
    // Si el error fue "email ya existe", el user vuelve al paso 1 manualmente
  }
}

// ── Cleanup: si el user cierra/sale a mitad del wizard, destruir DEK en RAM ──
onBeforeUnmount(() => {
  if (step.value < 3 || authStore.error) {
    cryptoStore.clearSession()
  }
})
</script>

<style scoped>
.register {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 640px;
  width: 100%;
}

/* ── Stepper ──────────────────────────────────────────────────── */
.register__steps {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  padding: 0 var(--space-sm);
}
.register__step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  opacity: 0.4;
  transition: opacity 0.2s;
}
.register__step--active,
.register__step--done { opacity: 1; }

.register__step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-border);
  color: var(--color-text-muted);
  font-weight: 700;
  font-size: 0.85rem;
}
.register__step--active .register__step-num {
  background: var(--color-primary);
  color: white;
}
.register__step--done .register__step-num {
  background: var(--color-success);
  color: white;
}
.register__step-label {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  text-align: center;
}

/* ── Panel ───────────────────────────────────────────────────── */
.register__panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.register__header { text-align: center; }
.register__title {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 6px;
  letter-spacing: -.3px;
}
.register__subtitle { font-size: 14px; color: var(--color-text-muted); }

.register__form { display: flex; flex-direction: column; gap: 14px; }

.register__eye-btn {
  background: none; border: none; cursor: pointer;
  color: var(--color-text-muted); font-size: 1rem;
}

.register__divider {
  display: flex; align-items: center; gap: 12px;
  font-size: 12px; color: var(--color-text-muted);
}
.register__divider::before,
.register__divider::after {
  content: ''; flex: 1; height: 1px; background: var(--color-border);
}

/* ── Checkbox de ack ─────────────────────────────────────────── */
.register__ack {
  display: flex; gap: 10px;
  align-items: flex-start;
  padding: var(--space-sm) var(--space-md);
  background: rgba(234, 179, 8, 0.08);
  border: 1px solid rgba(234, 179, 8, 0.3);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--color-text);
  cursor: pointer;
}
.register__ack strong {
  color: var(--color-warning);
}
.register__ack input[type="checkbox"] {
  margin-top: 3px;
  width: 16px; height: 16px;
  cursor: pointer;
  flex-shrink: 0;
}

/* ── Botones finales ─────────────────────────────────────────── */
.register__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
}
.register__actions--single {
  grid-template-columns: 1fr;
}
</style>
