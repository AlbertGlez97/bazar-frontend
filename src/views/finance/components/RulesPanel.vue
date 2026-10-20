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
          v-if="reminderNotice"
          type="info"
          data-test="rules-reminder-notice"
        >
          {{ reminderNotice }}
        </AppAlert>

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

        <section
          v-if="overview.pending"
          class="rules-panel__block"
          aria-labelledby="rules-pending-title"
          data-test="rules-pending"
        >
          <h3 id="rules-pending-title">
            Propuesta en espera: versión {{ overview.pending.version }}
          </h3>
          <p>Propuso {{ overview.pending.proposedBy.name }}. Mientras no la aprueben todos, siguen las reglas anteriores.</p>
          <ul>
            <li
              v-for="line in versionSummary(overview.pending.config)"
              :key="line"
            >
              {{ line }}
            </li>
          </ul>
          <WarningList :warnings="overview.pending.warnings" />

          <AppAlert
            v-if="!overview.me.canApprove && !overview.me.hasApproved"
            type="warning"
            data-test="rules-cannot-approve"
          >
            {{ overview.me.cannotApproveReason }}
          </AppAlert>
          <p
            v-else-if="overview.me.hasApproved"
            data-test="rules-already-approved"
          >
            Ya aprobaste esta propuesta. Esperamos a los demás socios.
          </p>
          <AppCheckbox
            v-else
            v-model="approveReady"
            data-test="rules-approve-check"
          >
            Leí estas reglas y estoy de acuerdo.
          </AppCheckbox>

          <div class="rules-panel__actions">
            <AppButton
              v-if="overview.me.canApprove && !overview.me.hasApproved"
              type="button"
              :disabled="!approveReady || store.working"
              :loading="store.working"
              data-test="rules-approve"
              @click="approve(overview.pending.id)"
            >
              Aprobar estas reglas
            </AppButton>
            <template v-if="overview.me.isProposer">
              <AppButton
                type="button"
                variant="secondary"
                :disabled="store.working"
                data-test="rules-remind"
                @click="store.remind(overview.pending.id)"
              >
                Recordar a quien falta
              </AppButton>
              <AppButton
                type="button"
                variant="soft-warning"
                :disabled="store.working"
                data-test="rules-withdraw"
                @click="withdraw(overview.pending.id)"
              >
                Retirar la propuesta
              </AppButton>
            </template>
          </div>
          <p
            v-if="overview.me.isProposer"
            class="rules-panel__note"
          >
            Al retirarla, vuelve a borrador y se borran las aprobaciones que ya dieron.
          </p>
          <p
            v-if="remindText"
            role="status"
            data-test="rules-remind-result"
          >
            {{ remindText }}
          </p>
        </section>

        <section
          v-if="!overview.pending"
          class="rules-panel__block"
          aria-labelledby="rules-edit-title"
        >
          <h3 id="rules-edit-title">
            {{ editTitle }}
          </h3>

          <template v-if="overview.draft && !ownDraft">
            <p data-test="rules-foreign-draft">
              {{ overview.draft.proposedBy.name }} está preparando una propuesta. Cuando la envíe, podrán aprobarla.
            </p>
          </template>

          <template v-else-if="editing">
            <RulesForm
              v-model="editing"
              :disabled="store.working"
            />
            <WarningList :warnings="overview.draft?.warnings ?? []" />
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
                :disabled="!submitReady || store.working"
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
  formatRuleDateTime,
  joinNames,
  versionSummary,
} from '@/utils/finance-rules'
import type { FinanceRulesConfig } from '@/types/finance-rules.types'
import RulesForm from './RulesForm.vue'
import RulesHistory from './RulesHistory.vue'
import WarningList from './RulesWarningList.vue'

const ALERT_TYPE = { neutral: 'info', warning: 'warning', success: 'success' } as const

const store = useFinanceRulesStore()
const overview = computed(() => store.overview)
const state = computed(() => store.stateText!)
const editing = ref<FinanceRulesConfig | null>(null)
const approveReady = ref(false)
const submitReady = ref(false)

const ownDraft = computed(() => !!overview.value?.draft && overview.value.draft.proposedBy.memberId === overview.value.me.memberId)
const editTitle = computed(() => (overview.value?.inForce ? 'Cambiar las reglas' : 'Configurar las reglas'))

const reminderNotice = computed(() => {
  const received = overview.value?.me.reminderReceivedAt
  const pending = overview.value?.pending
  if (!received || !pending || overview.value?.me.hasApproved) return ''
  return `${pending.proposedBy.name} te recordó el ${formatRuleDateTime(received)} que falta tu aprobación.`
})

const remindText = computed(() => {
  const result = store.reminders
  if (!result) return ''
  const sent = result.reminded.map((r) => r.name)
  const waiting = result.skipped.map((r) => r.name)
  const parts: string[] = []
  if (sent.length) parts.push(`Avisamos a ${joinNames(sent)}.`)
  if (waiting.length) parts.push(`A ${joinNames(waiting)} ya se le avisó hace menos de 24 horas.`)
  return parts.join(' ') || 'No falta nadie por aprobar.'
})

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
// Las casillas de "estoy de acuerdo" no se arrastran de una propuesta a otra.
watch(() => overview.value?.pending?.id, () => { approveReady.value = false })
watch(() => overview.value?.draft?.id, () => { submitReady.value = false })

function startEditing() {
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
  await store.discard(id)
}
async function approve(id: string) {
  await store.approve(id)
}
async function withdraw(id: string) {
  await store.withdraw(id)
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
.rules-panel__actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
</style>
