<template>
  <section
    class="rules-correo"
    aria-labelledby="rules-correo-title"
    data-test="rules-correo"
  >
    <h3 id="rules-correo-title">
      Escribe tu correo
    </h3>
    <p>
      Las reglas por aprobar llegan a tu correo. Escríbelo una sola vez. Te mandamos un enlace para confirmar que es tuyo.
    </p>
    <p
      v-if="pending"
      class="rules-correo__pending"
      role="status"
      data-test="rules-correo-pending"
    >
      Ya enviamos un correo a {{ pending.correo }}. Ábrelo y confirma. Vence el {{ formatRuleDateTime(pending.expiresAt) }}.
      Si no llegó, escríbelo de nuevo.
    </p>
    <p
      v-else-if="sentTo"
      class="rules-correo__pending"
      role="status"
      data-test="rules-correo-sent"
    >
      Te enviamos un correo a {{ sentTo }}. Ábrelo y confirma.
    </p>
    <form
      class="rules-correo__form"
      novalidate
      @submit.prevent="send"
    >
      <AppInput
        v-model="correo"
        name="correo"
        type="email"
        label="Tu correo"
        autocomplete="email"
        :disabled="working"
        :error="problem"
      />
      <AppButton
        type="submit"
        :loading="working"
        :disabled="working"
        data-test="rules-correo-send"
      >
        Enviar correo de confirmación
      </AppButton>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { AppButton, AppInput } from '@/components'
import { formatRuleDateTime } from '@/utils/finance-rules'

defineProps<{
  /** The confirmation still waiting, with the address masked. */
  pending: { correo: string; expiresAt: string } | null
  /** The masked address a confirmation was just sent to. */
  sentTo: string
  working: boolean
}>()
const emit = defineEmits<{ submit: [correo: string] }>()

const correo = ref('')
const problem = ref('')

function send() {
  const typed = correo.value.trim()
  // The server checks the address; here only the obvious mistakes, so nobody waits for an answer to learn them.
  problem.value = typed.includes('@') && !/\s/.test(typed) ? '' : 'Escribe un correo válido, por ejemplo nombre@dominio.com'
  if (!problem.value) emit('submit', typed)
}
</script>

<style scoped>
.rules-correo { display: grid; gap: var(--spacing-sm); padding: var(--spacing-md); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); }
.rules-correo h3 { margin: 0; font-size: var(--font-size-md); }
.rules-correo p { margin: 0; }
.rules-correo__pending { font-weight: 600; }
.rules-correo__form { display: grid; gap: var(--spacing-sm); }
</style>
