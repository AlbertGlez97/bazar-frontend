<template>
  <!-- Vista pública: /invitacion/:token (el enlace del correo de invitación). Abrir la página solo
       CONSULTA a quién va dirigida: los escáneres de correo abren los enlaces solos y no deben gastar
       nada. Solo el botón crea la cuenta (POST). La persona elige su propia contraseña. -->
  <section
    class="invitation"
    aria-label="Crear mi cuenta"
  >
    <div class="invitation__inner container">
      <h1
        ref="titleEl"
        class="invitation__title"
        tabindex="-1"
      >
        {{ title }}
      </h1>

      <p
        v-if="state === 'loading'"
        role="status"
        class="invitation__text"
      >
        Revisando tu enlace…
      </p>

      <template v-else-if="state === 'ready' || state === 'working'">
        <p class="invitation__text">
          Hola, {{ preview?.memberName }}. Esta cuenta será para <strong>{{ preview?.email }}</strong>.
        </p>
        <p class="invitation__text">
          Tú eliges tu contraseña. Nadie más la conoce.
        </p>
        <form
          class="invitation__form"
          novalidate
          @submit.prevent="create"
        >
          <AppInput
            v-model="password"
            name="password"
            type="password"
            label="Contraseña nueva"
            autocomplete="new-password"
            :disabled="state === 'working'"
          />
          <AppInput
            v-model="confirm"
            name="confirm"
            type="password"
            label="Repite la contraseña"
            autocomplete="new-password"
            :disabled="state === 'working'"
          />
          <p class="invitation__hint">
            Al menos {{ MIN_PASSWORD }} caracteres.
          </p>
          <p
            v-if="problem"
            class="invitation__text invitation__text--error"
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
            @click="create"
          >
            Crear mi contraseña
          </AppButton>
        </form>
      </template>

      <template v-else-if="state === 'invalid'">
        <p
          class="invitation__text"
          role="alert"
        >
          {{ problem || INVALID_TEXT }}
        </p>
        <RouterLink
          class="invitation__link"
          to="/login"
        >
          Ir a entrar
        </RouterLink>
      </template>

      <template v-else>
        <p
          class="invitation__text"
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AppButton, AppInput } from '@/components'
import { AccountInvitationsService } from '@/services/account-invitations.service'
import { MIN_PASSWORD, invitationErrorMessage, passwordProblem } from '@/utils/account-invitations'
import type { InvitationPreview } from '@/types/account-invitation.types'

type State = 'loading' | 'ready' | 'working' | 'invalid' | 'error'

const INVALID_TEXT = 'Este enlace no sirve. Pide una invitación nueva.'
// Mismo patrón que el servidor: 32 bytes en base64url.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/

const route = useRoute()
const router = useRouter()
const token = typeof route.params.token === 'string' && TOKEN_SHAPE.test(route.params.token) ? route.params.token : ''

const state = ref<State>(token ? 'loading' : 'invalid')
const preview = ref<InvitationPreview | null>(null)
const password = ref('')
const confirm = ref('')
const problem = ref('')
const titleEl = ref<HTMLElement | null>(null)

const TITLES: Record<State, string> = {
  loading: 'Crea tu cuenta',
  ready: 'Crea tu cuenta',
  working: 'Crea tu cuenta',
  invalid: 'Este enlace no sirve',
  error: 'Crea tu cuenta',
}
const title = computed(() => TITLES[state.value])

const isInvalidLink = (cause: unknown) => (cause as { response?: { status?: number } } | null)?.response?.status === 404

// El resultado se anuncia llevando el foco al título del nuevo estado
watch(state, async (now) => {
  if (now === 'working' || now === 'loading') return
  await nextTick()
  titleEl.value?.focus()
})

// El enlace lleva el token: que ninguna página a la que se salga reciba la dirección en el Referer.
let referrerMeta: HTMLMetaElement | null = null
onMounted(() => {
  referrerMeta = document.createElement('meta')
  referrerMeta.name = 'referrer'
  referrerMeta.content = 'no-referrer'
  document.head.appendChild(referrerMeta)
  if (token) void load()
})
onBeforeUnmount(() => referrerMeta?.remove())

async function load() {
  state.value = 'loading'
  problem.value = ''
  try {
    preview.value = await AccountInvitationsService.inspect(token)
    state.value = 'ready'
  } catch (cause) {
    problem.value = invitationErrorMessage(cause)
    state.value = isInvalidLink(cause) ? 'invalid' : 'error'
  }
}

async function create() {
  if (state.value === 'working') return
  problem.value = passwordProblem(password.value, confirm.value)
  if (problem.value) return
  state.value = 'working'
  try {
    const { email } = await AccountInvitationsService.accept(token, password.value)
    password.value = ''
    confirm.value = ''
    // No inicia sesión sola: lleva al login con el correo ya escrito.
    await router.replace({ name: 'Login', query: { email, created: '1' } })
  } catch (cause) {
    problem.value = invitationErrorMessage(cause)
    state.value = isInvalidLink(cause) ? 'invalid' : 'ready'
  }
}
</script>

<style scoped>
.invitation { padding: var(--spacing-xl) var(--spacing-md) var(--spacing-2xl); }
.invitation__inner { max-width: 32rem; margin: 0 auto; display: flex; flex-direction: column; gap: var(--spacing-md); }
.invitation__title { margin: 0; font-size: var(--font-size-2xl); font-weight: 800; color: var(--color-text); text-align: center; }
.invitation__title:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 4px; border-radius: var(--radius-sm); }
.invitation__text { margin: 0; color: var(--color-text); line-height: 1.55; text-align: center; overflow-wrap: anywhere; }
.invitation__text--error { color: var(--color-danger); font-weight: 600; }
.invitation__hint { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
.invitation__form { display: flex; flex-direction: column; gap: var(--spacing-md); }
.invitation__link {
  align-self: center;
  color: var(--color-primary-hover);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.invitation__link:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; border-radius: var(--radius-sm); }
</style>
