<template>
  <!-- Vista: reportes de ventas (solo socios, Modo Gestión). Contenedor: elige el
       periodo, pide los dos reportes de la API, junta el detalle de ventas SOLO
       cuando se pide un archivo y lo entrega a los exportadores (PDF / Excel, que
       cargan sus librerías en ese momento). Todo lo visual vive en componentes. -->
  <section
    class="reports-view"
    aria-labelledby="reports-title"
  >
    <header class="reports-view__header">
      <h1
        id="reports-title"
        class="reports-view__title"
      >
        {{ VOICE.reports.title }}
      </h1>
      <p class="reports-view__lead">
        {{ VOICE.reports.lead }}
      </p>
    </header>

    <ReportRangePicker
      :from="range.from"
      :to="range.to"
      :preset="selectedPreset"
      :max="today"
      :error="rangeError"
      :disabled="preparing !== null"
      @select-preset="selectPreset"
      @update:from="onFrom"
      @update:to="onTo"
      @apply="load"
    />

    <!-- Cargando: esqueleto con la forma del resultado -->
    <div
      v-if="status === 'loading'"
      class="reports-view__skeleton"
      role="status"
    >
      <p class="reports-view__loading">
        {{ VOICE.reports.loading }}
      </p>
      <AppSkeleton
        height="6.5rem"
        rounded
      />
      <AppSkeleton
        height="11rem"
        rounded
      />
    </div>

    <!-- Error: qué pasó y qué hacer, sin el texto crudo del servidor -->
    <div
      v-else-if="status === 'error'"
      class="reports-view__error"
    >
      <AppAlert type="error">
        {{ loadError }}
      </AppAlert>
      <AppButton
        variant="secondary"
        size="lg"
        @click="load"
      >
        {{ VOICE.reports.retry }}
      </AppButton>
    </div>

    <template v-else-if="loaded">
      <SalesReportSummary
        :total-minor="loaded.period.totalSoldMinor"
        :sale-count="loaded.period.saleCount"
        :range-label="rangeLabel"
        :people="people"
      />

      <AppAlert
        v-if="prepared && !prepared.consistency.ok"
        type="warning"
      >
        {{ VOICE.reports.mismatch }}
      </AppAlert>
      <AppAlert
        v-if="prepared?.truncated"
        type="warning"
      >
        {{ VOICE.reports.truncated }}
      </AppAlert>
    </template>

    <!-- Descargas: sin ventas (o sin reporte) no hay nada que bajar -->
    <div class="reports-view__downloads">
      <AppButton
        variant="primary"
        size="lg"
        :disabled="!canDownload"
        @click="download('pdf')"
      >
        {{ VOICE.reports.downloadPdf }}
      </AppButton>
      <AppButton
        variant="secondary"
        size="lg"
        :disabled="!canDownload"
        @click="download('excel')"
      >
        {{ VOICE.reports.downloadExcel }}
      </AppButton>
      <p
        v-if="preparing"
        class="reports-view__preparing"
        role="status"
      >
        {{ VOICE.reports.preparing }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AppAlert, AppButton, AppSkeleton, ReportRangePicker, SalesReportSummary } from '@/components'
import { APP_NAME } from '@/config/app'
import {
  VOICE,
  reportDownloadDoneMessage,
  reportDownloadErrorMessage,
  reportLoadErrorMessage,
  reportRangeMessage,
} from '@/config/voice'
import ReportsService from '@/services/reports.service'
import { collectSalesInRange } from '@/services/sales-report-collector'
import { downloadPdf } from '@/services/pdf-report'
import { downloadExcel } from '@/services/excel-report'
import { useSessionStore } from '@/stores/session.store'
import { useToastStore } from '@/stores/toast.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import {
  businessDayOf,
  businessToday,
  presetRange,
  validateRange,
  type RangePreset,
} from '@/utils/business-time'
import { reportFileName } from '@/utils/report-files'
import { UNKNOWN_SELLER, buildSalesReport, formatDayRange, sharePercent } from '@/utils/sales-report'
import type { SalesByMemberReport, SalesByPeriodReport, SalesReport } from '@/types/report.types'

const router = useRouter()
const session = useSessionStore()
const uiMode = useUiModeStore()
const toast = useToastStore()

// ── Permisos vivos ────────────────────────────────────────────────────────
// El guard del router ya impide entrar; aquí se vigila lo que cambia con la
// vista abierta (otro modo, otra persona en el mismo dispositivo).
watch(
  [() => uiMode.currentMode, () => session.member?.role],
  ([mode, role]) => {
    if (mode !== 'gestion' || role !== 'socio') router.replace({ name: 'AppHome' })
  },
)

// ── Periodo ───────────────────────────────────────────────────────────────
// Todo en hora de negocio (UTC-6 fijo), nunca en la del dispositivo.
const initial = presetRange('hoy')
const range = reactive({ from: initial.from, to: initial.to })
const selectedPreset = ref<RangePreset | null>('hoy')
const today = ref(businessToday())

const problem = computed(() => validateRange(range.from, range.to, today.value))
const rangeError = computed(() => (problem.value ? reportRangeMessage(problem.value) : undefined))

function selectPreset(preset: RangePreset) {
  const next = presetRange(preset)
  range.from = next.from
  range.to = next.to
  selectedPreset.value = preset
  load()
}
function onFrom(value: string) {
  range.from = value
  selectedPreset.value = null
}
function onTo(value: string) {
  range.to = value
  selectedPreset.value = null
}

// ── Reportes (totales y por persona) ──────────────────────────────────────
const loaded = shallowRef<{ period: SalesByPeriodReport; byMember: SalesByMemberReport } | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const loadError = ref('')
// Cada consulta lleva un número: si el periodo cambia mientras otra sigue en
// camino, la respuesta vieja se descarta y nunca pisa a la nueva.
let loadToken = 0

async function load() {
  today.value = businessToday()
  if (problem.value) return // rango inválido: nunca se consulta (la API respondería 200 con ceros)
  const token = ++loadToken
  status.value = 'loading'
  loaded.value = null
  prepared.value = null
  try {
    const params = { from: range.from, to: range.to }
    const [period, byMember] = await Promise.all([
      ReportsService.getSalesByPeriod(params),
      ReportsService.getSalesByMember(params),
    ])
    if (token !== loadToken) return
    loaded.value = { period, byMember }
    status.value = 'ready'
  } catch (cause) {
    if (token !== loadToken) return
    loadError.value = reportLoadErrorMessage(cause)
    status.value = 'error'
  }
}

onMounted(load)

const rangeLabel = computed(() =>
  loaded.value ? formatDayRange(businessDayOf(loaded.value.period.from), businessDayOf(loaded.value.period.to)) : '',
)

// Por persona: los del reporte de la API (fuente oficial), de mayor a menor.
const people = computed(() => {
  if (!loaded.value) return []
  const { period, byMember } = loaded.value
  return byMember.items
    .map((item) => ({
      memberId: item.memberId,
      name: item.memberName?.trim() || UNKNOWN_SELLER,
      role: item.role,
      totalMinor: item.totalSoldMinor,
      sharePercent: sharePercent(item.totalSoldMinor, period.totalSoldMinor),
    }))
    .sort((a, b) => b.totalMinor - a.totalMinor || a.name.localeCompare(b.name, 'es'))
})

// ── Descargas ─────────────────────────────────────────────────────────────
// Ver totales NO baja ventas. El detalle (GET /sales, paginado y sin filtro por
// fecha) se junta al pedir el primer archivo de un periodo y se reutiliza para el
// segundo; cambiar de periodo o actualizar lo descarta.
const preparing = ref<'pdf' | 'excel' | null>(null)
const prepared = shallowRef<SalesReport | null>(null)

const canDownload = computed(
  () => status.value === 'ready' && !!loaded.value && loaded.value.period.saleCount > 0 && preparing.value === null,
)

async function prepareReport(): Promise<SalesReport> {
  if (prepared.value) return prepared.value
  const { period, byMember } = loaded.value!
  const { sales, truncated } = await collectSalesInRange({ from: period.from, to: period.to })
  const report = buildSalesReport({
    period,
    byMember,
    sales,
    businessName: APP_NAME, // la API no expone el nombre del negocio: se usa el de la app
    generatedAt: new Date().toISOString(),
    truncated,
  })
  prepared.value = report
  return report
}

async function download(kind: 'pdf' | 'excel') {
  if (!canDownload.value) return
  preparing.value = kind
  try {
    const report = await prepareReport()
    const filename = reportFileName(
      { from: report.range.fromDay, to: report.range.toDay },
      kind === 'pdf' ? 'pdf' : 'xlsx',
    )
    await (kind === 'pdf' ? downloadPdf : downloadExcel)(report, filename)
    toast.success(reportDownloadDoneMessage(filename))
  } catch (cause) {
    toast.error(reportDownloadErrorMessage(cause))
  } finally {
    preparing.value = null
  }
}
</script>

<style scoped>
.reports-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  max-width: 60rem;
  min-width: 0;
}

.reports-view__header { display: flex; flex-direction: column; gap: var(--spacing-xs); }
.reports-view__title { margin: 0; font-size: var(--font-size-xl); color: var(--color-text); }
.reports-view__lead { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }

.reports-view__skeleton { display: flex; flex-direction: column; gap: var(--spacing-md); }
.reports-view__loading { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }

.reports-view__error { display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-sm); }

.reports-view__downloads {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}
.reports-view__downloads :deep(.app-btn) { min-height: 44px; min-width: 44px; }
.reports-view__preparing { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
</style>
