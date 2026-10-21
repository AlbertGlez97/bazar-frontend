<template>
  <!-- Vista pública: /confirmar-correo/:token (el enlace del correo de "Escribir mi correo"). Abrirla solo
       CONSULTA a quién pertenece el correo: los escáneres de correo abren los enlaces solos. Solo el botón
       confirma (POST). -->
  <section
    class="confirm-email"
    aria-label="Confirmar mi correo"
  >
    <div class="confirm-email__inner container">
      <h1
        ref="titleEl"
        class="confirm-email__title"
        tabindex="-1"
      >
        {{ title }}
      </h1>

      <p
        v-if="state === 'loading'"
        role="status"
        class="confirm-email__text"
      >
        Revisando tu enlace…
      </p>

      <template v-else-if="page && (state === 'ready' || state === 'working')">
        <p class="confirm-email__text">
          Hola, {{ page.memberName }}. Vas a usar <strong>{{ page.correo }}</strong> para recibir las reglas por aprobar.
        </p>
        <p class="confirm-email__note">
          Este enlace vence el {{ formatRuleDate(page.expiresAt) }}.
        </p>
        <p
          v-if="problem"
          class="confirm-email__text confirm-email__text--error"
          role="alert"
        >
          {{ problem }}
        </p>
        <AppButton
          type="button"
          variant="primary"
          size="lg"
          block
          :loading="state === 'working'"
          :disabled="state === 'working'"
          data-test="confirm-email"
          @click="confirm"
        >
          Confirmar mi correo
        </AppButton>
      </template>

      <template v-else-if="state === 'done'">
        <p
          class="confirm-email__text"
          role="status"
          data-test="confirm-done"
        >
          Tu correo {{ confirmed }} quedó confirmado. Aquí llegarán las reglas por aprobar.
        </p>
        <RouterLink
          class="confirm-email__link"
          to="/login"
        >
          Ir a entrar
        </RouterLink>
      </template>

      <template v-else-if="state === 'invalid'">
        <p
          class="confirm-email__text"
          role="alert"
        >
          {{ problem || EMAIL_LINK_INVALID_TEXT }}
        </p>
        <RouterLink
          class="confirm-email__link"
          to="/login"
        >
          Ir a entrar
        </RouterLink>
      </template>

      <template v-else>
        <p
          class="confirm-email__text"
          role="alert"
        >
          {{ problem }}
        </p>
        <AppButton
          type="button"
          variant="secondary"
          data-test="retry"
          @click="load"
        >
          Intentar de nuevo
        </AppButton>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { AppButton } from '@/components'
import { TOKEN_SHAPE, useLinkPage } from '@/composables/useLinkPage'
import { MemberEmailService } from '@/services/agreements.service'
import { EMAIL_LINK_INVALID_TEXT, emailLinkErrorMessage, isInvalidLink } from '@/utils/agreements'
import { formatRuleDate } from '@/utils/finance-rules'
import type { CorreoConfirmationPage } from '@/types/finance-rules.types'

type State = 'loading' | 'ready' | 'working' | 'done' | 'invalid' | 'error'

const route = useRoute()
const token = typeof route.params.token === 'string' && TOKEN_SHAPE.test(route.params.token) ? route.params.token : ''

const state = ref<State>(token ? 'loading' : 'invalid')
const page = ref<CorreoConfirmationPage | null>(null)
const confirmed = ref('')
const problem = ref('')
const titleEl = ref<HTMLElement | null>(null)

const TITLES: Record<State, string> = {
  loading: 'Confirma tu correo',
  ready: 'Confirma tu correo',
  working: 'Confirma tu correo',
  error: 'Confirma tu correo',
  done: 'Listo',
  invalid: 'Este enlace no sirve',
}
const title = computed(() => TITLES[state.value])

useLinkPage(state, titleEl, () => { if (token) void load() })

async function load() {
  state.value = 'loading'
  problem.value = ''
  try {
    page.value = await MemberEmailService.inspect(token)
    state.value = 'ready'
  } catch (cause) {
    problem.value = emailLinkErrorMessage(cause)
    state.value = isInvalidLink(cause) ? 'invalid' : 'error'
  }
}

async function confirm() {
  if (state.value === 'working') return
  state.value = 'working'
  problem.value = ''
  try {
    confirmed.value = (await MemberEmailService.confirm(token)).correo
    state.value = 'done'
  } catch (cause) {
    problem.value = emailLinkErrorMessage(cause)
    state.value = isInvalidLink(cause) ? 'invalid' : 'ready'
  }
}
</script>

<style scoped>
.confirm-email { padding: var(--spacing-xl) var(--spacing-md) var(--spacing-2xl); }
.confirm-email__inner { max-width: 32rem; margin: 0 auto; display: flex; flex-direction: column; gap: var(--spacing-md); }
.confirm-email__title { margin: 0; font-size: var(--font-size-2xl); font-weight: 800; color: var(--color-text); text-align: center; }
.confirm-email__title:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 4px; border-radius: var(--radius-sm); }
.confirm-email__text { margin: 0; color: var(--color-text); line-height: 1.55; text-align: center; overflow-wrap: anywhere; }
.confirm-email__text--error { color: var(--color-danger); font-weight: 600; }
.confirm-email__note { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); text-align: center; }
.confirm-email__link {
  align-self: center;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--color-primary-hover);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.confirm-email__link:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; border-radius: var(--radius-sm); }
</style>
