<template>
  <div class="debt-detail">

    <!-- Cabecera -->
    <div class="page-header">
      <div class="header-left">
        <!-- Botón volver a la lista de deudas -->
        <AppButton variant="ghost" size="sm" @click="router.push({ name: 'Debts' })">← Deudas</AppButton>
        <div v-if="store.current">
          <h1 class="page-title">{{ store.current.name }}</h1>
          <div class="header-meta">
            <!-- Badge de estado usando el componente atómico -->
            <AppBadge
              :color="store.current.status === 'active' ? 'blue' : store.current.status === 'paid' ? 'green' : 'amber'"
              filled
            >{{ formatStatus(store.current.status) }}</AppBadge>
            <span class="rate-chip">{{ store.current.annualInterestRate }}% anual</span>
            <span class="method-chip">{{ formatMethod(store.current.method) }}</span>
          </div>
        </div>
      </div>
      <!-- Botón registrar pago principal + ayuda contextual -->
      <div v-if="store.current" class="page-header__actions">
        <AppButton variant="primary" @click="openPaymentModal">
          💳 Registrar pago
        </AppButton>
        <button
          type="button"
          class="btn-help"
          aria-label="Ayuda"
          title="Ayuda"
          @click="helpOpen = true"
        >?</button>
      </div>
    </div>

    <!-- Loading inicial -->
    <div v-if="store.loading && !store.current" class="loading-center">
      <div class="spinner"></div>
    </div>
    <!-- Error de carga -->
    <AppAlert v-else-if="!!store.error && !store.current" type="error" :show="true">
      {{ store.error }}
    </AppAlert>

    <template v-else-if="store.current">

      <!-- ── Métricas de contexto ─────────────────────────────────────── -->
      <div class="metrics-row">
        <div class="metric-card metric-card--initial">
          <span class="metric-label">Deuda inicial</span>
          <span class="metric-value">{{ fmt(store.current.initialAmount) }}</span>
        </div>
        <div class="metric-card metric-card--paid">
          <span class="metric-label">Abonado a capital</span>
          <span class="metric-value metric-value--ok">{{ fmt(paidAmount) }}</span>
          <span class="metric-sublabel">de {{ fmt(store.current.initialAmount) }} originales</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Pago mínimo/mes</span>
          <span class="metric-value">{{ fmt(store.current.minimumPayment) }}</span>
        </div>
        <div class="metric-card metric-card--progress">
          <span class="metric-label">Progreso <strong class="pct-label">{{ progress }}%</strong></span>
          <div class="metric-progress-wrap">
            <div class="metric-progress-bar" :style="{ width: progress + '%' }" :class="progressClass"></div>
          </div>
          <span class="metric-sublabel">{{ fmt(Number(store.current.remainingBalance)) }} de capital restante</span>
        </div>
      </div>

      <!-- ── Alerta: interés moratorio ─────────────────────────────────── -->
      <div v-if="store.current.isOverdue" class="overdue-alert">
        <span class="overdue-alert__icon">🚨</span>
        <div class="overdue-alert__body">
          <strong>Pago vencido</strong> — superaste el día límite ({{ store.current.paymentDueDay }}) sin registrar un abono.
          <span v-if="store.current.lateInterestAmount" class="overdue-alert__amount">
            Interés moratorio: +{{ fmt(store.current.lateInterestAmount) }}
          </span>
        </div>
      </div>

      <!-- ── Proyección financiera ─────────────────────────────────────── -->
      <div class="projection-header">
        <span class="projection-title">📊 Estado de liquidación</span>
      </div>
      <div class="projection-row">

        <!-- Card 1: Saldo de Capital — deuda real después de abonos -->
        <div class="projection-card projection-card--capital">
          <span class="projection-label">Saldo de Capital</span>
          <span class="projection-value">{{ fmt(Number(store.current.remainingBalance)) }}</span>
          <span class="projection-detail">
            {{ fmt(store.current.initialAmount) }} − {{ fmt(paidAmount) }} pagado
          </span>
        </div>

        <!-- Card 2: Costo por Pagar — proyección informativa, no se suma al total -->
        <div class="projection-card projection-card--interest">
          <span class="projection-label">
            Costo por Pagar
            <span class="projection-label-badge">proyección</span>
          </span>
          <span class="projection-value projection-value--interest">
            <template v-if="store.amortization.length">{{ fmt(totalAmortizationInterest) }}</template>
            <span v-else class="projection-skeleton">––</span>
          </span>
          <span class="projection-detail">
            intereses totales si pagas el mínimo cada mes
          </span>
        </div>

        <!-- Card 3: Estimado para liquidar — cuánto debes si cierras la deuda HOY.
             El título y el tooltip son explícitos: es una APROXIMACIÓN. El banco
             cobra interés por días exactos desde el último corte, no por mes
             completo, así que el monto oficial puede diferir. -->
        <div class="projection-card projection-card--total" :class="{ 'projection-card--overdue': store.current.isOverdue }">
          <span class="projection-label">
            Estimado para liquidar hoy
            <AppTooltip text="Cifra estimada. El banco calcula los intereses por días exactos desde tu último corte, no por mes completo, por lo que el monto real puede diferir ligeramente. Para el saldo oficial de liquidación, contacta a tu banco." learn-more-slug="desglose-pago" />
          </span>
          <span class="projection-value projection-value--total">{{ fmt(totalParaLiquidar) }}</span>

          <!-- Desglose explícito — ayuda al usuario a entender de dónde sale el total -->
          <div v-if="currentMonthInterest > 0 || store.current.lateInterestAmount" class="liquidation-breakdown">
            <div class="lb-row">
              <span class="lb-label">Capital restante</span>
              <span class="lb-value">{{ fmt(Number(store.current.remainingBalance)) }}</span>
            </div>
            <div v-if="currentMonthInterest > 0" class="lb-row">
              <span class="lb-label">
                + Interés devengado del mes
                <AppTooltip text="Interés que se fue acumulando desde el inicio del mes hasta hoy. Se calcula como (capital × tasa anual / 12). Si cancelas hoy, el banco te lo cobra." learn-more-slug="tasa-anual-vs-mensual" />
              </span>
              <span class="lb-value">{{ fmt(currentMonthInterest) }}</span>
            </div>
            <!-- Línea de IVA sobre intereses — solo visible cuando la deuda
                 tiene ivaRate > 0 (FlexPlan / créditos con IVA s/intereses). -->
            <div v-if="currentMonthIVA > 0" class="lb-row">
              <span class="lb-label">
                + IVA sobre interés
                <AppTooltip text="Algunos créditos cobran IVA sobre los intereses generados cada mes. Se calcula como interés × IVA. Aparece solo si tu deuda tiene IVA configurado." />
              </span>
              <span class="lb-value">{{ fmt(currentMonthIVA) }}</span>
            </div>
            <div v-if="store.current.isOverdue && store.current.lateInterestAmount" class="lb-row lb-row--warn">
              <span class="lb-label">
                + Interés moratorio
                <AppTooltip text="Cargo extra por tener pagos vencidos. Aparece solo si el sistema detecta que pasaste la fecha de pago sin abonar." />
              </span>
              <span class="lb-value">{{ fmt(store.current.lateInterestAmount) }}</span>
            </div>
            <div class="lb-row lb-row--total">
              <span class="lb-label">Total estimado HOY</span>
              <span class="lb-value">{{ fmt(totalParaLiquidar) }}</span>
            </div>
          </div>
          <span v-else class="projection-detail">sin intereses (tasa 0%)</span>
        </div>

      </div>

      <!-- ── Configuración de fechas de pago ──────────────────────────── -->
      <div class="dates-config">
        <div class="dates-config__header" @click="showDatesConfig = !showDatesConfig">
          <span class="dates-config__title">⚙️ Configuración de fechas de pago</span>
          <span class="dates-config__toggle">{{ showDatesConfig ? '▲' : '▼' }}</span>
        </div>
        <div v-if="showDatesConfig" class="dates-config__body">
          <div class="dates-form-row">
            <div class="form-group">
              <label class="form-label">Día de corte</label>
              <input v-model.number="datesForm.cutoffDay" type="number" min="1" max="31" class="input" placeholder="ej. 15" />
              <span class="form-hint">Día del mes en que cierra tu ciclo</span>
            </div>
            <div class="form-group">
              <label class="form-label">Fecha límite de pago</label>
              <input v-model.number="datesForm.paymentDueDay" type="number" min="1" max="31" class="input" placeholder="ej. 25" />
              <span class="form-hint">Día límite para pagar sin moratoria</span>
            </div>
            <div class="form-group">
              <label class="form-label">Interés moratorio (%/mes)</label>
              <input v-model.number="datesForm.lateInterestRate" type="number" min="0" max="100" step="0.1" class="input" placeholder="ej. 3.5" />
              <span class="form-hint">Tasa mensual si no pagas a tiempo</span>
            </div>
          </div>
          <div class="dates-config__footer">
            <AppAlert v-if="datesError" type="error" :show="true">{{ datesError }}</AppAlert>
            <AppButton variant="primary" size="sm" :loading="savingDates" @click="saveDatesConfig">
              Guardar configuración
            </AppButton>
          </div>
        </div>
      </div>

      <!-- ── Tabs ──────────────────────────────────────────────────── -->
      <!-- Se mantienen como raw buttons por su estilo especial de tab activa -->
      <div class="tabs">
        <button class="tab-btn" :class="{ 'tab-btn--active': tab === 'pagos' }" @click="tab = 'pagos'">
          Historial de pagos <span class="tab-count">{{ store.payments.length }}</span>
        </button>
        <button class="tab-btn" :class="{ 'tab-btn--active': tab === 'amortizacion' }" @click="goToAmortization">
          Tabla de amortización <span class="tab-count">{{ store.amortization.length }}</span>
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════════
           TAB 1 — Historial de pagos
      ══════════════════════════════════════════════════════════ -->
      <div v-if="tab === 'pagos'">
        <div class="panel-header">
          <h2 class="panel-title">Pagos realizados</h2>
          <!-- Botón secundario de registrar pago en el panel -->
          <AppButton variant="primary" size="sm" @click="openPaymentModal">+ Registrar pago</AppButton>
        </div>

        <div v-if="!store.payments.length" class="empty-state">
          <span class="empty-icon">💳</span>
          <p>Aún no hay pagos registrados para esta deuda.</p>
          <AppButton variant="primary" @click="openPaymentModal">Registrar primer pago</AppButton>
        </div>

        <div v-else class="data-table">
          <div class="table-head payments-cols">
            <span>Fecha</span>
            <span>Monto pagado</span>
            <span>Capital</span>
            <span>Interés</span>
            <span>Saldo después</span>
            <span>Nota</span>
            <span>Acciones</span>
          </div>
          <div
            v-for="pay in store.payments"
            :key="pay.id"
            class="table-row payments-cols"
            :class="{ 'row--paid': pay.isPaid }"
          >
            <span class="row-date">{{ fmtDate(pay.paymentDate) }}</span>
            <span class="row-amount row-amount--pay">{{ fmt(pay.actualAmount) }}</span>
            <span class="row-amount">{{ fmt(pay.capitalPaid) }}</span>
            <span class="row-amount row-amount--interest">{{ fmt(pay.interestPaid) }}</span>
            <span class="row-amount">{{ fmt(pay.balanceAfterPayment) }}</span>
            <span class="row-note">{{ pay.note || '—' }}</span>
            <span class="row-actions">
              <AppButton variant="ghost" size="sm" class="action-btn--edit" title="Modificar pago" @click="openEditModal(pay)">✏️</AppButton>
              <AppButton variant="ghost" size="sm" class="action-btn--delete" title="Eliminar pago" @click="openDeleteModal(pay)">🗑️</AppButton>
            </span>
          </div>

          <!-- Footer: salida de efectivo vs costo en intereses -->
          <div class="table-footer">
            <div class="footer-block footer-block--cash">
              <span class="footer-label">💸 Salida de efectivo</span>
              <span class="footer-value footer-value--cash">{{ fmt(totalPaid) }}</span>
              <span class="footer-detail">{{ fmt(totalCapital) }} capital + {{ fmt(totalInterest) }} interés</span>
            </div>
            <div class="footer-block footer-block--interest">
              <span class="footer-label">📈 Costo en intereses</span>
              <span class="footer-value footer-value--interest">{{ fmt(totalInterest) }}</span>
              <span class="footer-detail">{{ totalPaid ? ((totalInterest / totalPaid) * 100).toFixed(1) : 0 }}% del total pagado</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════
           TAB 2 — Tabla de amortización
      ══════════════════════════════════════════════════════════ -->
      <div v-if="tab === 'amortizacion'">
        <div class="panel-header">
          <h2 class="panel-title">Amortización proyectada</h2>
          <span class="panel-note">Proyección basada en pago mínimo mensual de {{ fmt(store.current.minimumPayment) }}</span>
        </div>

        <!-- Banner de tasa variable: la proyección se calcula con la tasa
             actual registrada, pero si el banco la mueve los números reales
             cambian. Se muestra antes del contenido (incluso durante loading)
             porque la advertencia aplica a la deuda en sí, no al estado de
             carga de la tabla. Si rateLastUpdated existe se muestra la fecha
             del último cambio de tasa para dar contexto de qué tan vigente es. -->
        <div v-if="store.current.rateType === 'variable'" class="rate-warning">
          <div class="rate-warning__icon">⚠️</div>
          <div class="rate-warning__body">
            <h4 class="rate-warning__title">Tasa variable — proyección referencial</h4>
            <p class="rate-warning__text">
              Esta deuda tiene tasa variable. La proyección se calcula con la tasa registrada
              actualmente (<strong>{{ store.current.annualInterestRate }}% anual</strong>),
              pero si tu banco la modifica, los números reales van a cambiar.
            </p>
            <p v-if="store.current.rateLastUpdated" class="rate-warning__updated">
              Última edición de la tasa: <strong>{{ fmtRateUpdated(store.current.rateLastUpdated) }}</strong>
            </p>
            <p v-else class="rate-warning__updated">
              Aún no has actualizado la tasa desde que diste de alta esta deuda.
            </p>
          </div>
        </div>

        <div v-if="store.loading" class="loading-center">
          <div class="spinner"></div>
        </div>

        <div v-else-if="!store.amortization.length" class="empty-state">
          <span class="empty-icon">📈</span>
          <p>No se pudo generar la proyección de amortización.</p>
        </div>

        <div v-else>
          <!-- Info resumen de amortización -->
          <div class="amort-summary" :class="{ 'amort-summary--flex': isFlexPlan }">
            <div class="as-item">
              <span class="as-label">Total cuotas</span>
              <span class="as-val">{{ store.amortization.length }} meses</span>
            </div>
            <div class="as-item">
              <span class="as-label">Fecha estimada liquidación</span>
              <span class="as-val as-val--date">{{ estimatedPayoffDate }}</span>
            </div>
            <div class="as-item">
              <span class="as-label">Total intereses a pagar</span>
              <span class="as-val as-val--interest">{{ fmt(totalAmortizationInterest) }}</span>
            </div>
            <div v-if="isFlexPlan" class="as-item">
              <span class="as-label">Total IVA</span>
              <span class="as-val as-val--iva">{{ fmt(store.amortizationMeta?.totalIVA ?? 0) }}</span>
            </div>
            <div class="as-item">
              <span class="as-label">{{ isFlexPlan ? 'Total a pagar (con IVA)' : 'Total a pagar' }}</span>
              <span class="as-val">{{ fmt(isFlexPlan ? (store.amortizationMeta?.totalPagadoConIVA ?? 0) : totalAmortizationPayment) }}</span>
            </div>
          </div>

          <!-- Tabla — en caso de amortización negativa mostramos solo 1 fila.
               En modo FlexPlan se renderizan dos columnas extra (IVA + Pago c/IVA). -->
          <div class="data-table">
            <div class="table-head" :class="isFlexPlan ? 'amort-cols-flex' : 'amort-cols'">
              <span>Mes</span>
              <span>Pago esperado</span>
              <span>Capital</span>
              <span>Interés</span>
              <template v-if="isFlexPlan">
                <span>IVA</span>
              </template>
              <span>Saldo restante</span>
              <template v-if="isFlexPlan">
                <span>Pago c/IVA</span>
              </template>
            </div>
            <div
              v-for="row in visibleAmortization"
              :key="row.mes"
              class="table-row"
              :class="[
                isFlexPlan ? 'amort-cols-flex' : 'amort-cols',
                { 'row--last': row.mes === store.amortization.length },
              ]"
            >
              <span class="row-month"># {{ row.mes }}</span>
              <span class="row-amount">{{ fmt(row.pagoEsperado) }}</span>
              <span class="row-amount row-amount--capital">{{ fmt(row.capital) }}</span>
              <span class="row-amount row-amount--interest">{{ fmt(row.interes) }}</span>
              <template v-if="isFlexPlan">
                <span class="row-amount row-amount--iva">{{ fmt(row.iva) }}</span>
              </template>
              <span class="row-amount">{{ fmt(row.saldoRestante) }}</span>
              <template v-if="isFlexPlan">
                <span class="row-amount row-amount--total">{{ fmt(row.pagoTotal) }}</span>
              </template>
            </div>
          </div>

          <!-- Banner de amortización negativa: pago < interés del primer mes.
               Con este esquema la deuda NUNCA se liquida y de hecho crece. -->
          <div v-if="store.amortizationMeta?.isNegativeAmortization" class="amort-warning">
            <div class="amort-warning__icon">⚠️</div>
            <div class="amort-warning__body">
              <h4 class="amort-warning__title">Atención — Amortización negativa</h4>
              <p class="amort-warning__text">
                El pago mensual configurado (<strong>{{ fmt(store.amortizationMeta.pagoEsperado) }}</strong>)
                no cubre ni siquiera los intereses generados este mes
                (<strong>{{ fmt(store.amortizationMeta.interesPrimerMes) }}</strong>).
                Con este esquema, <strong>tu deuda crecerá cada mes y nunca se liquidará</strong>.
              </p>
              <p class="amort-warning__action">
                👉 Subí el pago mínimo por encima de
                <strong>{{ fmt(store.amortizationMeta.interesPrimerMes) }}</strong>
                para que la deuda empiece a amortizarse.
              </p>
            </div>
          </div>

          <!-- Botón mostrar más filas de amortización — oculto si hay amortización negativa -->
          <div
            v-if="!store.amortizationMeta?.isNegativeAmortization && store.amortization.length > amortLimit"
            class="show-more"
          >
            <AppButton variant="secondary" size="sm" @click="amortLimit += 24">
              Mostrar más ({{ store.amortization.length - amortLimit }} restantes)
            </AppButton>
          </div>
        </div>
      </div>

    </template>

    <!-- ════════════════════════════════════════════════════════════
         MODAL: Registrar pago — AppModal gestiona overlay/header/footer
    ════════════════════════════════════════════════════════════ -->
    <AppModal v-model="showPayment" title="Registrar pago">
      <!-- Hint del pago mínimo sugerido -->
      <div class="payment-hint" v-if="store.current">
        <span class="hint-label">Pago mínimo sugerido:</span>
        <span class="hint-value">{{ fmt(store.current.minimumPayment) }}</span>
      </div>

      <!-- Se usan inputs nativos para mantener v-model.number -->
      <div class="form-group">
        <label class="form-label">Monto pagado *</label>
        <input v-model.number="payForm.actualAmount" type="number" min="0.01" step="0.01" class="input" />
      </div>
      <div class="form-group">
        <label class="form-label">Fecha del pago *</label>
        <input v-model="payForm.paymentDate" type="date" class="input" />
      </div>
      <div class="form-group">
        <label class="form-label">Nota (opcional)</label>
        <input v-model="payForm.note" class="input" placeholder="ej. Abono extra de quincena…" />
      </div>

      <!-- Error del formulario de pago -->
      <AppAlert v-if="payError" type="error" :show="!!payError">{{ payError }}</AppAlert>

      <!-- Footer con acciones del modal -->
      <template #footer>
        <AppButton variant="secondary" @click="showPayment = false">Cancelar</AppButton>
        <AppButton variant="primary" :loading="paying" :disabled="paying" @click="submitPayment">
          Registrar
        </AppButton>
      </template>
    </AppModal>

    <!-- ════════════════════════════════════════════════════════════
         MODAL: Confirmar eliminación de pago
    ════════════════════════════════════════════════════════════ -->
    <AppModal v-model="showDeleteModal" title="Eliminar pago">
      <p class="modal-confirm-text">
        ¿Estás seguro de que deseas eliminar este pago permanentemente?
        <strong>Esta acción no se puede deshacer.</strong>
      </p>
      <template #footer>
        <AppButton variant="secondary" @click="showDeleteModal = false">Cancelar</AppButton>
        <AppButton variant="danger" :loading="deletingPayment" @click="confirmDeletePayment">
          Sí, eliminar
        </AppButton>
      </template>
    </AppModal>

    <!-- ════════════════════════════════════════════════════════════
         MODAL: Editar pago existente
    ════════════════════════════════════════════════════════════ -->
    <AppModal v-model="showEditModal" title="Modificar pago">
      <div class="form-group">
        <label class="form-label">Monto pagado *</label>
        <input v-model.number="editForm.actualAmount" type="number" min="0.01" step="0.01" class="input" />
      </div>
      <div class="form-group">
        <label class="form-label">Fecha del pago *</label>
        <input v-model="editForm.paymentDate" type="date" class="input" />
      </div>
      <div class="form-group">
        <label class="form-label">Nota (opcional)</label>
        <input v-model="editForm.note" class="input" placeholder="ej. Abono extra de quincena…" />
      </div>
      <AppAlert v-if="editError" type="error" :show="!!editError">{{ editError }}</AppAlert>
      <template #footer>
        <AppButton variant="secondary" @click="showEditModal = false">Cancelar</AppButton>
        <AppButton variant="primary" :loading="savingEdit" @click="confirmEditPayment">
          Guardar cambios
        </AppButton>
      </template>
    </AppModal>

    <!-- Drawer de ayuda contextual: tab Historial → cómo registrar un pago,
         tab Amortización → artículo conceptual de capital vs interés. -->
    <AppHelpDrawer :slug="helpSlug" :open="helpOpen" @close="helpOpen = false" />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDebtsStore } from '@/stores/debts.store'
import { useToastStore } from '@/stores/toast.store'
import { AppButton, AppBadge, AppModal, AppAlert, AppTooltip, AppHelpDrawer } from '@/components'
import type { DebtPayment } from '@/types/debt.types'

const route  = useRoute()
const router = useRouter()
const store  = useDebtsStore()

// ── Tabs ──────────────────────────────────────────────────────────────
const tab = ref<'pagos' | 'amortizacion'>('pagos')

// ── Ayuda contextual ──────────────────────────────────────────────────
// Slug dinámico: en el historial mostramos el tutorial de registrar pago,
// en la amortización abrimos el artículo conceptual sobre capital vs
// interés (que da el contexto teórico para entender la tabla).
const helpOpen = ref(false)
const helpSlug = computed(() =>
  tab.value === 'amortizacion' ? 'capital-vs-interes' : 'registrar-pago'
)

async function goToAmortization() {
  tab.value = 'amortizacion'
  if (!store.amortization.length && store.current) {
    await store.fetchAmortization(store.current.id)
  }
}

// ── Límite de filas de amortización visibles ──────────────────────────
const amortLimit = ref(24) // Muestra primeros 24 meses por defecto
const visibleAmortization = computed(() =>
  store.amortization.slice(0, amortLimit.value)
)

// ── Computed de la deuda activa ───────────────────────────────────────
const paidAmount = computed(() => {
  if (!store.current) return 0
  return Math.max(0, Number(store.current.initialAmount) - Number(store.current.remainingBalance))
})

const progress = computed(() => {
  const inicial = Number(store.current?.initialAmount ?? 0)
  if (!inicial) return 0
  return Math.round((paidAmount.value / inicial) * 100)
})

const progressClass = computed(() => {
  if (progress.value >= 80) return 'bar--great'
  if (progress.value >= 40) return 'bar--mid'
  return 'bar--low'
})

// ── Totales del historial de pagos ────────────────────────────────────
const totalPaid = computed(() =>
  store.payments.reduce((s, p) => s + Number(p.actualAmount), 0)
)
const totalCapital = computed(() =>
  store.payments.reduce((s, p) => s + Number(p.capitalPaid), 0)
)
const totalInterest = computed(() =>
  store.payments.reduce((s, p) => s + Number(p.interestPaid), 0)
)

// ── Totales de amortización ───────────────────────────────────────────
const totalAmortizationInterest = computed(() =>
  store.amortization.reduce((s, r) => s + Number(r.interes), 0)
)

// ── Modo FlexPlan: el backend lo señala vía amortizationMeta.mode ──────
const isFlexPlan = computed(() => store.amortizationMeta?.mode === 'flexplan')

// ── Proyección financiera ─────────────────────────────────────────────
// Interés devengado del mes en curso: lo que se cargaría si pagas hoy
const currentMonthInterest = computed(() => {
  if (!store.current) return 0
  const tasa = Number(store.current.annualInterestRate) / 100 / 12
  return +(Number(store.current.remainingBalance) * tasa).toFixed(2)
})

// IVA sobre el interés devengado — solo aplica cuando el contrato tiene
// ivaRate > 0 (típico de productos bancarios mexicanos tipo FlexPlan).
// El cálculo es: interés del mes × (ivaRate / 100). Si ivaRate es null/0,
// la cifra es 0 y la fila se oculta en el desglose.
const currentMonthIVA = computed(() => {
  if (!store.current) return 0
  const iva = Number(store.current.ivaRate ?? 0)
  if (iva <= 0) return 0
  return +(currentMonthInterest.value * (iva / 100)).toFixed(2)
})

// Saldo real de liquidación: lo que debes si cierras la deuda hoy mismo
// = saldo actual + interés devengado este mes + IVA sobre ese interés
//   (cuando aplica) + moratorio (si la deuda está vencida).
// Los intereses futuros proyectados (amortización) son informativos y NO se suman.
const totalParaLiquidar = computed(() =>
  Number(store.current?.remainingBalance ?? 0)
  + currentMonthInterest.value
  + currentMonthIVA.value
  + Number(store.current?.lateInterestAmount ?? 0)
)
const totalAmortizationPayment = computed(() =>
  store.amortization.reduce((s, r) => s + Number(r.pagoEsperado), 0)
)
const estimatedPayoffDate = computed(() => {
  const n = store.amortization.length
  if (!n) return '—'
  const d = new Date()
  d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
})

// ── Formateo ──────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// Formato del timestamp completo de rateLastUpdated (ISO con hora). A
// diferencia de fmtDate (que recibe YYYY-MM-DD y le agrega T12:00:00),
// el backend devuelve un ISO completo — Date lo parsea directo. Mostramos
// solo el día, mes y año porque la hora exacta no aporta a la advertencia.
function fmtRateUpdated(isoTs: string): string {
  return new Date(isoTs).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function formatStatus(s: string): string {
  return ({ active: 'Activa', paid: 'Liquidada', paused: 'Pausada' } as Record<string,string>)[s] ?? s
}

function formatMethod(m: string): string {
  return ({
    snowball:  '❄️ Bola de nieve',
    avalanche: '🌊 Avalancha',
    fireball:  '🔥 Fireball',
    snowflake: '❄ Snowflake',
  } as Record<string,string>)[m] ?? m
}

// ── Modal: registrar pago ─────────────────────────────────────────────
const showPayment = ref(false)
const paying      = ref(false)
const payError    = ref<string | null>(null)
const payForm     = ref({
  // Number() garantiza tipo numérico aunque la API devuelva el valor como string
  actualAmount: Number(store.current?.minimumPayment ?? 0),
  paymentDate:  new Date().toISOString().split('T')[0],
  note:         '',
})

function openPaymentModal() {
  payForm.value = {
    actualAmount: Number(store.current?.minimumPayment ?? 0),
    paymentDate:  new Date().toISOString().split('T')[0],
    note:         '',
  }
  payError.value = null
  showPayment.value = true
}

async function submitPayment() {
  // Fuerza conversión a número — TypeORM puede devolver decimales como strings
  const monto = Number(payForm.value.actualAmount)
  if (!monto || monto <= 0) {
    payError.value = 'El monto del pago debe ser mayor a 0.'
    return
  }
  paying.value   = true
  payError.value = null
  try {
    await store.registerPayment(route.params.id as string, {
      actualAmount: monto,
      paymentDate:  payForm.value.paymentDate,
      // Envía undefined en lugar de null para que class-validator lo trate como opcional
      note:         payForm.value.note || undefined,
    })
    showPayment.value = false
    // Si ya se habían cargado, refresca la amortización (el saldo cambió)
    if (store.amortization.length) {
      await store.fetchAmortization(route.params.id as string)
    }
  } catch {
    payError.value = store.error ?? 'Error al registrar el pago'
  } finally {
    paying.value = false
  }
}

// ── Modal: eliminar pago ──────────────────────────────────────────────
const showDeleteModal  = ref(false)
const deletingPayment  = ref(false)
const paymentToDelete  = ref<DebtPayment | null>(null)

function openDeleteModal(pay: DebtPayment) {
  paymentToDelete.value = pay
  showDeleteModal.value = true
}

async function confirmDeletePayment() {
  if (!paymentToDelete.value || !store.current) return
  deletingPayment.value = true
  try {
    await store.removePayment(store.current.id, paymentToDelete.value.id)
    showDeleteModal.value = false
    if (store.amortization.length) await store.fetchAmortization(store.current.id)
  } catch {
    // El error ya lo maneja el store
  } finally {
    deletingPayment.value  = false
    paymentToDelete.value  = null
  }
}

// ── Modal: editar pago ────────────────────────────────────────────────
const showEditModal   = ref(false)
const savingEdit      = ref(false)
const editError       = ref<string | null>(null)
const paymentToEdit   = ref<DebtPayment | null>(null)
const editForm        = ref({ actualAmount: 0, paymentDate: '', note: '' })

function openEditModal(pay: DebtPayment) {
  paymentToEdit.value = pay
  editForm.value = {
    actualAmount: Number(pay.actualAmount),
    paymentDate:  String(pay.paymentDate).slice(0, 10),
    note:         pay.note ?? '',
  }
  editError.value   = null
  showEditModal.value = true
}

async function confirmEditPayment() {
  if (!paymentToEdit.value || !store.current) return
  const monto = Number(editForm.value.actualAmount)
  if (!monto || monto <= 0) {
    editError.value = 'El monto debe ser mayor a 0.'
    return
  }
  savingEdit.value = true
  editError.value  = null
  try {
    await store.updatePayment(store.current.id, paymentToEdit.value.id, {
      actualAmount: monto,
      paymentDate:  editForm.value.paymentDate,
      note:         editForm.value.note || undefined,
    })
    showEditModal.value = false
    if (store.amortization.length) await store.fetchAmortization(store.current.id)
  } catch {
    editError.value = store.error ?? 'Error al actualizar el pago'
  } finally {
    savingEdit.value    = false
    paymentToEdit.value = null
  }
}

// ── Configuración de fechas de pago ──────────────────────────────────
const showDatesConfig = ref(false)
const savingDates     = ref(false)
const datesError      = ref<string | null>(null)
const datesForm       = ref({ cutoffDay: null as number | null, paymentDueDay: null as number | null, lateInterestRate: null as number | null })

async function saveDatesConfig() {
  datesError.value  = null
  savingDates.value = true
  try {
    await store.updateDebt(route.params.id as string, {
      cutoffDay:       datesForm.value.cutoffDay      ?? undefined,
      paymentDueDay:   datesForm.value.paymentDueDay  ?? undefined,
      lateInterestRate: datesForm.value.lateInterestRate ?? undefined,
    } as any)
    // Re-fetch para obtener isOverdue/lateInterestAmount recalculados
    await store.fetchOne(route.params.id as string)
    useToastStore().success('Configuración de fechas guardada')
  } catch {
    datesError.value = store.error ?? 'Error al guardar la configuración'
  } finally {
    savingDates.value = false
  }
}

// ── Carga inicial ─────────────────────────────────────────────────────
onMounted(async () => {
  const id = route.params.id as string
  await store.fetchOne(id)
  // Inicializa el formulario de fechas con los valores existentes
  if (store.current) {
    datesForm.value = {
      cutoffDay:        store.current.cutoffDay,
      paymentDueDay:    store.current.paymentDueDay,
      lateInterestRate: store.current.lateInterestRate,
    }
  }
  await Promise.all([
    store.fetchPayments(id),
    store.fetchAmortization(id),  // eager: necesario para la proyección financiera
  ])
})

onUnmounted(() => store.clearCurrent())
</script>

<style scoped>
.debt-detail {
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
.header-left { display: flex; align-items: flex-start; gap: var(--space-sm); }
/* Cluster de CTA principal + ayuda contextual en la derecha del header. */
.page-header__actions { display: flex; align-items: center; gap: var(--space-sm); }
/* .back-btn → AppButton variant="ghost" */
.page-title   { font-size: 1.4rem; font-weight: 700; color: var(--color-text); margin: 0 0 6px; }
.header-meta  { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }

/* .status-badge → AppBadge */
.rate-chip, .method-chip {
  font-size: 0.75rem; color: var(--color-text-muted);
  background: var(--color-border); border-radius: 6px; padding: 3px 8px;
}

/* Métricas */
.metrics-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}
.metric-card {
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius); padding: var(--space-md);
  display: flex; flex-direction: column; gap: 6px;
}
.metric-card--initial   { border-top: 3px solid var(--color-border); }
.metric-card--paid      { border-top: 3px solid var(--color-success); }
.metric-card--remaining { border-top: 3px solid var(--color-danger); }
.metric-card--progress  { border-top: 3px solid var(--color-primary); }

.metric-label     { font-size: 0.72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-muted); display: flex; justify-content: space-between; align-items: center; }
.pct-label        { font-size: 0.85rem; font-weight: 700; color: var(--color-primary); }
.metric-value     { font-size: 1.15rem; font-weight: 700; color: var(--color-text); }
.metric-value--ok   { color: var(--color-success); }
.metric-value--debt { color: var(--color-danger); }
.metric-sublabel  { font-size: 0.72rem; color: var(--color-text-muted); }

.metric-progress-wrap { height: 6px; background: var(--color-border); border-radius: 3px; overflow: hidden; }
.metric-progress-bar  { height: 100%; border-radius: 3px; transition: width .4s; }
.bar--great { background: var(--color-success); }
.bar--mid   { background: #eab308; }
.bar--low   { background: var(--color-primary); }

/* Tabs — se mantienen raw por estilo activo con border-bottom */
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--color-border); margin-bottom: var(--space-lg); }
.tab-btn {
  background: none; border: none; color: var(--color-text-muted); font-size: 0.85rem;
  padding: 10px 16px; cursor: pointer; border-bottom: 2px solid transparent;
  display: flex; align-items: center; gap: 6px; transition: color .15s, border-color .15s;
}
.tab-btn:hover    { color: var(--color-text); }
.tab-btn--active  { color: var(--color-primary); border-bottom-color: var(--color-primary); }
.tab-count { background: var(--color-border); color: var(--color-text-muted); font-size: 0.68rem; border-radius: 10px; padding: 1px 6px; }
.tab-btn--active .tab-count { background: rgba(37,99,235,.2); color: var(--color-primary); }

/* Panel header */
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: var(--space-md); flex-wrap: wrap; gap: var(--space-sm);
}
.panel-title { font-size: 1rem; font-weight: 600; color: var(--color-text); margin: 0; }
.panel-note  { font-size: 0.8rem; color: var(--color-text-muted); }

/* Tabla de datos */
.data-table { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); overflow: hidden; }

.payments-cols   { grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1.5fr 80px !important; }
.amort-cols      { grid-template-columns: 0.6fr 1fr 1fr 1fr 1fr !important; }
/* FlexPlan: + columnas IVA y Pago c/IVA */
.amort-cols-flex { grid-template-columns: 0.5fr 1fr 1fr 1fr 0.85fr 1fr 1fr !important; }

.table-head {
  display: grid; padding: 10px var(--space-md);
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-muted);
  background: rgba(255,255,255,.03); border-bottom: 1px solid var(--color-border);
}
.table-row {
  display: grid; padding: 10px var(--space-md);
  border-bottom: 1px solid var(--color-border); font-size: 0.85rem;
  align-items: center; transition: background .15s;
}
.table-row:last-child  { border-bottom: none; }
.table-row:hover       { background: rgba(255,255,255,.02); }
.table-total {
  display: grid; padding: 10px var(--space-md);
  font-weight: 600; font-size: 0.88rem;
  background: rgba(255,255,255,.03); border-top: 1px solid var(--color-border);
}
.row--paid { opacity: .65; }
.row--last { background: rgba(16,185,129,.05); }

.row-date      { color: var(--color-text-muted); font-size: 0.8rem; }
.row-month     { color: var(--color-text-muted); font-size: 0.82rem; font-weight: 600; }
.row-amount    { font-size: 0.88rem; color: var(--color-text); }
.row-amount--pay      { color: var(--color-success); font-weight: 600; }
.row-amount--capital  { color: var(--color-primary); }
.row-amount--interest { color: var(--color-danger); }
.row-amount--iva      { color: #eab308; }
.row-amount--total    { color: #7c3aed; font-weight: 600; }
.row-note      { font-size: 0.78rem; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.total-value   { color: var(--color-primary); }
.total-value--interest { color: var(--color-danger); }

/* Columna Acciones — AppButton ghost sm con hover diferenciado por tipo */
.row-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

/* Aplica sobre el AppButton renderizado (hereda clase externa por inheritAttrs) */
.action-btn--edit,
.action-btn--delete {
  opacity: 0.55;
  transition: opacity 0.15s, transform 0.1s, background 0.15s;
  font-size: 0.9rem;
}

.action-btn--edit:hover,
.action-btn--delete:hover {
  opacity: 1;
  transform: scale(1.12);
}

.action-btn--edit:hover  { background: rgba(37, 99, 235, 0.12) !important; }
.action-btn--delete:hover { background: rgba(239, 68, 68, 0.12) !important; }

/* Texto del modal de confirmación */
.modal-confirm-text {
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0 0 var(--space-md);
}

.modal-confirm-text strong { color: var(--color-text); }

/* Resumen de amortización */
.amort-summary {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md); margin-bottom: var(--space-md);
}
/* En modo FlexPlan agregamos una 5a card (IVA) — pasa a 5 columnas */
.amort-summary--flex { grid-template-columns: repeat(5, 1fr); }
.as-item    { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: var(--space-md); display: flex; flex-direction: column; gap: 4px; }
.as-label   { font-size: 0.72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-muted); }
.as-val     { font-size: 1rem; font-weight: 600; color: var(--color-text); }
.as-val--date     { color: var(--color-primary); }
.as-val--interest { color: var(--color-danger); }
.as-val--iva      { color: #eab308; }

/* Show more */
.show-more { text-align: center; padding: var(--space-md); border-top: 1px solid var(--color-border); }

/* ── Banner de amortización negativa ────────────────────────────────────
   Aparece cuando el pago mínimo no cubre ni el interés del primer mes.
   Tono rojo/naranja para forzar la atención del usuario: es un problema
   real que si no corrige, la deuda NO se liquida nunca. */
.amort-warning {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin-top: var(--space-md);
  padding: 18px 20px;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(234, 88, 12, 0.12));
  border: 1.5px solid rgba(234, 88, 12, 0.4);
  border-left: 4px solid #ea580c;
  border-radius: var(--radius-md, 10px);
}
.amort-warning__icon {
  font-size: 1.75rem;
  line-height: 1;
  flex-shrink: 0;
}
.amort-warning__body { flex: 1; min-width: 0; }
.amort-warning__title {
  font-size: 1rem;
  font-weight: 700;
  color: #c2410c;
  margin: 0 0 8px;
}
.amort-warning__text {
  font-size: 0.9rem;
  color: var(--color-text);
  line-height: 1.55;
  margin: 0 0 10px;
}
.amort-warning__action {
  font-size: 0.88rem;
  color: var(--color-text);
  background: rgba(234, 88, 12, 0.08);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  margin: 0;
  line-height: 1.4;
}
@media (max-width: 640px) {
  .amort-warning { flex-direction: column; gap: 10px; padding: 14px 16px; }
  .amort-warning__icon { font-size: 1.4rem; }
}

/* Banner de tasa variable — tono ámbar, advertencia leve.
   Distinto de .amort-warning (que es rojo y crítico): aquí no hay un error
   ni una proyección rota, solo se le avisa al usuario que la tasa puede
   moverse sin que él lo registre y que sus números pueden quedar viejos. */
.rate-warning {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin: 0 0 var(--space-md);
  padding: 16px 18px;
  background: rgba(234, 179, 8, .12);
  border: 1px solid rgba(234, 179, 8, .4);
  border-left: 4px solid #eab308;
  border-radius: var(--radius-md, 10px);
}
.rate-warning__icon {
  font-size: 1.5rem;
  line-height: 1;
  flex-shrink: 0;
}
.rate-warning__body {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 6px;
}
.rate-warning__title {
  font-size: 0.98rem;
  font-weight: 700;
  color: #b45309;
  margin: 0;
}
.rate-warning__text {
  font-size: 0.88rem;
  color: var(--color-text);
  line-height: 1.5;
  margin: 0;
}
.rate-warning__updated {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin: 4px 0 0;
}
@media (max-width: 640px) {
  .rate-warning      { flex-direction: column; gap: 10px; padding: 14px 16px; }
  .rate-warning__icon { font-size: 1.3rem; }
}

/* Empty */
.empty-state {
  text-align: center; padding: var(--space-xl); color: var(--color-text-muted);
  display: flex; flex-direction: column; align-items: center; gap: var(--space-sm);
  background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: var(--radius);
}
.empty-icon { font-size: 2rem; }
.loading-center { display: flex; justify-content: center; padding: var(--space-xl); }
/* .btn-sm → AppButton size="sm" */

/* Modal → AppModal gestiona overlay/header/footer */
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 0.8rem; color: var(--color-text-muted); font-weight: 500; }

.payment-hint {
  background: rgba(37,99,235,.08); border: 1px solid rgba(37,99,235,.2);
  border-radius: var(--radius); padding: 10px 14px;
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: var(--space-md);
}
.hint-label { font-size: 0.8rem; color: var(--color-text-muted); }
.hint-value { font-size: 0.95rem; font-weight: 600; color: var(--color-primary); }

/* ── Alerta moratoria ───────────────────────────────────────────────── */
.overdue-alert {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-start;
  background: rgba(239, 68, 68, .1);
  border: 1px solid rgba(239, 68, 68, .4);
  border-left: 4px solid var(--color-danger);
  border-radius: var(--radius);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
  font-size: 0.88rem;
  color: var(--color-text);
}
.overdue-alert__icon { font-size: 1.1rem; flex-shrink: 0; }
.overdue-alert__body { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.overdue-alert__amount {
  background: rgba(239, 68, 68, .15);
  color: var(--color-danger);
  font-weight: 700;
  border-radius: 4px;
  padding: 2px 8px;
}

/* ── Configuración de fechas de pago ────────────────────────────────── */
.dates-config {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  margin-bottom: var(--space-lg);
  overflow: hidden;
}
.dates-config__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px var(--space-md);
  cursor: pointer;
  user-select: none;
  transition: background .15s;
}
.dates-config__header:hover { background: rgba(255,255,255,.03); }
.dates-config__title  { font-size: 0.82rem; font-weight: 600; color: var(--color-text-muted); }
.dates-config__toggle { font-size: 0.65rem; color: var(--color-text-muted); }

.dates-config__body { padding: var(--space-md); border-top: 1px solid var(--color-border); }
.dates-form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}
.form-hint { font-size: 0.7rem; color: var(--color-text-muted); }
.dates-config__footer { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-sm); }

/* Card de proyección cuando la deuda está vencida */
.projection-card--overdue { border-top-color: var(--color-danger) !important; }
.projection-detail--overdue { color: var(--color-danger); font-weight: 600; }

/* ── Proyección financiera ──────────────────────────────────────────── */
.projection-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}
.projection-title {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--color-text-muted);
  font-weight: 600;
}
.projection-loading {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  opacity: .7;
}

.projection-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.projection-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.projection-card--capital  { border-top: 3px solid var(--color-primary); }
.projection-card--interest { border-top: 3px solid var(--color-danger); }
.projection-card--total    { border-top: 3px solid #7c3aed; }

.projection-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.projection-label-badge {
  font-size: 0.62rem;
  background: rgba(239, 68, 68, .12);
  color: var(--color-danger);
  border-radius: 4px;
  padding: 1px 5px;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 600;
}
.projection-value {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text);
}
.projection-value--interest { color: var(--color-danger); }
.projection-value--total    { color: #7c3aed; }
.projection-detail {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}
.projection-skeleton {
  opacity: .4;
  font-size: 1rem;
}

/* ── Desglose del Total para Liquidar ─────────────────────────────────── */
.liquidation-breakdown {
  margin-top: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: rgba(124, 58, 237, 0.06);
  border: 1px solid rgba(124, 58, 237, 0.15);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  font-size: 0.8rem;
}
.lb-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-sm);
}
.lb-row--warn { color: var(--color-danger); }
.lb-row--total {
  border-top: 1px dashed rgba(124, 58, 237, 0.3);
  padding-top: 6px;
  font-weight: 700;
  color: #7c3aed;
}
.lb-label { color: var(--color-text-muted); display: inline-flex; align-items: center; gap: 4px; }
.lb-row--total .lb-label { color: inherit; }
.lb-value { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--color-text); }
.lb-row--total .lb-value { color: #7c3aed; }

/* ── Footer de pagos realizados ─────────────────────────────────────── */
.table-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid var(--color-border);
  background: rgba(255,255,255,.03);
}
.footer-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-md);
}
.footer-block--cash    { border-right: 1px solid var(--color-border); }
.footer-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--color-text-muted);
  font-weight: 600;
}
.footer-value {
  font-size: 1.1rem;
  font-weight: 700;
}
.footer-value--cash     { color: var(--color-success); }
.footer-value--interest { color: var(--color-danger); }
.footer-detail {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

@media (max-width: 900px) {
  .metrics-row         { grid-template-columns: repeat(2, 1fr); }
  .amort-summary       { grid-template-columns: repeat(2, 1fr); }
  .amort-summary--flex { grid-template-columns: repeat(2, 1fr); }
  .projection-row      { grid-template-columns: repeat(2, 1fr); }
  .dates-form-row      { grid-template-columns: 1fr 1fr; }
  /* En FlexPlan compactamos a 4 columnas: ocultamos IVA y Pago c/IVA en pantallas medias */
  .amort-cols-flex { grid-template-columns: 0.6fr 1fr 1fr 1fr 1fr !important; }
  .amort-cols-flex span:nth-child(5),
  .amort-cols-flex span:nth-child(7) { display: none; }
}
@media (max-width: 640px) {
  .debt-detail    { padding: var(--space-md); }
  .metrics-row    { grid-template-columns: 1fr 1fr; }
  .projection-row { grid-template-columns: 1fr; }
  .dates-form-row { grid-template-columns: 1fr; }
  .payments-cols  { grid-template-columns: 1fr 1fr 1fr 60px !important; }
  .payments-cols .row-amount--capital,
  .payments-cols .row-amount--interest,
  .payments-cols .row-note { display: none; }
  .amort-cols { grid-template-columns: 0.6fr 1fr 1fr !important; }
  .amort-cols span:nth-child(3),
  .amort-cols span:nth-child(4) { display: none; }
  /* FlexPlan en mobile: solo Mes / Pago / Saldo (capital, interés, IVA, pagoTotal ocultos) */
  .amort-cols-flex { grid-template-columns: 0.6fr 1fr 1fr !important; }
  .amort-cols-flex span:nth-child(3),
  .amort-cols-flex span:nth-child(4),
  .amort-cols-flex span:nth-child(5),
  .amort-cols-flex span:nth-child(7) { display: none; }
}
</style>
