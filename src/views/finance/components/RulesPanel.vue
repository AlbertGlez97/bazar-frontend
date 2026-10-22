<template>
  <section
    class="rules-panel"
    aria-labelledby="rules-panel-title"
    data-test="rules-panel"
  >
    <AppCard>
      <header class="rules-panel__header">
        <Settings
          :size="22"
          aria-hidden="true"
        />
        <h2 id="rules-panel-title">
          Reglas de reparto
        </h2>
      </header>

      <AppAlert
        type="info"
        title="Antes de repartir, definan las reglas"
        data-test="rules-intro"
      >
        <ul class="rules-panel__intro">
          <li
            v-for="line in RULES_INTRO"
            :key="line"
          >
            {{ line }}
          </li>
        </ul>
      </AppAlert>

      <p
        v-if="store.loading && !overview"
        role="status"
        class="rules-panel__note"
      >
        Consultando las reglas…
      </p>
      <AppAlert
        v-else-if="store.error"
        type="error"
        data-test="rules-error"
      >
        {{ store.error }}
        <AppButton
          type="button"
          size="sm"
          variant="secondary"
          @click="store.load()"
        >
          Intentar de nuevo
        </AppButton>
      </AppAlert>

      <template v-if="overview">
        <AppAlert
          :type="ALERT_TYPE[state.tone]"
          :title="state.title"
          data-test="rules-state"
        >
          {{ state.detail }}
        </AppAlert>
        <p class="rules-panel__note">
          {{ overview.disclaimer }}
        </p>

        <AppAlert
          v-if="store.actionError"
          type="error"
          data-test="rules-action-error"
        >
          {{ store.actionError }}
        </AppAlert>
        <AppAlert
          v-if="submitNoticeText"
          :type="store.submitted?.failed.length ? 'warning' : 'success'"
          data-test="rules-submit-notice"
        >
          {{ submitNoticeText }}
        </AppAlert>
        <AppAlert
          v-if="resendNoticeText"
          type="info"
          data-test="rules-resend-notice"
        >
          {{ resendNoticeText }}
        </AppAlert>

        <RulesCorreoCard
          v-if="!overview.me.hasCorreo"
          :pending="overview.me.pendingCorreo"
          :working="store.working"
          @submit="store.requestCorreo($event)"
        />

        <section
          v-if="overview.inForce"
          class="rules-panel__block"
          aria-labelledby="rules-inforce-title"
          data-test="rules-inforce"
        >
          <h3 id="rules-inforce-title">
            Reglas vigentes: versión {{ overview.inForce.version }}
          </h3>
          <ul>
            <li
              v-for="line in versionSummary(overview.inForce.config)"
              :key="line"
            >
              {{ line }}
            </li>
          </ul>
        </section>

        <RulesProposal
          v-if="overview.proposal"
          :proposal="overview.proposal"
          :partners="overview.partners"
          :working="store.working"
          @resend="store.resend(overview.proposal.id)"
          @modify="modify(overview.proposal.id)"
          @discard="discard(overview.proposal.id)"
        />

        <!-- Con una propuesta abierta solo se ve este bloque si ya hay un borrador (el de "Modificar" o el
             de otro socio): sin borrador no hay nada que editar hasta que la propuesta se cierre. -->
        <section
          v-if="!overview.proposal || overview.draft"
          class="rules-panel__block"
          aria-labelledby="rules-edit-title"
        >
          <h3 id="rules-edit-title">
            {{ editTitle }}
          </h3>

          <template v-if="overview.draft && !ownDraft">
            <p data-test="rules-foreign-draft">
              {{ overview.draft.proposedBy.name }} está preparando una propuesta. Cuando la envíe, podrán responderla.
            </p>
            <div class="rules-panel__actions">
              <AppButton
                type="button"
                variant="soft-danger"
                :disabled="store.working"
                data-test="rules-discard-foreign"
                @click="discard(overview.draft.id)"
              >
                Descartar ese borrador
              </AppButton>
            </div>
          </template>

          <template v-else-if="editing">
            <section
              v-if="overview.draft?.basedOn"
              class="rules-panel__based"
              aria-labelledby="rules-based-title"
              data-test="rules-based-on"
            >
              <h4 id="rules-based-title">
                Estás cambiando la versión {{ overview.draft.basedOn.version }}
              </h4>
              <p v-if="overview.draft.basedOn.objections.length">
                Estos son los motivos de quienes no estaban de acuerdo:
              </p>
              <RulesObjections :items="overview.draft.basedOn.objections" />
            </section>
            <RulesForm
              v-model="editing"
              :disabled="store.working"
            />
            <WarningList :warnings="overview.draft?.warnings ?? []" />
            <AppAlert
              v-if="missingCorreo"
              type="warning"
              data-test="rules-missing-correo"
            >
              {{ missingCorreo }}
            </AppAlert>
            <AppCheckbox
              v-model="submitReady"
              data-test="rules-submit-check"
            >
              Entiendo que todos los socios deben aprobar estas reglas.
            </AppCheckbox>
            <div class="rules-panel__actions">
              <AppButton
                type="button"
                variant="secondary"
                :disabled="store.working"
                data-test="rules-save"
                @click="save"
              >
                Guardar borrador
              </AppButton>
              <AppButton
                type="button"
                :disabled="!submitReady || !!missingCorreo || store.working"
                :loading="store.working"
                data-test="rules-submit"
                @click="submit"
              >
                Enviar a aprobación
              </AppButton>
              <AppButton
                v-if="overview.draft"
                type="button"
                variant="soft-danger"
                :disabled="store.working"
                data-test="rules-discard"
                @click="discard(overview.draft.id)"
              >
                Descartar borrador
              </AppButton>
              <AppButton
                v-else
                type="button"
                variant="ghost"
                :disabled="store.working"
                data-test="rules-cancel"
                @click="editing = null"
              >
                Cancelar
              </AppButton>
            </div>
          </template>

          <AppButton
            v-else
            type="button"
            data-test="rules-start"
            @click="startEditing"
          >
            {{ overview.inForce ? 'Proponer cambios' : 'Configurar las reglas' }}
          </AppButton>
        </section>

        <RulesHistory :items="overview.history" />
      </template>
    </AppCard>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Settings } from '@lucide/vue'
import { AppAlert, AppButton, AppCard, AppCheckbox } from '@/components'
import { useFinanceRulesStore } from '@/stores/finance-rules.store'
import {
  RULES_INTRO,
  defaultRulesConfig,
  missingCorreoText,
  resendNotice,
  submitNotice,
  versionSummary,
} from '@/utils/finance-rules'
import type { FinanceRulesConfig } from '@/types/finance-rules.types'
import RulesCorreoCard from './RulesCorreoCard.vue'
import RulesForm from './RulesForm.vue'
import RulesHistory from './RulesHistory.vue'
import RulesObjections from './RulesObjections.vue'
import RulesProposal from './RulesProposal.vue'
import WarningList from './RulesWarningList.vue'

const ALERT_TYPE = { neutral: 'info', warning: 'warning', success: 'success' } as const

const store = useFinanceRulesStore()
const overview = computed(() => store.overview)
const state = computed(() => store.stateText!)
const editing = ref<FinanceRulesConfig | null>(null)
const submitReady = ref(false)

const ownDraft = computed(() => !!overview.value?.draft && overview.value.draft.proposedBy.memberId === overview.value.me.memberId)
const editTitle = computed(() => (overview.value?.inForce ? 'Cambiar las reglas' : 'Configurar las reglas'))

// Nada se envía mientras a un socio le falte el correo: se dice a quién antes de intentarlo.
const missingCorreo = computed(() =>
  missingCorreoText((overview.value?.partners ?? []).filter((p) => !p.hasCorreo).map((p) => p.name)),
)
const submitNoticeText = computed(() => (store.submitted ? submitNotice(store.submitted) : ''))
const resendNoticeText = computed(() => (store.resent ? resendNotice(store.resent) : ''))

// Un borrador propio se abre listo para seguir editándolo.
watch(
  () => overview.value?.draft?.configHash,
  () => {
    const draft = overview.value?.draft
    if (draft && ownDraft.value) editing.value = JSON.parse(JSON.stringify(draft.config)) as FinanceRulesConfig
    if (!draft) editing.value = null
  },
  { immediate: true },
)
// La casilla de "entiendo" no se arrastra de un borrador a otro.
watch(() => overview.value?.draft?.id, () => { submitReady.value = false })

function startEditing() {
  store.clearNotices()
  const base = overview.value?.inForce?.config ?? defaultRulesConfig()
  editing.value = JSON.parse(JSON.stringify(base)) as FinanceRulesConfig
}
async function save() {
  if (editing.value) await store.saveDraft(editing.value)
}
async function submit() {
  if (!editing.value) return
  const saved = await store.saveDraft(editing.value)
  if (saved) await store.submit(saved.id)
}
async function discard(id: string) {
  store.clearNotices()
  await store.discard(id)
}
async function modify(id: string) {
  store.clearNotices()
  await store.modify(id)
}

onMounted(() => { void store.load() })
</script>

<style scoped>
.rules-panel { display: grid; }
.rules-panel :deep(.app-card) { display: grid; gap: var(--spacing-md); padding: var(--spacing-md); }
.rules-panel__header { display: flex; align-items: center; gap: var(--spacing-sm); }
.rules-panel__header h2 { margin: 0; font-size: var(--font-size-lg); }
.rules-panel__intro { margin: 0; padding-left: var(--spacing-md); }
.rules-panel__note { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
.rules-panel__block { display: grid; gap: var(--spacing-sm); padding-top: var(--spacing-sm); border-top: 1px solid var(--color-border); }
.rules-panel__block h3 { margin: 0; font-size: var(--font-size-md); }
.rules-panel__block ul { margin: 0; padding-left: var(--spacing-md); }
.rules-panel__block p { margin: 0; }
.rules-panel__based { display: grid; gap: var(--spacing-xs); }
.rules-panel__based h4 { margin: 0; font-size: var(--font-size-base); }
.rules-panel__actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
</style>
