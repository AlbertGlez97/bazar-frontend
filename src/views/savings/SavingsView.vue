<template>
  <div class="savings-view">

    <!-- ── Cabecera ──────────────────────────────────────────────────────── -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Metas de ahorro</h1>
        <p class="page-subtitle">Seguimiento de tus objetivos financieros</p>
      </div>
      <div class="page-header__actions">
        <AppButton variant="primary" @click="openCreate">+ Nueva meta</AppButton>
        <!-- Ayuda contextual — abre el drawer con la guía general de la app. -->
        <button
          type="button"
          class="btn-help"
          aria-label="Ayuda"
          title="Ayuda"
          @click="helpOpen = true"
        >?</button>
      </div>
    </div>

    <!-- ── Skeleton de carga inicial ─────────────────────────────────────── -->
    <div v-if="store.loading && !store.goals.length" class="goals-grid">
      <div v-for="n in 3" :key="n" class="goal-card">
        <div class="goal-card__header">
          <AppSkeleton variant="text" width="60%" height="16" />
          <AppSkeleton variant="rect" width="52" height="20" rounded />
        </div>
        <AppSkeleton variant="circle" width="80" height="80" style="margin: 0 auto" />
        <div style="display:flex;flex-direction:column;gap:8px">
          <AppSkeleton variant="text" width="100%" height="12" />
          <AppSkeleton variant="text" width="80%"  height="12" />
          <AppSkeleton variant="text" width="90%"  height="12" />
        </div>
        <AppSkeleton variant="rect" width="100%" height="6" rounded />
        <div style="display:flex;justify-content:space-between;align-items:center">
          <AppSkeleton variant="text" width="40%" height="12" />
          <AppSkeleton variant="rect" width="90"  height="30" rounded />
        </div>
      </div>
    </div>

    <!-- ── Error de carga ───────────────────────────────────────────────── -->
    <AppAlert v-else-if="!!store.error && !store.goals.length" type="error" :show="true">
      {{ store.error }}
    </AppAlert>

    <!-- ── Empty state ─────────────────────────────────────────────────── -->
    <div v-else-if="!store.goals.length" class="empty-state">
      <span class="empty-icon">🏦</span>
      <h2 class="empty-title">Aún no tienes metas de ahorro</h2>
      <p class="empty-desc">Crea tu primera meta y empieza a trackear tu progreso.</p>
      <AppButton variant="primary" @click="openCreate">Crear primera meta</AppButton>
    </div>

    <!-- ── Grid de metas ────────────────────────────────────────────────── -->
    <div v-else class="goals-grid">
      <div
        v-for="{ goal, projection } in goalsWithProjection"
        :key="goal.id"
        class="goal-card"
        :class="{ 'goal-card--done': goal.isCompleted }"
      >
        <!-- Cabecera de la tarjeta -->
        <div class="goal-card__header">
          <div class="goal-card__title-row">
            <h3 class="goal-card__name">{{ goal.name }}</h3>
            <!-- Badge de estado: completada o en curso -->
            <AppBadge :color="goal.isCompleted ? 'green' : 'blue'" filled>
              {{ goal.isCompleted ? 'Completada' : 'En curso' }}
            </AppBadge>
          </div>
          <!-- Acciones: editar y eliminar -->
          <div class="goal-card__actions">
            <AppButton variant="ghost" size="xs" icon-only @click="openEdit(goal)" title="Editar meta">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </AppButton>
            <AppButton variant="soft-danger" size="xs" icon-only @click="confirmDelete(goal)" title="Eliminar meta">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </AppButton>
          </div>
        </div>

        <!-- Barra de progreso circular (SVG) -->
        <div class="goal-card__progress">
          <svg class="ring" width="80" height="80" viewBox="0 0 80 80">
            <!-- Pista de fondo -->
            <circle class="ring__track" cx="40" cy="40" r="32" />
            <!-- Arco de progreso -->
            <circle
              class="ring__fill"
              :class="goal.isCompleted ? 'ring__fill--done' : ''"
              cx="40" cy="40" r="32"
              :stroke-dasharray="`${goalProgress(goal) * 2.01} 201`"
            />
          </svg>
          <span class="ring__pct">{{ goalProgress(goal) }}%</span>
        </div>

        <!-- Montos -->
        <div class="goal-card__amounts">
          <div class="amount-row">
            <span class="amount-label">Acumulado</span>
            <span class="amount-val amount-val--ok">{{ fmt(goal.currentAmount) }}</span>
          </div>
          <div class="amount-row">
            <span class="amount-label">Meta</span>
            <span class="amount-val">{{ fmt(goal.targetAmount) }}</span>
          </div>
          <div class="amount-row">
            <span class="amount-label">Restante</span>
            <span class="amount-val amount-val--warn">
              {{ fmt(Math.max(0, goal.targetAmount - goal.currentAmount)) }}
            </span>
          </div>
        </div>

        <!-- Barra de progreso lineal -->
        <div class="goal-card__bar-wrap">
          <div
            class="goal-card__bar"
            :class="goal.isCompleted ? 'goal-card__bar--done' : ''"
            :style="{ width: goalProgress(goal) + '%' }"
          ></div>
        </div>

        <!-- Proyección de cierre — solo si la meta no está cumplida.
             El componente delega la regla a computeGoalProjection (espejo
             del backend) y aquí solo elige el copy según el caso. -->
        <div v-if="!projection.cumplida" class="goal-projection">
          <template v-if="projection.esAporteUnico">
            <span class="projection-icon">🎯</span>
            <span class="projection-text">
              Meta de aporte único — registra un abono cuando tengas el monto disponible.
            </span>
          </template>
          <template v-else-if="projection.mesesRestantes !== null">
            <span class="projection-icon">⏱️</span>
            <span class="projection-text">
              ≈ {{ projection.mesesRestantes }}
              {{ projection.mesesRestantes === 1 ? 'mes' : 'meses' }}
              <span class="projection-sub">
                {{ fmt(projection.aporteMensualEfectivo) }}/mes efectivos
                <template v-if="projection.fechaEstimada">
                  · llegada {{ fmtMonthYear(projection.fechaEstimada) }}
                </template>
              </span>
            </span>
          </template>
          <template v-else>
            <span class="projection-icon">💡</span>
            <span class="projection-text projection-text--muted">
              Define un monto recurrente para ver la proyección de cierre.
            </span>
          </template>
        </div>

        <!-- Footer: fecha objetivo y botón contribuir -->
        <div class="goal-card__footer">
          <div class="goal-meta">
            <span v-if="goal.targetDate" class="goal-date">
              🎯 {{ fmtDate(goal.targetDate) }}
            </span>
            <span class="goal-freq">{{ formatFreq(goal.frequency) }}</span>
          </div>
          <AppButton
            v-if="!goal.isCompleted"
            variant="primary"
            size="sm"
            @click="openContrib(goal)"
          >+ Contribuir</AppButton>
        </div>

        <!-- Nota de la meta -->
        <p v-if="goal.notes" class="goal-card__note">{{ goal.notes }}</p>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════════
         MODAL: Crear / Editar meta
    ════════════════════════════════════════════════════════════ -->
    <AppModal
      v-model="showGoalModal"
      :title="editingGoal ? 'Editar meta' : 'Nueva meta de ahorro'"
      size="md"
    >
      <div class="form-grid">
        <div class="form-group form-group--full">
          <label class="form-label">Nombre de la meta *</label>
          <input v-model="goalForm.name" class="input" placeholder="ej. Fondo de emergencia" />
        </div>
        <div class="form-group">
          <label class="form-label">Monto objetivo *</label>
          <input v-model.number="goalForm.targetAmount" type="number" min="1" step="0.01" class="input" />
        </div>
        <div class="form-group">
          <label class="form-label">Fecha límite (opcional)</label>
          <input v-model="goalForm.targetDate" type="date" class="input" />
        </div>
        <div class="form-group">
          <label class="form-label">Frecuencia de contribución</label>
          <select v-model="goalForm.frequency" class="input">
            <option value="mensual">Mensual</option>
            <option value="quincenal">Quincenal</option>
            <option value="semanal">Semanal</option>
            <option value="unico">Único</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Monto recurrente</label>
          <input v-model.number="goalForm.minimumMonthlyContribution" type="number" min="0" step="0.01" class="input" />
        </div>
        <div class="form-group form-group--full">
          <label class="form-label">Notas (opcional)</label>
          <input v-model="goalForm.notes" class="input" placeholder="Notas adicionales sobre esta meta…" />
        </div>
      </div>

      <!-- Error del formulario -->
      <AppAlert v-if="goalError" type="error" :show="!!goalError">{{ goalError }}</AppAlert>

      <template #footer>
        <AppButton variant="secondary" @click="showGoalModal = false">Cancelar</AppButton>
        <AppButton variant="primary" :loading="store.loading" @click="submitGoal">
          {{ editingGoal ? 'Guardar cambios' : 'Crear meta' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- ════════════════════════════════════════════════════════════
         MODAL: Contribución
    ════════════════════════════════════════════════════════════ -->
    <AppModal v-model="showContribModal" title="Registrar contribución" size="sm">
      <!-- Contexto de la meta seleccionada -->
      <div v-if="contribTarget" class="contrib-hint">
        <span class="hint-label">Meta:</span>
        <span class="hint-value">{{ contribTarget.name }}</span>
        <span class="hint-label">Monto recurrente sugerido:</span>
        <span class="hint-value">{{ fmt(contribTarget.minimumMonthlyContribution) }}</span>
      </div>

      <div class="form-group">
        <label class="form-label">Monto *</label>
        <input v-model.number="contribForm.amount" type="number" min="0.01" step="0.01" class="input" />
      </div>
      <div class="form-group">
        <label class="form-label">Fecha *</label>
        <input v-model="contribForm.date" type="date" class="input" />
      </div>
      <div class="form-group">
        <label class="form-label">Nota (opcional)</label>
        <input v-model="contribForm.note" class="input" placeholder="ej. Ahorro del mes de enero…" />
      </div>

      <!-- Error de contribución -->
      <AppAlert v-if="contribError" type="error" :show="!!contribError">{{ contribError }}</AppAlert>

      <template #footer>
        <AppButton variant="secondary" @click="showContribModal = false">Cancelar</AppButton>
        <AppButton variant="primary" :loading="store.loading" @click="submitContrib">
          Registrar
        </AppButton>
      </template>
    </AppModal>

    <!-- ════════════════════════════════════════════════════════════
         MODAL: Confirmar eliminación
    ════════════════════════════════════════════════════════════ -->
    <AppModal
      v-model="deleteModalOpen"
      title="Eliminar meta"
      size="sm"
      @update:model-value="onDeleteModalClose"
    >
      <p class="modal__desc">
        ¿Eliminar la meta <strong>{{ deleteTarget?.name }}</strong>? Esta acción no se puede deshacer.
      </p>
      <template #footer>
        <AppButton variant="secondary" @click="deleteModalOpen = false">Cancelar</AppButton>
        <AppButton variant="danger" :loading="store.loading" @click="executeDelete">Eliminar</AppButton>
      </template>
    </AppModal>

    <!-- Drawer de ayuda contextual — artículo específico de metas de ahorro. -->
    <AppHelpDrawer slug="metas-de-ahorro" :open="helpOpen" @close="helpOpen = false" />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSavingsStore } from '@/stores/savings.store'
import { AppButton, AppBadge, AppModal, AppAlert, AppSkeleton, AppHelpDrawer } from '@/components'
import type { SavingGoal, SavingFrequency } from '@/types/savings.types'
import { computeGoalProjection } from './savings.projection'

const store = useSavingsStore()

// ── Utilidades de formato ─────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// Para la proyección solo importa mes + año — el día concreto es ruido
// porque ceil(meses) ya redondea hacia arriba.
function fmtMonthYear(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
    month: 'short', year: 'numeric',
  })
}

const FREQ_LABELS: Record<SavingFrequency, string> = {
  mensual:   '📅 Mensual',
  quincenal: '📅 Quincenal',
  semanal:   '📅 Semanal',
  unico:     '🎯 Único',
}
const formatFreq = (f: SavingFrequency) => FREQ_LABELS[f] ?? f

// Calcula el porcentaje de progreso de una meta (0-100)
const goalProgress = computed(() => (goal: SavingGoal) => {
  if (!goal.targetAmount) return 0
  return Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
})

// Anota cada meta con su proyección calculada en cliente. Lo hacemos en
// una pasada (computed) para no recomputar al usar la proyección varias
// veces dentro del template de la card.
const goalsWithProjection = computed(() =>
  store.goals.map((goal) => ({ goal, projection: computeGoalProjection(goal) })),
)

// ── Ayuda contextual ──────────────────────────────────────────────────
// Drawer general de la app — entry-point a la guía de FinanzasApp.
const helpOpen = ref(false)

// ── Modal: Crear / Editar meta ────────────────────────────────────────
const showGoalModal = ref(false)
const editingGoal   = ref<SavingGoal | null>(null)
const goalError     = ref<string | null>(null)

const goalForm = ref({
  name:            '',
  targetAmount:    0,
  targetDate:      '',
  frequency:       'mensual' as SavingFrequency,
  minimumMonthlyContribution: 0,
  notes:           '',
})

function openCreate() {
  editingGoal.value = null
  goalForm.value = {
    name: '', targetAmount: 0, targetDate: '',
    frequency: 'mensual', minimumMonthlyContribution: 0, notes: '',
  }
  goalError.value  = null
  showGoalModal.value = true
}

function openEdit(goal: SavingGoal) {
  editingGoal.value = goal
  goalForm.value = {
    name:            goal.name,
    targetAmount:    goal.targetAmount,
    targetDate:      goal.targetDate ?? '',
    frequency:       goal.frequency,
    minimumMonthlyContribution: goal.minimumMonthlyContribution,
    notes:           goal.notes ?? '',
  }
  goalError.value  = null
  showGoalModal.value = true
}

async function submitGoal() {
  if (!goalForm.value.name.trim()) {
    goalError.value = 'El nombre de la meta es requerido.'
    return
  }
  if (!goalForm.value.targetAmount || goalForm.value.targetAmount <= 0) {
    goalError.value = 'El monto objetivo debe ser mayor a 0.'
    return
  }
  goalError.value = null
  try {
    const payload = {
      name:            goalForm.value.name.trim(),
      targetAmount:    goalForm.value.targetAmount,
      targetDate:      goalForm.value.targetDate || null,
      frequency:       goalForm.value.frequency,
      minimumMonthlyContribution: goalForm.value.minimumMonthlyContribution,
      notes:           goalForm.value.notes || null,
    }
    if (editingGoal.value) {
      await store.updateGoal(editingGoal.value.id, payload)
    } else {
      await store.createGoal(payload)
    }
    showGoalModal.value = false
  } catch {
    goalError.value = store.error ?? 'Error al guardar la meta'
  }
}

// ── Modal: Contribución ───────────────────────────────────────────────
const showContribModal = ref(false)
const contribTarget    = ref<SavingGoal | null>(null)
const contribError     = ref<string | null>(null)

const contribForm = ref({
  amount: 0,
  date:   new Date().toISOString().split('T')[0],
  note:   '',
})

function openContrib(goal: SavingGoal) {
  contribTarget.value = goal
  contribForm.value = {
    amount: goal.minimumMonthlyContribution || 0,
    date:   new Date().toISOString().split('T')[0],
    note:   '',
  }
  contribError.value    = null
  showContribModal.value = true
}

async function submitContrib() {
  if (!contribForm.value.amount || contribForm.value.amount <= 0) {
    contribError.value = 'El monto debe ser mayor a 0.'
    return
  }
  if (!contribTarget.value) return
  contribError.value = null
  try {
    await store.addContribution(contribTarget.value.id, {
      amount: contribForm.value.amount,
      date:   contribForm.value.date,
      note:   contribForm.value.note || null,
    })
    showContribModal.value = false
  } catch {
    contribError.value = store.error ?? 'Error al registrar la contribución'
  }
}

// ── Modal: Eliminar meta ──────────────────────────────────────────────
const deleteModalOpen = ref(false)
const deleteTarget    = ref<SavingGoal | null>(null)

function confirmDelete(goal: SavingGoal) {
  deleteTarget.value  = goal
  deleteModalOpen.value = true
}

function onDeleteModalClose(val: boolean) {
  // Limpia el target si se cierra el modal sin confirmar
  if (!val) deleteTarget.value = null
}

async function executeDelete() {
  if (!deleteTarget.value) return
  try {
    await store.deleteGoal(deleteTarget.value.id)
    deleteTarget.value    = null
    deleteModalOpen.value = false
  } catch {
    // El error ya está en store.error — se mostrará si es necesario
  }
}

// ── Carga inicial ─────────────────────────────────────────────────────
onMounted(() => store.fetchAll())
</script>

<style scoped>
.savings-view {
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
  margin-bottom: var(--space-lg);
  flex-wrap: wrap;
}
.page-title    { font-size: 1.4rem; font-weight: 700; color: var(--color-text); margin: 0 0 4px; }
.page-subtitle { font-size: 0.85rem; color: var(--color-text-muted); margin: 0; }
.page-header__actions { display: flex; align-items: center; gap: var(--space-sm); }

/* Estado vacío */
.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius);
}
.empty-icon  { font-size: 2.5rem; }
.empty-title { font-size: 1rem; font-weight: 600; color: var(--color-text); margin: 0; }
.empty-desc  { font-size: 0.85rem; margin: 0; }
.loading-center { display: flex; justify-content: center; padding: var(--space-xl); }

/* Grid de tarjetas */
.goals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-lg);
}

/* Tarjeta de meta */
.goal-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  transition: box-shadow .2s;
}
.goal-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.12); }
.goal-card--done { border-top: 3px solid var(--color-success); }

/* Header de la tarjeta */
.goal-card__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.goal-card__title-row { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.goal-card__name {
  font-size: 0.95rem; font-weight: 600; color: var(--color-text);
  margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.goal-card__actions { display: flex; gap: 4px; flex-shrink: 0; }

/* Anillo SVG de progreso */
.goal-card__progress {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}
.ring { transform: rotate(-90deg); }
.ring__track {
  fill: none;
  stroke: var(--color-border);
  stroke-width: 8;
}
.ring__fill {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dashoffset: 0;
  transition: stroke-dasharray .5s ease;
}
.ring__fill--done { stroke: var(--color-success); }
.ring__pct {
  position: absolute;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text);
}

/* Montos */
.goal-card__amounts { display: flex; flex-direction: column; gap: 6px; }
.amount-row { display: flex; justify-content: space-between; align-items: center; }
.amount-label { font-size: 0.78rem; color: var(--color-text-muted); }
.amount-val   { font-size: 0.88rem; font-weight: 600; color: var(--color-text); }
.amount-val--ok   { color: var(--color-success); }
.amount-val--warn { color: var(--color-primary); }

/* Barra lineal de progreso */
.goal-card__bar-wrap {
  height: 6px;
  background: var(--color-border);
  border-radius: 3px;
  overflow: hidden;
}
.goal-card__bar {
  height: 100%;
  background: var(--color-primary);
  border-radius: 3px;
  transition: width .4s;
}
.goal-card__bar--done { background: var(--color-success); }

/* Proyección de cierre */
.goal-projection {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(37, 99, 235, .06);
  border: 1px solid rgba(37, 99, 235, .15);
  border-radius: var(--radius);
  padding: 8px 10px;
  font-size: 0.78rem;
  line-height: 1.4;
}
.projection-icon { font-size: 0.95rem; flex-shrink: 0; line-height: 1.2; }
.projection-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--color-text);
  font-weight: 500;
}
.projection-text--muted { color: var(--color-text-muted); font-weight: 400; }
.projection-sub { color: var(--color-text-muted); font-size: 0.72rem; font-weight: 400; }

/* Footer de la tarjeta */
.goal-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  flex-wrap: wrap;
}
.goal-meta  { display: flex; flex-direction: column; gap: 2px; }
.goal-date  { font-size: 0.75rem; color: var(--color-text-muted); }
.goal-freq  { font-size: 0.75rem; color: var(--color-text-muted); }

/* Nota de la meta */
.goal-card__note {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  font-style: italic;
  margin: 0;
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-sm);
}

/* Formularios en modales */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}
.form-group         { display: flex; flex-direction: column; gap: 6px; }
.form-group--full   { grid-column: 1 / -1; }
.form-label         { font-size: 0.8rem; color: var(--color-text-muted); font-weight: 500; }

/* Hint de contribución */
.contrib-hint {
  background: rgba(37,99,235,.08);
  border: 1px solid rgba(37,99,235,.2);
  border-radius: var(--radius);
  padding: 10px 14px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  align-items: center;
  margin-bottom: var(--space-md);
}
.hint-label { font-size: 0.78rem; color: var(--color-text-muted); }
.hint-value { font-size: 0.88rem; font-weight: 600; color: var(--color-primary); }

/* Descripción del modal de eliminar */
.modal__desc {
  color: var(--color-text-muted);
  font-size: 0.88rem;
  margin: 0;
  line-height: 1.5;
}

@media (max-width: 640px) {
  .savings-view { padding: var(--space-md); }
  .goals-grid   { grid-template-columns: 1fr; }
  .form-grid    { grid-template-columns: 1fr; }
  .form-group--full { grid-column: 1; }
}
</style>
