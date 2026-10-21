<template>
  <!-- Vista pública: /acuerdo/:token (el botón "Revisar y responder" del correo). Abrir la página solo
       CONSULTA las reglas: los escáneres de correo abren los enlaces solos y no deben gastar nada.
       Solo los botones responden (POST). Cada socio tiene su propio enlace. -->
  <section
    class="agreement"
    aria-label="Reglas de reparto"
  >
    <div class="agreement__inner container">
      <h1
        ref="titleEl"
        class="agreement__title"
        tabindex="-1"
      >
        {{ title }}
      </h1>

      <p
        v-if="state === 'loading'"
        role="status"
        class="agreement__text"
      >
        Revisando tu enlace…
      </p>

      <template v-else-if="page && (state === 'ready' || state === 'working' || state === 'objecting')">
        <p class="agreement__text">
          Hola, {{ page.memberName }}. {{ page.proposerName }} propuso estas reglas de reparto para
          {{ page.business }} (versión {{ page.version }}).
        </p>

        <section
          v-if="page.changes?.length"
          class="agreement__block"
          aria-labelledby="agreement-changes"
          data-test="agreement-changes"
        >
          <h2 id="agreement-changes">
            Qué cambió
          </h2>
          <ul>
            <li
              v-for="change in page.changes"
              :key="change.topic"
            >
              <strong>{{ change.topic }}.</strong> Antes: {{ change.before }} Ahora: {{ change.after }}
            </li>
          </ul>
        </section>

        <section
          class="agreement__block"
          aria-labelledby="agreement-rules"
        >
          <h2 id="agreement-rules">
            Las reglas
          </h2>
          <ul data-test="agreement-rules">
            <li
              v-for="line in page.rules"
              :key="line"
            >
              {{ line }}
            </li>
          </ul>
          <AppAlert
            v-for="warning in page.warnings"
            :key="warning.code"
            type="info"
          >
            {{ warning.message }}
          </AppAlert>
        </section>

        <p
          v-if="page.approvedBy.length"
          class="agreement__text"
          data-test="agreement-approved"
        >
          Ya aprobaron: {{ joinNames(page.approvedBy) }}.
        </p>
        <p
          v-if="page.waitingFor.length"
          class="agreement__text"
          data-test="agreement-waiting"
        >
          Falta responder: {{ joinNames(page.waitingFor) }}.
        </p>
        <p class="agreement__note">
          Abrir esta página no aprueba nada. Tú decides aquí. Las reglas valen cuando todos los socios aprueban.
          Este enlace vence el {{ formatRuleDate(page.expiresAt) }}.
        </p>

        <form
          v-if="state === 'objecting'"
          class="agreement__form"
          novalidate
          @submit.prevent="object"
        >
          <AppTextarea
            v-model="reason"
            name="reason"
            autocomplete="off"
            label="¿Por qué no estás de acuerdo?"
            hint="Escribe en pocas palabras. Los demás socios lo verán."
            :maxlength="MAX_REASON"
            counter
            :rows="4"
            :error="problem"
          />
          <div class="agreement__actions">
            <AppButton
              type="submit"
              variant="primary"
              size="lg"
              data-test="agreement-send-objection"
            >
              Enviar mi respuesta
            </AppButton>
            <AppButton
              type="button"
              variant="ghost"
              size="lg"
              data-test="agreement-back"
              @click="back"
            >
              Volver
            </AppButton>
          </div>
        </form>

        <template v-else>
          <p
            v-if="problem"
            class="agreement__text agreement__text--error"
            role="alert"
          >
            {{ problem }}
          </p>
          <div class="agreement__actions">
            <AppButton
              type="button"
              variant="primary"
              size="lg"
              :loading="state === 'working'"
              :disabled="state === 'working'"
              data-test="agreement-approve"
              @click="approve"
            >
              Aprobar
            </AppButton>
            <AppButton
              type="button"
              variant="secondary"
              size="lg"
              :disabled="state === 'working'"
              data-test="agreement-object"
              @click="startObjecting"
            >
              No estoy de acuerdo
            </AppButton>
          </div>
        </template>
      </template>

      <template v-else-if="state === 'review'">
        <p
          class="agreement__text"
          data-test="agreement-in-review"
        >
          {{ reviewText }}
        </p>
      </template>

      <template v-else-if="state === 'done' && outcome">
        <p
          class="agreement__text"
          role="status"
          data-test="agreement-done"
        >
          {{ outcome.detail }}
        </p>
      </template>

      <template v-else-if="state === 'invalid'">
        <p
          class="agreement__text"
          role="alert"
        >
          {{ problem || AGREEMENT_INVALID_TEXT }}
        </p>
      </template>

      <template v-else-if="state === 'error'">
        <p
          class="agreement__text"
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
import { AppAlert, AppButton, AppTextarea } from '@/components'
import { TOKEN_SHAPE, useLinkPage } from '@/composables/useLinkPage'
import { AgreementsService } from '@/services/agreements.service'
import {
  AGREEMENT_INVALID_TEXT,
  MAX_REASON,
  agreementErrorMessage,
  isInvalidLink,
  outcomeText,
  reasonProblem,
  type OutcomeText,
} from '@/utils/agreements'
import { formatRuleDate, joinNames } from '@/utils/finance-rules'
import type { AgreementPage } from '@/types/finance-rules.types'

type State = 'loading' | 'ready' | 'objecting' | 'working' | 'review' | 'done' | 'invalid' | 'error'

const route = useRoute()
const token = typeof route.params.token === 'string' && TOKEN_SHAPE.test(route.params.token) ? route.params.token : ''

const state = ref<State>(token ? 'loading' : 'invalid')
const page = ref<AgreementPage | null>(null)
const outcome = ref<OutcomeText | null>(null)
const reason = ref('')
const problem = ref('')
const titleEl = ref<HTMLElement | null>(null)
const reviewText = computed(() => page.value?.message ?? outcomeText('en_revision').detail)

const TITLES: Record<State, string> = {
  loading: 'Reglas de reparto',
  ready: 'Reglas de reparto',
  objecting: 'Reglas de reparto',
  working: 'Reglas de reparto',
  error: 'Reglas de reparto',
  review: 'Esta propuesta está en revisión',
  done: 'Listo',
  invalid: 'Este enlace no sirve',
}
const title = computed(() => (state.value === 'done' && outcome.value ? outcome.value.title : TITLES[state.value]))

useLinkPage(state, titleEl, () => { if (token) void load() })

async function load() {
  state.value = 'loading'
  problem.value = ''
  try {
    page.value = await AgreementsService.inspect(token)
    state.value = page.value.state === 'en_revision' ? 'review' : 'ready'
  } catch (cause) {
    problem.value = agreementErrorMessage(cause)
    state.value = isInvalidLink(cause) ? 'invalid' : 'error'
  }
}

async function send(decision: 'approve' | 'object', reasonText?: string) {
  state.value = 'working'
  problem.value = ''
  try {
    const result = await AgreementsService.respond(token, decision, reasonText)
    outcome.value = outcomeText(result.outcome)
    state.value = result.outcome === 'en_revision' ? 'review' : 'done'
  } catch (cause) {
    problem.value = agreementErrorMessage(cause)
    state.value = isInvalidLink(cause) ? 'invalid' : decision === 'object' ? 'objecting' : 'ready'
  }
}

function approve() {
  if (state.value === 'working') return
  void send('approve')
}
function startObjecting() {
  problem.value = ''
  state.value = 'objecting'
}
function back() {
  problem.value = ''
  state.value = 'ready'
}
function object() {
  if (state.value === 'working') return
  problem.value = reasonProblem(reason.value)
  if (!problem.value) void send('object', reason.value.trim())
}
</script>

<style scoped>
.agreement { padding: var(--spacing-xl) var(--spacing-md) var(--spacing-2xl); }
.agreement__inner { max-width: 40rem; margin: 0 auto; display: flex; flex-direction: column; gap: var(--spacing-md); }
.agreement__title { margin: 0; font-size: var(--font-size-2xl); font-weight: 800; color: var(--color-text); text-align: center; }
.agreement__title:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 4px; border-radius: var(--radius-sm); }
.agreement__text { margin: 0; color: var(--color-text); line-height: 1.55; overflow-wrap: anywhere; }
.agreement__text--error { color: var(--color-danger); font-weight: 600; }
.agreement__note { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); line-height: 1.5; }
.agreement__block { display: grid; gap: var(--spacing-sm); }
.agreement__block h2 { margin: 0; font-size: var(--font-size-lg); }
.agreement__block ul { margin: 0; padding-left: var(--spacing-md); display: grid; gap: var(--spacing-xs); }
.agreement__form { display: flex; flex-direction: column; gap: var(--spacing-md); }
.agreement__actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
@media (max-width: 480px) { .agreement__actions > * { flex: 1 1 100%; } }
</style>
