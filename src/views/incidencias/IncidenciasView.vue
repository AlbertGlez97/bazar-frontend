<template>
  <!-- Vista: lista de Incidencias (P2, solo socios, Modo Gestión). Contenedor:
       filtros (tipo/estado/búsqueda/orden), paginación, y abre el modal de
       detalle+resolver (D2) al tocar una fila — nunca una ruta `:id` (no
       existe ninguna en este proyecto). El guard del router ya impide entrar
       a un colaborador; aquí se vigila lo que cambia con la vista abierta
       (mismo patrón que ReportsView/CodigosQrView). -->
  <section
    class="incidencias-view"
    aria-labelledby="incidencias-title"
  >
    <header class="incidencias-view__header">
      <h1
        id="incidencias-title"
        class="incidencias-view__title"
      >
        {{ VOICE.incidencias.title }}
      </h1>
      <p class="incidencias-view__lead">
        {{ VOICE.incidencias.lead }}
      </p>
    </header>

    <div class="incidencias-view__filters">
      <AppSelect
        class="incidencias-view__filter-type"
        :label="VOICE.incidencias.filterTypeLabel"
        :model-value="type ?? ''"
        @update:model-value="onTypeChange"
      >
        <option value="">
          {{ VOICE.incidencias.filterTypeAll }}
        </option>
        <option value="conflicto_stock">
          {{ VOICE.incidencias.typeConflictoStock }}
        </option>
        <option value="incidencia_fecha">
          {{ VOICE.incidencias.typeIncidenciaFecha }}
        </option>
      </AppSelect>

      <AppSelect
        class="incidencias-view__filter-status"
        :label="VOICE.incidencias.filterStatusLabel"
        :model-value="resolutionStatus ?? ''"
        @update:model-value="onStatusChange"
      >
        <option value="">
          {{ VOICE.incidencias.filterStatusAll }}
        </option>
        <option value="pendiente">
          {{ VOICE.incidencias.statusPendiente }}
        </option>
        <option value="resuelta">
          {{ VOICE.incidencias.statusResuelta }}
        </option>
      </AppSelect>

      <form
        class="incidencias-view__search-form"
        @submit.prevent="applySearch"
      >
        <AppInput
          class="incidencias-view__search"
          :label="VOICE.incidencias.searchLabel"
          :model-value="searchInput"
          :placeholder="VOICE.incidencias.searchPlaceholder"
          @update:model-value="searchInput = $event"
        />
        <AppButton
          type="submit"
          variant="secondary"
        >
          {{ VOICE.incidencias.searchLabel }}
        </AppButton>
      </form>

      <AppSelect
        class="incidencias-view__sort"
        :label="VOICE.incidencias.sortLabel"
        :model-value="sort"
        @update:model-value="onSortChange"
      >
        <option value="desc">
          {{ VOICE.incidencias.sortDesc }}
        </option>
        <option value="asc">
          {{ VOICE.incidencias.sortAsc }}
        </option>
      </AppSelect>
    </div>

    <div
      v-if="status === 'loading'"
      class="incidencias-view__loading"
      role="status"
    >
      <p>{{ VOICE.incidencias.loading }}</p>
      <AppSkeleton
        height="4.5rem"
        rounded
      />
      <AppSkeleton
        height="4.5rem"
        rounded
      />
    </div>

    <div
      v-else-if="status === 'error'"
      class="incidencias-view__error"
    >
      <AppAlert type="error">
        {{ loadError }}
      </AppAlert>
      <AppButton
        variant="secondary"
        @click="load()"
      >
        {{ VOICE.incidencias.retry }}
      </AppButton>
    </div>

    <p
      v-else-if="items.length === 0"
      class="incidencias-view__empty"
    >
      {{ VOICE.incidencias.empty }}
    </p>

    <ul
      v-else
      class="incidencias-view__list"
    >
      <li
        v-for="incidencia in items"
        :key="incidencia.id"
        class="incidencias-view__row"
        role="button"
        tabindex="0"
        @click="openDetail(incidencia.id)"
        @keydown.enter="openDetail(incidencia.id)"
      >
        <div class="incidencias-view__row-main">
          <AppBadge :color="incidencia.type === 'conflicto_stock' ? 'amber' : 'blue'">
            {{ typeLabel(incidencia.type) }}
          </AppBadge>
          <AppBadge :color="incidencia.resolutionStatus === 'pendiente' ? 'amber' : 'green'">
            {{ statusLabel(incidencia.resolutionStatus) }}
          </AppBadge>
          <span class="incidencias-view__row-date">{{ formatDate(incidencia.detectedAt) }}</span>
        </div>
        <p class="incidencias-view__row-reason">
          {{ incidencia.reason }}
        </p>
      </li>
    </ul>

    <AppPagination
      v-if="status === 'ready'"
      :current-page="page"
      :total-pages="totalPages"
      @update:current-page="handlePageChange"
    />

    <IncidenciaDetailModal
      :model-value="detailOpen"
      :incidencia-id="detailId"
      @update:model-value="onDetailModalChange"
      @resolved="onResolved"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AppAlert, AppBadge, AppButton, AppInput, AppPagination, AppSelect, AppSkeleton, IncidenciaDetailModal } from '@/components'
import { VOICE, incidenciaLoadErrorMessage } from '@/config/voice'
import IncidenciasService from '@/services/incidencias.service'
import { useSessionStore } from '@/stores/session.store'
import { useToastStore } from '@/stores/toast.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import type { Incidencia, IncidenciaResolutionStatus, IncidenciaSortOrder, IncidenciaType } from '@/types/incidencia.types'

const router = useRouter()
const session = useSessionStore()
const uiMode = useUiModeStore()
const toast = useToastStore()
// `useRoute()` sin router instalado da `undefined` en varios tests que montan
// la vista sola: se lee con `?.`, nunca se asume presente (mismo patrón que
// ProductCatalogView con `pocaExistencia`).
const route = useRoute()

// ── Permisos vivos ────────────────────────────────────────────────────────
// El guard del router ya impide entrar; aquí se vigila lo que cambia con la
// vista abierta (otro modo, otra persona en el mismo dispositivo) — mismo
// patrón que ReportsView/CodigosQrView.
watch(
  [() => uiMode.currentMode, () => session.member?.role],
  ([mode, role]) => {
    if (mode !== 'gestion' || role !== 'socio') router.replace({ name: 'AppHome' })
  },
)

// ── Filtros y paginación ──────────────────────────────────────────────────
// `resolutionStatus` es el mismo nombre del query de la API: la tarjeta
// "Incidencias pendientes" del Inicio navega con `?resolutionStatus=pendiente`
// (mismo patrón que "pocaExistencia" estableció en P1 para Productos).
const QUERY_STATUS = 'resolutionStatus'

const type = ref<IncidenciaType | undefined>(undefined)
const resolutionStatus = ref<IncidenciaResolutionStatus | undefined>(undefined)
const search = ref<string | undefined>(undefined)
const searchInput = ref('')
const sort = ref<IncidenciaSortOrder>('desc')
const page = ref(1)
const limit = 20
const total = ref(0)

const items = ref<Incidencia[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')
const loadError = ref('')
let loadToken = 0

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

async function load() {
  const token = ++loadToken
  status.value = 'loading'
  try {
    const response = await IncidenciasService.listIncidencias({
      ...(type.value ? { type: type.value } : {}),
      ...(resolutionStatus.value ? { resolutionStatus: resolutionStatus.value } : {}),
      ...(search.value ? { search: search.value } : {}),
      sort: sort.value,
      page: page.value,
      limit,
    })
    if (token !== loadToken) return
    items.value = response.items
    total.value = response.total
    status.value = 'ready'
  } catch (cause) {
    if (token !== loadToken) return
    loadError.value = incidenciaLoadErrorMessage(cause)
    status.value = 'error'
  }
}

onMounted(() => {
  const initialStatus = route?.query[QUERY_STATUS]
  if (initialStatus === 'pendiente' || initialStatus === 'resuelta') resolutionStatus.value = initialStatus
  load()
})

function onTypeChange(value: string) {
  type.value = (value || undefined) as IncidenciaType | undefined
  page.value = 1
  load()
}

function onStatusChange(value: string) {
  resolutionStatus.value = (value || undefined) as IncidenciaResolutionStatus | undefined
  page.value = 1
  load()
}

function applySearch() {
  search.value = searchInput.value.trim() || undefined
  page.value = 1
  load()
}

function onSortChange(value: string) {
  sort.value = value as IncidenciaSortOrder
  load()
}

function handlePageChange(next: number) {
  page.value = next
  load()
}

function typeLabel(t: IncidenciaType): string {
  return t === 'conflicto_stock' ? VOICE.incidencias.typeConflictoStock : VOICE.incidencias.typeIncidenciaFecha
}
function statusLabel(s: IncidenciaResolutionStatus): string {
  return s === 'pendiente' ? VOICE.incidencias.statusPendiente : VOICE.incidencias.statusResuelta
}
function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

// ── Detalle + resolver (D2: modal, no ruta) ───────────────────────────────
const detailOpen = ref(false)
const detailId = ref<string | null>(null)

function openDetail(id: string) {
  detailId.value = id
  detailOpen.value = true
}

function onDetailModalChange(open: boolean) {
  detailOpen.value = open
  if (!open) detailId.value = null
}

function onResolved(incidencia: Incidencia) {
  toast.success(`Incidencia resuelta: ${incidencia.reason}`)
  load()
}
</script>

<style scoped>
.incidencias-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 60rem;
  min-width: 0;
}

.incidencias-view__header { display: flex; flex-direction: column; gap: var(--spacing-xs); }
.incidencias-view__title { margin: 0; font-size: var(--font-size-xl); color: var(--color-text); }
.incidencias-view__lead { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }

.incidencias-view__filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  align-items: flex-end;
}
.incidencias-view__search-form {
  display: flex;
  gap: var(--spacing-sm);
  align-items: flex-end;
}

.incidencias-view__loading,
.incidencias-view__error {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.incidencias-view__empty { margin: 0; color: var(--color-text-muted); }

.incidencias-view__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.incidencias-view__row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
}
.incidencias-view__row:hover { background: var(--color-bg); }
.incidencias-view__row:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}
.incidencias-view__row-main {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.incidencias-view__row-date { margin-left: auto; font-size: var(--font-size-sm); color: var(--color-text-muted); }
.incidencias-view__row-reason { margin: 0; font-size: var(--font-size-sm); color: var(--color-text); }
</style>
