<template>
  <!-- Vista: "Deudas activas" (P4, solo socios, Modo Gestión). Contenedor:
       filtro de atrasadas, orden, búsqueda por nombre, paginación, y abre el
       modal de detalle (mismo patrón que Incidencias) al tocar una fila —
       nunca una ruta `:id` (no existe ninguna en este proyecto). El total
       general pendiente viene de GET /dashboard/summary (la misma fuente
       que la tarjeta "Deudas por cobrar" de Inicio), no de sumar la página
       actual, que solo trae un recorte filtrado/paginado. -->
  <section
    class="deudas-view"
    aria-labelledby="deudas-title"
  >
    <header class="deudas-view__header">
      <h1
        id="deudas-title"
        class="deudas-view__title"
      >
        {{ VOICE.deudasView.title }}
      </h1>
      <p class="deudas-view__lead">
        {{ VOICE.deudasView.lead }}
      </p>
    </header>

    <div
      v-if="totalPendingMinor !== null"
      class="deudas-view__total"
    >
      <p class="deudas-view__total-label">
        {{ VOICE.deudasView.totalPendingLabel }}
      </p>
      <p class="deudas-view__total-value">
        {{ formatMinorMoney(totalPendingMinor) }}
      </p>
      <p class="deudas-view__total-meta">
        {{ VOICE.deudasView.totalPendingPeople(totalPendingPersonas) }}
      </p>
    </div>

    <div class="deudas-view__filters">
      <AppSwitch v-model="atrasado">
        {{ VOICE.deudasView.filterAtrasadoLabel }}
      </AppSwitch>

      <AppSelect
        class="deudas-view__sort"
        :label="VOICE.deudasView.sortLabel"
        :model-value="orderBy"
        @update:model-value="onOrderByChange"
      >
        <option value="createdAt">
          {{ VOICE.deudasView.sortCreatedAt }}
        </option>
        <option value="saldoPendiente">
          {{ VOICE.deudasView.sortSaldoPendiente }}
        </option>
        <option value="cuotaVencida">
          {{ VOICE.deudasView.sortCuotaVencida }}
        </option>
      </AppSelect>

      <form
        class="deudas-view__search-form"
        @submit.prevent="applySearch"
      >
        <AppInput
          class="deudas-view__search"
          :label="VOICE.deudasView.searchLabel"
          :model-value="searchInput"
          :placeholder="VOICE.deudasView.searchPlaceholder"
          @update:model-value="searchInput = $event"
        />
        <AppButton
          type="submit"
          variant="secondary"
        >
          {{ VOICE.deudasView.searchLabel }}
        </AppButton>
      </form>
    </div>

    <div
      v-if="status === 'loading'"
      class="deudas-view__loading"
      role="status"
    >
      <p>{{ VOICE.deudasView.loading }}</p>
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
      class="deudas-view__error"
    >
      <AppAlert type="error">
        {{ loadError }}
      </AppAlert>
      <AppButton
        variant="secondary"
        @click="load()"
      >
        {{ VOICE.deudasView.retry }}
      </AppButton>
    </div>

    <p
      v-else-if="items.length === 0"
      class="deudas-view__empty"
    >
      {{ VOICE.deudasView.empty }}
    </p>

    <ul
      v-else
      class="deudas-view__list"
    >
      <li
        v-for="row in rows"
        :key="row.deuda.id"
        class="deudas-view__row"
        role="button"
        tabindex="0"
        @click="openDetail(row.deuda.id)"
        @keydown.enter="openDetail(row.deuda.id)"
      >
        <div class="deudas-view__row-main">
          <span class="deudas-view__row-name">{{ row.deuda.deudor?.nombre ?? '—' }}</span>
          <AppBadge :color="row.deuda.status === 'pendiente' ? 'amber' : 'green'">
            {{ row.deuda.status === 'pendiente' ? VOICE.deudasView.statusPendiente : VOICE.deudasView.statusSaldada }}
          </AppBadge>
          <AppBadge
            v-if="row.atrasada"
            color="red"
          >
            {{ VOICE.deudasView.atrasadaBadge }}
          </AppBadge>
        </div>
        <p class="deudas-view__row-amounts">
          {{ VOICE.deudasView.columnSaldo }}: {{ formatMinorMoney(row.pendienteMinor) }}
          · {{ VOICE.deudasView.columnTotal }}: {{ formatMinorMoney(row.deuda.totalMinor) }}
        </p>
      </li>
    </ul>

    <AppPagination
      v-if="status === 'ready'"
      :current-page="page"
      :total-pages="totalPages"
      @update:current-page="handlePageChange"
    />

    <DeudaDetailModal
      :model-value="detailOpen"
      :deuda-id="detailId"
      @update:model-value="onDetailModalChange"
      @abono-registrado="onAbonoRegistrado"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { AppAlert, AppBadge, AppButton, AppInput, AppPagination, AppSelect, AppSkeleton, AppSwitch, DeudaDetailModal } from '@/components'
import { VOICE, reportLoadErrorMessage } from '@/config/voice'
import DashboardService from '@/services/dashboard.service'
import DeudasService from '@/services/deudas.service'
import { formatMinorMoney } from '@/utils/money'
import { isDeudaAtrasada, pendienteMinorOf } from '@/utils/deuda-status'
import type { Deuda, DeudaOrderBy, DeudaSortOrder } from '@/types/deuda.types'

const atrasado = ref(false)
const orderBy = ref<DeudaOrderBy>('createdAt')
const sort: DeudaSortOrder = 'desc'
const search = ref<string | undefined>(undefined)
const searchInput = ref('')
const page = ref(1)
const limit = 20
const total = ref(0)

const items = ref<Deuda[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')
const loadError = ref('')
let loadToken = 0

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

const rows = computed(() => items.value.map((deuda) => ({
  deuda,
  pendienteMinor: pendienteMinorOf(deuda),
  atrasada: isDeudaAtrasada(deuda),
})))

async function load() {
  const token = ++loadToken
  status.value = 'loading'
  try {
    const response = await DeudasService.listDeudas({
      status: 'pendiente',
      ...(atrasado.value ? { atrasado: true } : {}),
      ...(search.value ? { search: search.value } : {}),
      orderBy: orderBy.value,
      ...(orderBy.value === 'createdAt' ? { sort } : {}),
      page: page.value,
      limit,
    })
    if (token !== loadToken) return
    items.value = response.items
    total.value = response.total
    status.value = 'ready'
  } catch (cause) {
    if (token !== loadToken) return
    loadError.value = reportLoadErrorMessage(cause)
    status.value = 'error'
  }
}

// Total general pendiente: SIEMPRE del servidor (GET /dashboard/summary, ya
// agregado sobre TODAS las deudas pendientes) — no una suma de la página
// actual, que está filtrada y paginada.
const totalPendingMinor = ref<number | null>(null)
const totalPendingPersonas = ref(0)

async function loadTotalPending() {
  try {
    const summary = await DashboardService.getSummary()
    totalPendingMinor.value = summary.deudasPendientes.totalMinor
    totalPendingPersonas.value = summary.deudasPendientes.personas
  } catch {
    // El total es un complemento informativo: si falla, la lista sigue
    // funcionando igual (mismo criterio que el resto de la app: nunca
    // bloquear una pantalla completa por un dato secundario).
  }
}

onMounted(() => {
  load()
  loadTotalPending()
})

function onOrderByChange(value: string) {
  orderBy.value = value as DeudaOrderBy
  page.value = 1
  load()
}

function applySearch() {
  search.value = searchInput.value.trim() || undefined
  page.value = 1
  load()
}

function handlePageChange(next: number) {
  page.value = next
  load()
}

// El toggle de atrasadas dispara de inmediato (no necesita un botón aparte).
watch(atrasado, () => {
  page.value = 1
  load()
})

// ── Detalle (modal, no ruta) ───────────────────────────────────────────────
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

function onAbonoRegistrado() {
  load()
  loadTotalPending()
}
</script>

<style scoped>
.deudas-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 60rem;
  min-width: 0;
}

.deudas-view__header { display: flex; flex-direction: column; gap: var(--spacing-xs); }
.deudas-view__title { margin: 0; font-size: var(--font-size-xl); color: var(--color-text); }
.deudas-view__lead { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }

.deudas-view__total {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-primary-soft);
  border-radius: var(--radius-lg);
}
.deudas-view__total-label { margin: 0; font-size: var(--font-size-sm); font-weight: 600; color: var(--color-primary-hover); }
.deudas-view__total-value {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--font-size-2xl);
  font-weight: 800;
  color: var(--color-primary-hover);
}
.deudas-view__total-meta { margin: 0; font-size: var(--font-size-sm); color: var(--color-primary-hover); }

.deudas-view__filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  align-items: flex-end;
}
.deudas-view__search-form { display: flex; gap: var(--spacing-sm); align-items: flex-end; }

.deudas-view__loading,
.deudas-view__error {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.deudas-view__empty { margin: 0; color: var(--color-text-muted); }

.deudas-view__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.deudas-view__row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
}
.deudas-view__row:hover { background: var(--color-bg); }
.deudas-view__row:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}
.deudas-view__row-main {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.deudas-view__row-name { font-weight: 700; color: var(--color-text); }
.deudas-view__row-amounts { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
</style>
