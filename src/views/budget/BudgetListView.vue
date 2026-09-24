<template>
  <div class="budget-list">
    <!-- Cabecera con selector de año -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">Presupuestos</h1>
        <p class="page-subtitle">Historial mensual de tu gestión financiera</p>
      </div>
      <div class="header-right">
        <!-- Selector de año -->
        <div class="year-selector">
          <button class="year-btn" @click="changeYear(-1)">◄</button>
          <span class="year-label">{{ selectedYear }}</span>
          <button class="year-btn" @click="changeYear(1)" :disabled="selectedYear >= currentYear">►</button>
        </div>
        <!-- Crear presupuesto del mes actual -->
        <AppButton variant="primary" @click="openCreateModal">
          + Nuevo presupuesto
        </AppButton>
        <!-- Ayuda contextual del listado de presupuestos -->
        <button
          type="button"
          class="btn-help"
          aria-label="Ayuda"
          title="Ayuda"
          @click="helpOpen = true"
        >?</button>
      </div>
    </div>

    <!-- Skeleton de carga — grilla de 12 tarjetas de mes -->
    <div v-if="store.loading" class="months-grid">
      <div v-for="n in 12" :key="n" class="month-card">
        <AppSkeleton variant="text" width="50%" height="13" style="margin-bottom:8px" />
        <AppSkeleton variant="text" width="70%" height="11" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="alert alert-error">{{ store.error }}</div>

    <!-- Cuadrícula de meses -->
    <div v-else class="months-grid">
      <div
        v-for="mes in mesesDelAnio"
        :key="mes.numero"
        class="month-card"
        :class="{
          'month-card--exists': mes.budget,
          'month-card--current': mes.isCurrent,
          'month-card--empty': !mes.budget
        }"
        @click="mes.budget ? goToBudget(mes.budget.id) : null"
      >
        <div class="month-card__header">
          <span class="month-name">{{ mes.nombre }}</span>
          <AppBadge v-if="mes.isCurrent" color="blue" filled>Actual</AppBadge>
          <AppBadge v-if="mes.budget" color="green" filled>Activo</AppBadge>
        </div>

        <template v-if="mes.budget">
          <div class="month-card__stats">
            <div class="stat">
              <span class="stat-label">Ingreso</span>
              <span class="stat-value stat-value--income">{{ fmt(mes.budget.totalIncome) }}</span>
            </div>
          </div>
          <div class="month-card__footer">
            <span class="card-link">Ver detalle →</span>
          </div>
        </template>

        <template v-else>
          <div class="month-card__empty">
            <span class="empty-icon">📋</span>
            <span class="empty-text">Sin presupuesto</span>
            <AppButton
              v-if="mes.isCurrent || mes.isPast"
              variant="secondary"
              size="sm"
              @click.stop="createForMonth(mes.numero)"
            >
              Crear
            </AppButton>
          </div>
        </template>
      </div>
    </div>

    <!-- Modal: crear presupuesto (molécula AppModal) -->
    <AppModal v-model="showCreateModal" title="Nuevo Presupuesto" size="sm">
      <p class="modal__desc">Selecciona el mes para el que quieres crear el presupuesto.</p>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Año</label>
          <select v-model.number="form.year" class="input">
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Mes</label>
          <select v-model.number="form.month" class="input">
            <option v-for="(m, i) in MESES" :key="i" :value="i + 1">{{ m }}</option>
          </select>
        </div>
      </div>
      <AppAlert v-if="createError" type="error" :show="!!createError">{{ createError }}</AppAlert>

      <template #footer>
        <AppButton variant="secondary" @click="closeCreateModal">Cancelar</AppButton>
        <AppButton variant="primary" :loading="creating" @click="submitCreate">Crear presupuesto</AppButton>
      </template>
    </AppModal>

    <!-- Drawer de ayuda — slug fijo: la lista no tiene sub-vistas. -->
    <AppHelpDrawer slug="primer-presupuesto" :open="helpOpen" @close="helpOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBudgetStore } from '@/stores/budget.store'
import { AppButton, AppBadge, AppModal, AppAlert, AppSkeleton, AppHelpDrawer } from '@/components'

// Estado del drawer de ayuda contextual
const helpOpen = ref(false)

const router = useRouter()
const store  = useBudgetStore()

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

// ── Año seleccionado ──────────────────────────────────────────────────
const currentYear  = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1
const selectedYear = ref(currentYear)

function changeYear(delta: number) {
  selectedYear.value += delta
}

const yearOptions = computed(() => {
  const years = []
  for (let y = currentYear; y >= currentYear - 5; y--) years.push(y)
  return years
})

// ── Meses del año con su presupuesto si existe ───────────────────────
const mesesDelAnio = computed(() =>
  MESES.map((nombre, i) => {
    const numero   = i + 1
    const budget   = store.budgets.find(
      b => b.year === selectedYear.value && b.month === numero
    ) ?? null
    return {
      numero,
      nombre,
      budget,
      isCurrent: selectedYear.value === currentYear && numero === currentMonth,
      isPast:    selectedYear.value < currentYear ||
                 (selectedYear.value === currentYear && numero < currentMonth),
    }
  })
)

// ── Navegación ────────────────────────────────────────────────────────
function goToBudget(id: string) {
  router.push({ name: 'BudgetDetail', params: { id } })
}

// ── Formateo ──────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

// ── Modal crear ───────────────────────────────────────────────────────
const showCreateModal = ref(false)
const creating        = ref(false)
const createError     = ref<string | null>(null)
const form = ref({ year: currentYear, month: currentMonth })

function openCreateModal() {
  form.value   = { year: currentYear, month: currentMonth }
  createError.value = null
  showCreateModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
}

function createForMonth(month: number) {
  form.value   = { year: selectedYear.value, month }
  createError.value = null
  showCreateModal.value = true
}

async function submitCreate() {
  creating.value    = true
  createError.value = null
  try {
    const nuevo = await store.createBudget(form.value.year, form.value.month)
    if (nuevo) {
      closeCreateModal()
      router.push({ name: 'BudgetDetail', params: { id: nuevo.id } })
    } else {
      createError.value = store.error ?? 'No se pudo crear el presupuesto'
    }
  } finally {
    creating.value = false
  }
}

// ── Carga inicial ─────────────────────────────────────────────────────
onMounted(() => store.fetchAll())
watch(selectedYear, () => store.fetchAll())
</script>

<style scoped>
.budget-list {
  padding: var(--space-lg);
  max-width: 1100px;
  margin: 0 auto;
}

/* Cabecera */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
  flex-wrap: wrap;
}
.page-title   { font-size: 1.6rem; font-weight: 700; color: var(--color-text); margin: 0; }
.page-subtitle { font-size: 0.9rem; color: var(--color-text-muted); margin: 4px 0 0; }
.header-right { display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap; }

/* Selector de año */
.year-selector {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 6px 12px;
}
.year-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 2px 6px;
  border-radius: 4px;
  transition: color .15s;
}
.year-btn:hover:not(:disabled)  { color: var(--color-primary); }
.year-btn:disabled               { opacity: .4; cursor: not-allowed; }
.year-label { font-size: 1rem; font-weight: 600; color: var(--color-text); min-width: 48px; text-align: center; }

/* Cuadrícula de meses */
.months-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-md);
}

.month-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-md);
  transition: border-color .2s, transform .15s;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-height: 140px;
}
.month-card--exists {
  cursor: pointer;
  border-color: var(--color-primary);
}
.month-card--exists:hover {
  transform: translateY(-2px);
  border-color: var(--color-success);
}
.month-card--current {
  border-color: var(--color-primary) !important;
  box-shadow: 0 0 0 2px rgba(37,99,235,.15);
}
.month-card--empty { opacity: .75; }

.month-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}
.month-name { font-size: 1rem; font-weight: 600; color: var(--color-text); }

.month-card__stats { flex: 1; }
.stat { display: flex; flex-direction: column; gap: 2px; }
.stat-label       { font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: .05em; }
.stat-value       { font-size: 1.1rem; font-weight: 600; }
.stat-value--income { color: var(--color-success); }

.month-card__footer { margin-top: auto; }
.card-link { font-size: 0.8rem; color: var(--color-primary); }

.month-card__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  color: var(--color-text-muted);
}
.empty-icon { font-size: 1.6rem; }
.empty-text { font-size: 0.8rem; }

/* Loading */
.loading-center { display: flex; justify-content: center; padding: var(--space-xl); }

/* Modal interno (form) — AppModal gestiona overlay/header/footer */
.modal__desc   { color: var(--color-text-muted); font-size: 0.88rem; margin: 0 0 var(--space-md); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label  { font-size: 0.8rem; color: var(--color-text-muted); font-weight: 500; }

@media (max-width: 640px) {
  .budget-list   { padding: var(--space-md); }
  .page-header   { flex-direction: column; }
  .header-right  { width: 100%; justify-content: space-between; }
  .months-grid   { grid-template-columns: repeat(2, 1fr); }
  .form-row      { grid-template-columns: 1fr; }
}
</style>
