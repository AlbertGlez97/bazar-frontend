<template>
  <!-- Organismo: invitar a un socio a crear su cuenta personal. No hace fetch: valida el correo
       en el cliente y emite `submit`; la vista llama al servidor y devuelve aquí el error. -->
  <form
    class="invite-form"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <p class="invite-form__lead">
      Le mandamos un enlace a su correo. Con el enlace, {{ memberName }} elige su propia contraseña.
      El enlace sirve una sola vez y dura 72 horas.
    </p>
    <AppInput
      v-model="email"
      label="Correo de la persona"
      name="email"
      type="email"
      inputmode="email"
      size="lg"
      autocomplete="email"
      autocapitalize="off"
      spellcheck="false"
      :disabled="loading"
      :error="problem || undefined"
    />
    <AppAlert
      type="error"
      :show="!!error"
    >
      {{ error }}
    </AppAlert>
    <div class="invite-form__actions">
      <AppButton
        type="button"
        variant="ghost"
        :disabled="loading"
        @click="$emit('cancel')"
      >
        Cancelar
      </AppButton>
      <AppButton
        type="submit"
        :loading="loading"
        :disabled="loading"
      >
        {{ resend ? 'Reenviar invitación' : 'Enviar invitación' }}
      </AppButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppAlert from './../molecules/AppAlert.vue'
import AppButton from './../atoms/AppButton.vue'
import AppInput from './../molecules/AppInput.vue'

const props = withDefaults(defineProps<{
  memberName: string
  /** Correo de una invitación anterior, para reenviarla sin volver a escribirlo. */
  initialEmail?: string
  resend?: boolean
  loading?: boolean
  /** Lo que respondió el servidor, ya en español. */
  error?: string
}>(), { initialEmail: '', resend: false, loading: false, error: '' })

const emit = defineEmits<{ submit: [email: string]; cancel: [] }>()

const MAX_EMAIL = 100
const FORBIDDEN = /[\s,;<>"']/

/**
 * Un solo correo sencillo (el servidor es igual de estricto): sin espacios, comas ni
 * comillas, una sola @ y un dominio con punto. Recorrido lineal, sin retroceso.
 */
function isPlainEmail(value: string): boolean {
  if (value.length > MAX_EMAIL || FORBIDDEN.test(value)) return false
  const at = value.indexOf('@')
  if (at < 1 || at !== value.lastIndexOf('@')) return false
  const domain = value.slice(at + 1)
  const dot = domain.lastIndexOf('.')
  return dot > 0 && dot < domain.length - 1 && !domain.includes('..')
}

const email = ref(props.initialEmail)
const problem = ref('')

function handleSubmit() {
  const value = email.value.trim().toLowerCase()
  if (!isPlainEmail(value)) {
    problem.value = 'Escribe un solo correo, bien escrito.'
    return
  }
  problem.value = ''
  emit('submit', value)
}
</script>

<style scoped>
.invite-form { display: flex; flex-direction: column; gap: var(--spacing-md); }
.invite-form__lead { margin: 0; color: var(--color-text-muted); }
.invite-form__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--spacing-sm); }
</style>
