<template>
  <!--
    PhraseConfirmation — pide al usuario que escriba 3 palabras específicas de su
    frase de recuperación como prueba de que la guardó. Sin esto, cualquiera
    podría hacer click en "continuar" sin haber copiado nada.

    Props:
      phrase — las 12 palabras originales (para validar contra ellas)
    Emits:
      confirmed — cuando las 3 palabras están correctas
      request-reshow — cuando el usuario quiere volver a ver la frase
  -->
  <div class="phrase-confirm">
    <div class="phrase-confirm__header">
      <h3 class="phrase-confirm__title">Confirma que guardaste la frase</h3>
      <p class="phrase-confirm__subtitle">
        Escribe las palabras de estas tres posiciones. Así nos aseguramos de que
        realmente tienes la frase a mano.
      </p>
    </div>

    <div class="phrase-confirm__grid">
      <div
        v-for="(pos, idx) in positions"
        :key="pos"
        class="phrase-confirm__field"
      >
        <label class="phrase-confirm__label">Palabra #{{ pos }}</label>
        <input
          v-model="inputs[idx]"
          type="text"
          class="phrase-confirm__input"
          :class="feedbackClass(idx)"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          :placeholder="`palabra ${pos}`"
          @input="handleInput(idx)"
        />
        <span v-if="feedbackIcon(idx)" class="phrase-confirm__feedback">
          {{ feedbackIcon(idx) }}
        </span>
      </div>
    </div>

    <!-- Estado de intentos -->
    <div v-if="failedAttempts > 0" class="phrase-confirm__attempts">
      <p v-if="failedAttempts < MAX_ATTEMPTS" class="phrase-confirm__attempts-warn">
        ⚠️ Alguna palabra no coincide. Intento {{ failedAttempts }} de {{ MAX_ATTEMPTS }}.
      </p>
      <div v-else class="phrase-confirm__attempts-block">
        <p class="phrase-confirm__attempts-error">
          ❌ Tres intentos fallidos. Tómate un momento para revisar que tengas la frase bien copiada.
        </p>
        <AppButton variant="secondary" size="sm" block @click="requestReshow">
          ← Volver a ver la frase
        </AppButton>
      </div>
    </div>

    <!-- Botón principal -->
    <AppButton
      v-if="failedAttempts < MAX_ATTEMPTS"
      variant="primary"
      size="lg"
      block
      :disabled="!allFilled"
      @click="attemptConfirm"
    >
      Confirmar
    </AppButton>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { AppButton } from '@/components'
import CryptoService from '@/services/crypto.service'

interface Props {
  phrase: string[]
}

const props = defineProps<Props>()
const emit  = defineEmits<{
  (e: 'confirmed'): void
  (e: 'request-reshow'): void
}>()

const MAX_ATTEMPTS = 3

// Elige 3 posiciones aleatorias entre 1 y 12 (1-indexed para mostrar al usuario)
function pickPositions(): number[] {
  const all  = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  const pick: number[] = []
  while (pick.length < 3) {
    const idx = Math.floor(Math.random() * all.length)
    pick.push(all.splice(idx, 1)[0])
  }
  return pick.sort((a, b) => a - b)
}

const positions       = ref<number[]>(pickPositions())
const inputs          = ref<string[]>(['', '', ''])
const failedAttempts  = ref(0)
/** marca si ya se verificó (para mostrar feedback verde/rojo por campo) */
const verified        = ref<boolean[]>([false, false, false])

const allFilled = computed(() =>
  inputs.value.every(w => w.trim().length > 0)
)

/** Normaliza la palabra ingresada igual que normalizeRecoveryPhrase
 *  (NFKD + lowercase + trim), para que "ÁBACO" matchee con "ábaco" NFKD. */
function normalizeWord(w: string): string {
  return CryptoService.normalizeRecoveryPhrase(w)[0] ?? ''
}

function matches(idx: number): boolean {
  const expected = CryptoService.normalizeRecoveryPhrase(props.phrase[positions.value[idx] - 1])[0] ?? ''
  return normalizeWord(inputs.value[idx]) === expected
}

function handleInput(idx: number) {
  // Al tipear, resetea el feedback visual del campo — se re-evalúa al confirmar
  verified.value[idx] = false
}

function feedbackClass(idx: number): string {
  if (!verified.value[idx]) return ''
  return matches(idx) ? 'phrase-confirm__input--ok' : 'phrase-confirm__input--bad'
}

function feedbackIcon(idx: number): string {
  if (!verified.value[idx]) return ''
  return matches(idx) ? '✓' : '✗'
}

function attemptConfirm() {
  // Marca los 3 como verificados para mostrar feedback
  verified.value = [true, true, true]

  const allOk = inputs.value.every((_, i) => matches(i))
  if (allOk) {
    emit('confirmed')
    return
  }

  failedAttempts.value++
  // En próximo intento regeneramos posiciones (anti-adivinanza por dumb luck)
  if (failedAttempts.value < MAX_ATTEMPTS) {
    positions.value = pickPositions()
    inputs.value    = ['', '', '']
    verified.value  = [false, false, false]
  }
}

function requestReshow() {
  // Resetea todo y pide al padre volver al paso anterior
  failedAttempts.value = 0
  inputs.value         = ['', '', '']
  verified.value       = [false, false, false]
  positions.value      = pickPositions()
  emit('request-reshow')
}
</script>

<style scoped>
.phrase-confirm {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.phrase-confirm__header { text-align: center; }
.phrase-confirm__title {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0 0 6px;
  color: var(--color-text);
}
.phrase-confirm__subtitle {
  font-size: 0.88rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.4;
}

.phrase-confirm__grid {
  display: grid;
  gap: var(--space-sm);
}
.phrase-confirm__field {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}
.phrase-confirm__label {
  min-width: 90px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}
.phrase-confirm__input {
  flex: 1;
  padding: 10px 12px;
  font-size: 0.95rem;
  font-family: var(--font-mono, 'Menlo', monospace);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.15s;
}
.phrase-confirm__input:focus { border-color: var(--color-primary); }
.phrase-confirm__input--ok   { border-color: var(--color-success); }
.phrase-confirm__input--bad  { border-color: var(--color-danger); }
.phrase-confirm__feedback {
  position: absolute;
  right: 14px;
  font-weight: 700;
  font-size: 1.1rem;
}
.phrase-confirm__input--ok + .phrase-confirm__feedback { color: var(--color-success); }
.phrase-confirm__input--bad + .phrase-confirm__feedback { color: var(--color-danger); }

.phrase-confirm__attempts-warn {
  font-size: 0.88rem;
  color: #d97706;
  margin: 0;
}
.phrase-confirm__attempts-block { display: flex; flex-direction: column; gap: 8px; }
.phrase-confirm__attempts-error {
  font-size: 0.9rem;
  color: var(--color-danger);
  margin: 0;
}
</style>
