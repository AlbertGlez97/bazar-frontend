<template>
  <!-- Vista: Mi equipo (solo socios). Contenedor: pide la lista (incluidas las
       personas desactivadas), abre el alta en un cuadro y decide qué mostrar según
       lo que responde POST /members. El guard del router ya impide entrar a un
       colaborador; aquí se vigila si el rol cambia con la vista abierta. -->
  <section
    class="team-view"
    aria-labelledby="team-title"
  >
    <RouterLink
      to="/app/ajustes"
      class="team-view__back"
    >
      ← Volver a ajustes
    </RouterLink>

    <header class="team-view__header">
      <div>
        <h1
          id="team-title"
          class="team-view__title"
        >
          {{ VOICE.team.title }}
        </h1>
        <p class="team-view__lead">
          {{ VOICE.team.lead }}
        </p>
      </div>
      <AppButton
        variant="primary"
        size="lg"
        @click="openForm"
      >
        {{ VOICE.team.add }}
      </AppButton>
    </header>

    <!-- Confirmación del alta: qué pasó y adónde fue el correo -->
    <MemberCreatedNotice
      v-if="notice"
      :created="notice.created"
      :correo="notice.correo"
      @dismiss="notice = null"
    />

    <!-- Cargando: esqueleto con la forma del resultado -->
    <div
      v-if="status === 'loading'"
      class="team-view__loading"
      role="status"
    >
      <p>{{ VOICE.team.loading }}</p>
      <AppSkeleton
        height="3.5rem"
        rounded
      />
      <AppSkeleton
        height="3.5rem"
        rounded
      />
    </div>

    <!-- Error: qué pasó y qué hacer, sin el texto crudo del servidor -->
    <div
      v-else-if="status === 'error'"
      class="team-view__error"
    >
      <AppAlert type="error">
        {{ loadError }}
      </AppAlert>
      <AppButton
        variant="secondary"
        size="lg"
        @click="load()"
      >
        {{ VOICE.team.retry }}
      </AppButton>
    </div>

    <TeamMemberList
      v-else
      :members="members"
      :current-member-id="session.memberId"
    />

    <AppModal
      :model-value="showForm"
      :title="VOICE.team.add"
      size="md"
      hide-footer
      :close-on-backdrop="!saving"
      @update:model-value="onModalChange"
    >
      <MemberCreateForm
        :loading="saving"
        :server-errors="serverErrors"
        :error="formError"
        @submit="createMember"
        @cancel="onModalChange(false)"
      />
    </AppModal>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  AppAlert, AppButton, AppModal, AppSkeleton, MemberCreateForm, MemberCreatedNotice, TeamMemberList,
} from '@/components'
import { VOICE, createMemberError, type CreateMemberField } from '@/config/voice'
import MembersService from '@/services/members.service'
import { useSessionStore } from '@/stores/session.store'
import type { CreatedMember, CreateMemberPayload, Member } from '@/types/member.types'

const router = useRouter()
const session = useSessionStore()

// ── Permisos vivos ────────────────────────────────────────────────────────
// El guard del router ya impide entrar; aquí se vigila lo que cambia con la
// vista abierta (otra persona elige su nombre en el mismo dispositivo).
watch(
  () => session.member?.role,
  (role) => {
    if (role !== 'socio') router.replace({ name: 'AppHome' })
  },
)

// ── Lista ─────────────────────────────────────────────────────────────────
const members = ref<Member[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')
const loadError = ref('')
// Cada consulta lleva un número: si otra empieza mientras una sigue en camino, la
// respuesta vieja se descarta y nunca pisa a la nueva.
let loadToken = 0

async function load() {
  const token = ++loadToken
  // Recargar tras un alta no vuelve a poner el esqueleto: la lista sigue a la vista.
  if (!members.value.length) status.value = 'loading'
  try {
    const result = await MembersService.list({ includeInactive: true })
    if (token !== loadToken) return
    members.value = result
    status.value = 'ready'
  } catch (cause) {
    if (token !== loadToken) return
    loadError.value = loadFailureMessage(cause)
    status.value = 'error'
  }
}

function loadFailureMessage(cause: unknown): string {
  const failure = cause as { response?: { status?: number } } | null
  if (!failure?.response) return VOICE.networkError
  return failure.response.status === 403 ? VOICE.team.forbidden : VOICE.team.loadError
}

load()

// ── Alta ──────────────────────────────────────────────────────────────────
const showForm = ref(false)
const saving = ref(false)
const formError = ref<string | null>(null)
const serverErrors = ref<Partial<Record<CreateMemberField, string>>>({})
const notice = ref<{ created: CreatedMember; correo: string } | null>(null)

function openForm() {
  // El formulario se destruye al cerrar el cuadro: cada alta empieza vacía.
  formError.value = null
  serverErrors.value = {}
  notice.value = null
  showForm.value = true
}

// Mientras se envía no se puede cerrar el cuadro (Escape, fondo, "Cancelar"):
// el resultado llega de todos modos y conviene verlo.
function onModalChange(open: boolean) {
  if (!open && saving.value) return
  showForm.value = open
}

async function createMember(payload: CreateMemberPayload) {
  if (saving.value) return
  saving.value = true
  formError.value = null
  serverErrors.value = {}
  try {
    const created = await MembersService.create(payload)
    showForm.value = false
    notice.value = { created, correo: payload.correo }
    await load()
  } catch (cause) {
    const failure = createMemberError(cause)
    serverErrors.value = failure.fields
    formError.value = failure.message
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.team-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 44rem;
}

.team-view__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-md);
}
.team-view__title { font-size: var(--font-size-xl); margin: 0; }
.team-view__lead { color: var(--color-text-muted); margin: var(--spacing-xs) 0 0; }

.team-view__loading,
.team-view__error {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  align-items: flex-start;
}
.team-view__loading { align-items: stretch; }

/* "Volver": objetivo táctil de 44 px */
.team-view__back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: none;
}
.team-view__back:hover { text-decoration: underline; }
.team-view__back:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}
</style>
