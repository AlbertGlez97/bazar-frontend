<template>
  <div class="recover">
    <!-- Stepper -->
    <div class="recover__steps">
      <div
        v-for="(label, i) in STEP_LABELS"
        :key="i"
        class="recover__step"
        :class="{
          'recover__step--active': step === i + 1,
          'recover__step--done':   step > i + 1,
        }"
      >
        <span class="recover__step-num">{{ step > i + 1 ? '✓' : i + 1 }}</span>
        <span class="recover__step-label">{{ label }}</span>
      </div>
    </div>

    <AppAlert type="error" :show="!!authStore.error">{{ authStore.error }}</AppAlert>
    <AppAlert type="error" :show="!!phraseError">{{ phraseError }}</AppAlert>

    <!-- ══════════════════════════════════════════════════════════
         PASO 1 — Ingresa tu email
    ══════════════════════════════════════════════════════════ -->
    <div v-if="step === 1" class="recover__panel">
      <div class="recover__header">
        <h2 class="recover__title">Recuperar cuenta</h2>
        <p class="recover__subtitle">
          Vamos a usar tu frase de 12 palabras para restablecer tu contraseña.
        </p>
      </div>

      <form @submit.prevent="handleInitRecovery" class="recover__form">
        <AppInput
          v-model="email"
          label="Correo electrónico"
          type="email"
          placeholder="tu@email.com"
          autocomplete="email"
          :disabled="authStore.loading"
          :error="emailError"
          size="lg"
          @blur="validateEmail"
        />

        <AppButton
          type="submit"
          variant="primary"
          size="lg"
          block
          :loading="authStore.loading"
          :disabled="!isValidEmail || authStore.loading"
        >
          Continuar →
        </AppButton>
      </form>

      <AppButton tag="RouterLink" to="/login" variant="ghost" size="md" block>
        ← Volver al login
      </AppButton>
    </div>

    <!-- ══════════════════════════════════════════════════════════
         PASO 2 — Ingresa tus 12 palabras
    ══════════════════════════════════════════════════════════ -->
    <div v-if="step === 2" class="recover__panel">
      <div class="recover__header">
        <h2 class="recover__title">Tu frase de recuperación</h2>
        <p class="recover__subtitle">
          Pegá o escribí las 12 palabras que te dimos al crear la cuenta, en el orden original.
        </p>
      </div>

      <div class="recover__phrase-field">
        <label class="recover__label">Frase de recuperación</label>
        <textarea
          v-model="phraseInput"
          class="recover__textarea"
          :class="{ 'recover__textarea--invalid': phraseWarning }"
          rows="4"
          placeholder="ábaco abdomen abeja abierto abogado abono aborto abrazo abrir abuelo abuso acabar"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          @input="handlePhraseInput"
        ></textarea>

        <!-- Preview del reconocimiento: una palabra por chip -->
        <div v-if="phraseWords.length > 0" class="recover__chips">
          <span
            v-for="(word, i) in phraseWords"
            :key="i"
            class="recover__chip"
            :class="{ 'recover__chip--bad': !isValidWord(word) }"
          >
            <span class="recover__chip-num">{{ i + 1 }}</span>
            <span class="recover__chip-text">{{ word }}</span>
          </span>
        </div>

        <p v-if="phraseWarning" class="recover__warn">{{ phraseWarning }}</p>
      </div>

      <div class="recover__actions">
        <AppButton variant="secondary" size="md" @click="goToStep1">← Volver</AppButton>
        <AppButton
          variant="primary"
          size="md"
          :loading="verifyingPhrase"
          :disabled="!phraseReady || verifyingPhrase"
          @click="verifyPhrase"
        >
          Continuar →
        </AppButton>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════
         PASO 3 — Nueva contraseña
    ══════════════════════════════════════════════════════════ -->
    <div v-if="step === 3" class="recover__panel">
      <div class="recover__header">
        <h2 class="recover__title">Nueva contraseña</h2>
        <p class="recover__subtitle">
          Elegí una contraseña nueva. La próxima vez que inicies sesión la usarás
          para desbloquear tu cuenta.
        </p>
      </div>

      <form @submit.prevent="handleReset" class="recover__form">
        <AppInput
          v-model="newPassword"
          label="Nueva contraseña"
          type="password"
          placeholder="Mínimo 8 caracteres"
          autocomplete="new-password"
          :disabled="authStore.loading"
          :error="passwordError"
          size="lg"
          @blur="validatePassword"
        />
        <AppInput
          v-model="confirmPassword"
          label="Confirmar contraseña"
          type="password"
          placeholder="Repetí la contraseña"
          autocomplete="new-password"
          :disabled="authStore.loading"
          :error="confirmError"
          size="lg"
          @blur="validateConfirm"
        />

        <AppButton
          type="submit"
          variant="primary"
          size="lg"
          block
          :loading="authStore.loading"
          :disabled="!passwordsReady || authStore.loading"
        >
          Restablecer contraseña
        </AppButton>
      </form>

      <AppButton variant="secondary" size="sm" block @click="step = 2">
        ← Corregir frase
      </AppButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useCryptoStore } from '@/stores/crypto.store'
import { useToastStore } from '@/stores/toast.store'
import { AppButton, AppInput, AppAlert } from '@/components'
import CryptoService from '@/services/crypto.service'
import { wordlist as spanishWordlist } from '@scure/bip39/wordlists/spanish.js'
import type { RecoveryInitResponse } from '@/types/auth.types'

const authStore   = useAuthStore()
const cryptoStore = useCryptoStore()
const toast       = useToastStore()
const router      = useRouter()

const STEP_LABELS = ['Tu email', 'Tu frase', 'Nueva contraseña']

// ── Estado ───────────────────────────────────────────────────────────────
const step = ref<1 | 2 | 3>(1)

// Paso 1
const email      = ref('')
const emailError = ref('')
const recoveryMaterial = ref<RecoveryInitResponse | null>(null)

// Paso 2
const phraseInput     = ref('')
const phraseWarning   = ref('')
const phraseError     = ref('')
const verifyingPhrase = ref(false)

// Paso 3
const newPassword     = ref('')
const confirmPassword = ref('')
const passwordError   = ref('')
const confirmError    = ref('')

// ── Paso 1 ───────────────────────────────────────────────────────────────
const isValidEmail = computed(() =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())
)

function validateEmail() {
  emailError.value = !email.value            ? 'El correo es requerido'
                   : !isValidEmail.value     ? 'Formato de correo inválido'
                   : ''
}

async function handleInitRecovery() {
  validateEmail()
  if (!isValidEmail.value) return

  try {
    recoveryMaterial.value = await authStore.recoverInit(email.value.trim().toLowerCase())
    step.value = 2
  } catch {
    // authStore.error ya está seteado
  }
}

// ── Paso 2 ───────────────────────────────────────────────────────────────
const phraseWords = computed(() =>
  CryptoService.normalizeRecoveryPhrase(phraseInput.value)
)
function isValidWord(w: string): boolean {
  return spanishWordlist.includes(w)
}
/** Está listo para intentar = 12 palabras y todas en el wordlist */
const phraseReady = computed(() =>
  phraseWords.value.length === 12 &&
  phraseWords.value.every(isValidWord)
)

function handlePhraseInput() {
  // Warnings en tiempo real — no bloqueamos la edición, solo guiamos
  const words = phraseWords.value
  if (words.length === 0) { phraseWarning.value = ''; return }
  if (words.length < 12)  { phraseWarning.value = `Faltan ${12 - words.length} palabras`; return }
  if (words.length > 12)  { phraseWarning.value = `Hay ${words.length - 12} palabras de más`; return }
  const invalid = words.filter(w => !isValidWord(w))
  phraseWarning.value = invalid.length
    ? `Palabras no válidas: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '…' : ''}`
    : ''
}

async function verifyPhrase() {
  if (!recoveryMaterial.value) {
    phraseError.value = 'Sesión de recuperación perdida. Empezá de nuevo.'
    step.value = 1
    return
  }

  verifyingPhrase.value = true
  phraseError.value     = ''
  try {
    await cryptoStore.recoverWithPhrase(
      phraseWords.value,
      recoveryMaterial.value.saltRecovery,
      recoveryMaterial.value.wrappedDekRecovery,
    )
    step.value = 3
  } catch {
    // El cryptoStore setea su propio error; lo traducimos a nuestro banner
    phraseError.value =
      'No pudimos restaurar tu cuenta con esa frase. Revisá que sean las 12 palabras correctas.'
  } finally {
    verifyingPhrase.value = false
  }
}

function goToStep1() {
  // Limpiar todo — la frase podría haberse cargado ya
  recoveryMaterial.value = null
  phraseInput.value      = ''
  phraseWarning.value    = ''
  phraseError.value      = ''
  cryptoStore.clearSession()
  step.value = 1
}

// ── Paso 3 ───────────────────────────────────────────────────────────────
function validatePassword() {
  passwordError.value = !newPassword.value              ? 'La contraseña es requerida'
                      : newPassword.value.length < 8    ? 'Mínimo 8 caracteres'
                      : ''
}
function validateConfirm() {
  confirmError.value = !confirmPassword.value                    ? 'Confirmá tu contraseña'
                     : newPassword.value !== confirmPassword.value ? 'Las contraseñas no coinciden'
                     : ''
}
const passwordsReady = computed(() =>
  newPassword.value.length >= 8 &&
  newPassword.value === confirmPassword.value
)

async function handleReset() {
  validatePassword(); validateConfirm()
  if (!passwordsReady.value) return

  try {
    await authStore.recoverComplete(email.value.trim().toLowerCase(), newPassword.value)
    toast.success('Contraseña actualizada — ya estás adentro.')
    router.push({ name: 'Dashboard' })
  } catch {
    // authStore.error ya contiene el mensaje
  }
}
</script>

<style scoped>
.recover {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 520px;
  width: 100%;
}

/* ── Stepper (copia del register para consistencia visual) ─────── */
.recover__steps {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}
.recover__step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  opacity: 0.4;
  transition: opacity 0.2s;
}
.recover__step--active,
.recover__step--done { opacity: 1; }
.recover__step-num {
  width: 28px; height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center; justify-content: center;
  background: var(--color-border);
  color: var(--color-text-muted);
  font-weight: 700; font-size: 0.85rem;
}
.recover__step--active .recover__step-num { background: var(--color-primary); color: white; }
.recover__step--done   .recover__step-num { background: var(--color-success); color: white; }
.recover__step-label { font-size: 0.78rem; color: var(--color-text-muted); text-align: center; }

/* ── Panel ─────────────────────────────────────────────────────── */
.recover__panel { display: flex; flex-direction: column; gap: var(--space-md); }
.recover__header { text-align: center; }
.recover__title {
  font-size: 22px; font-weight: 700;
  color: var(--color-text); margin-bottom: 6px;
}
.recover__subtitle { font-size: 14px; color: var(--color-text-muted); line-height: 1.4; margin: 0; }
.recover__form { display: flex; flex-direction: column; gap: 14px; }
.recover__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
}

/* ── Textarea de frase ────────────────────────────────────────── */
.recover__phrase-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.recover__label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}
.recover__textarea {
  padding: 12px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-mono, 'Menlo', 'Consolas', monospace);
  font-size: 0.92rem;
  line-height: 1.6;
  outline: none;
  resize: vertical;
  transition: border-color 0.15s;
}
.recover__textarea:focus { border-color: var(--color-primary); }
.recover__textarea--invalid { border-color: var(--color-danger); }

/* ── Chips de preview ─────────────────────────────────────────── */
.recover__chips {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.recover__chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.25);
  border-radius: 4px;
  font-size: 0.82rem;
}
.recover__chip--bad {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--color-danger);
}
.recover__chip-num {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-text-muted);
  min-width: 16px;
}
.recover__chip-text {
  font-family: var(--font-mono, monospace);
  font-weight: 600;
}
.recover__warn {
  font-size: 0.82rem;
  color: var(--color-danger);
  margin: 0;
}

@media (max-width: 480px) {
  .recover__chips { grid-template-columns: repeat(2, 1fr); }
}
</style>
