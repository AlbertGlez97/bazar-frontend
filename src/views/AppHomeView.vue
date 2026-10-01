<template>
  <!-- Vista: Inicio de Modo Gestión (contenedor). Es la casa de Modo Gestión
       para CUALQUIER persona (también un colaborador: ver nav-items.ts), pero
       el resumen (`GET /dashboard/summary`) es solo para socios — por eso el
       guard vive aquí y no en el router (la ruta solo exige `requiresGestion`,
       igual que hoy; agregar `requiresSocio` ahí crearía un ciclo de
       redirección para un colaborador, cuya casa de Modo Gestión es esta
       misma pantalla). -->
  <section
    class="app-home"
    aria-labelledby="app-home-title"
  >
    <header class="app-home__header">
      <h1
        id="app-home-title"
        class="app-home__title"
      >
        {{ VOICE.dashboard.title }}
      </h1>
      <p class="app-home__lead">
        {{ VOICE.dashboard.lead }}
      </p>
    </header>

    <p
      v-if="!canSeeDashboard"
      class="app-home__not-socio"
    >
      {{ VOICE.dashboard.notSocio }}
    </p>

    <template v-else>
      <div
        v-if="status === 'loading'"
        class="app-home__skeleton"
        role="status"
      >
        <p class="app-home__loading">
          {{ VOICE.dashboard.loading }}
        </p>
        <AppSkeleton
          v-for="n in 5"
          :key="n"
          height="6.5rem"
          rounded
        />
      </div>

      <div
        v-else-if="status === 'error'"
        class="app-home__error"
      >
        <AppAlert type="error">
          {{ loadError }}
        </AppAlert>
        <AppButton
          variant="secondary"
          size="lg"
          @click="load"
        >
          {{ VOICE.dashboard.retry }}
        </AppButton>
      </div>

      <div
        v-else-if="summary"
        class="app-home__cards"
      >
        <AppStatCard
          :label="VOICE.dashboard.salesToday"
          :value="formatMinorMoney(summary.ventasHoy.totalMinor)"
          :sublabel="`${plural(summary.ventasHoy.count, 'venta', 'ventas')} · ${vsYesterday}`"
          to="/app/reportes"
        >
          <template #icon>
            <ShoppingBag />
          </template>
        </AppStatCard>

        <AppStatCard
          :label="VOICE.dashboard.profitToday"
          :value="formatMinorMoney(summary.gananciaHoyMinor)"
          tone="success"
        >
          <template #icon>
            <Coins />
          </template>
          <p
            v-if="partialProfitNote"
            class="app-home__profit-note"
          >
            {{ partialProfitNote }}
          </p>
        </AppStatCard>

        <AppStatCard
          :label="VOICE.dashboard.incidents"
          :value="String(summary.incidenciasPendientes)"
          to="/app/incidencias?resolutionStatus=pendiente"
          tone="warning"
        >
          <template #icon>
            <ClipboardList />
          </template>
        </AppStatCard>

        <AppStatCard
          :label="VOICE.dashboard.debts"
          :value="formatMinorMoney(summary.deudasPendientes.totalMinor)"
          :sublabel="VOICE.dashboard.debtsPeople(summary.deudasPendientes.personas)"
          to="/app/deudas"
          tone="info"
        >
          <template #icon>
            <Wallet />
          </template>
        </AppStatCard>

        <AppStatCard
          :label="VOICE.dashboard.lowStock"
          :value="String(summary.productosPocaExistencia.total)"
          to="/app/productos?pocaExistencia=1"
          tone="warning"
        >
          <template #icon>
            <PackageSearch />
          </template>
          <ul
            v-if="summary.productosPocaExistencia.items.length"
            class="app-home__low-stock"
          >
            <li
              v-for="item in summary.productosPocaExistencia.items"
              :key="item.id"
            >
              {{ item.name }} · {{ item.stock }}
            </li>
          </ul>
          <p
            v-else
            class="app-home__low-stock-empty"
          >
            {{ VOICE.dashboard.lowStockEmpty }}
          </p>
        </AppStatCard>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { ClipboardList, Coins, PackageSearch, ShoppingBag, Wallet } from '@lucide/vue'
import { AppAlert, AppButton, AppSkeleton, AppStatCard } from '@/components'
import { VOICE, dashboardLoadErrorMessage, dashboardPartialProfitMessage, dashboardVsYesterdayMessage } from '@/config/voice'
import DashboardService from '@/services/dashboard.service'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import { formatMinorMoney } from '@/utils/money'
import { plural } from '@/utils/sales-report'
import type { DashboardSummary } from '@/types/report.types'

const session = useSessionStore()
const uiMode = useUiModeStore()

// ── Permisos ─────────────────────────────────────────────────────────────
// Mismo par de condiciones que protege la ruta de Reportes (Gestión + socio),
// pero SIN redirigir: "Inicio" sigue siendo la casa de Modo Gestión para un
// colaborador, solo que sin números que mostrarle.
const canSeeDashboard = computed(() => uiMode.currentMode === 'gestion' && session.member?.role === 'socio')

const summary = shallowRef<DashboardSummary | null>(null)
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const loadError = ref('')
// Igual que en ReportsView: una respuesta vieja nunca pisa a una más nueva.
let loadToken = 0

async function load() {
  if (!canSeeDashboard.value) return
  const token = ++loadToken
  status.value = 'loading'
  try {
    const data = await DashboardService.getSummary()
    if (token !== loadToken) return
    summary.value = data
    status.value = 'ready'
  } catch (cause) {
    if (token !== loadToken) return
    loadError.value = dashboardLoadErrorMessage(cause)
    status.value = 'error'
  }
}

onMounted(() => {
  if (canSeeDashboard.value) load()
})

// Si el modo o la persona cambian mientras la vista está abierta (mismo
// dispositivo, otra persona; o el selector de modo), se vuelve a pedir el
// resumen al calificar, o se limpia si deja de calificar.
watch(canSeeDashboard, (can) => {
  if (can) {
    load()
  } else {
    summary.value = null
    status.value = 'idle'
  }
})

const vsYesterday = computed(() =>
  summary.value ? dashboardVsYesterdayMessage(summary.value.ventasHoy.totalMinor, summary.value.ventasAyer.totalMinor) : '',
)
const partialProfitNote = computed(() =>
  summary.value ? dashboardPartialProfitMessage(summary.value.lineasSinCostoHoy) : '',
)
</script>

<style scoped>
.app-home {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  width: 100%;
  min-width: 0;
}

.app-home__header { display: flex; flex-direction: column; gap: var(--spacing-xs); }
.app-home__title { margin: 0; font-size: var(--font-size-xl); color: var(--color-text); }
.app-home__lead { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }

.app-home__not-socio { margin: 0; color: var(--color-text-muted); }

.app-home__skeleton { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); gap: var(--spacing-md); }
.app-home__loading { grid-column: 1 / -1; }
.app-home__loading { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }

.app-home__error { display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-sm); }

.app-home__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  gap: var(--spacing-md);
}

.app-home__profit-note {
  margin: var(--spacing-xs) 0 0;
  font-size: var(--font-size-xs);
  color: var(--color-primary-hover);
}

.app-home__low-stock {
  margin: var(--spacing-xs) 0 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-sm);
  color: var(--color-primary-hover);
}
.app-home__low-stock li { padding-top: 2px; }
.app-home__low-stock-empty {
  margin: var(--spacing-xs) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-primary-hover);
}
</style>
