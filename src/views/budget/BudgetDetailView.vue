<template>
  <div class="budget-detail">

    <!-- Banner de estado degradado: visible cuando el cifrado no está activo -->
    <AppAlert v-if="store.degraded" type="warning">
      {{ BANNER_DEGRADED_COPY }}
    </AppAlert>

    <!-- Cabecera -->
    <div class="page-header">
      <div class="header-left">
        <AppButton variant="ghost" size="sm" @click="router.push({ name: 'BudgetList' })">← Presupuestos</AppButton>
        <h1 class="page-title" v-if="store.current">
          {{ MESES[store.current.month - 1] }} {{ store.current.year }}
        </h1>
      </div>
      <div class="header-right" v-if="store.current">
        <div class="balance-chip" :class="store.disponible >= 0 ? 'balance-chip--ok' : 'balance-chip--deficit'">
          {{ store.disponible >= 0 ? 'Disponible' : 'Déficit' }}:
          <strong>{{ fmt(Math.abs(store.disponible)) }}</strong>
        </div>
        <!-- Ayuda contextual: el slug cambia según el tab activo. -->
        <button
          type="button"
          class="btn-help"
          aria-label="Ayuda"
          title="Ayuda"
          @click="helpOpen = true"
        >?</button>
      </div>
    </div>

    <!-- Spinner de carga inicial -->
    <div v-if="store.loading && !store.current" class="loading-center">
      <div class="spinner"></div>
    </div>

    <!-- Error -->
    <div v-else-if="store.error && !store.current" class="alert alert-error">{{ store.error }}</div>

    <template v-else-if="store.current">
      <!-- Métricas rápidas — clic activa el tab correspondiente -->
      <div class="metrics-row">
        <div class="metric-card metric-card--clickable" @click="activeTab = 'ingresos'" title="Ver ingresos">
          <span class="metric-label">Ingresos</span>
          <span class="metric-value metric-value--income">{{ fmt(store.totalIngresos) }}</span>
        </div>
        <div class="metric-card metric-card--clickable" @click="activeTab = 'facturas'" title="Ver facturas">
          <span class="metric-label">Facturas</span>
          <span class="metric-value metric-value--expense">{{ fmt(store.totalFacturas) }}</span>
        </div>
        <div class="metric-card metric-card--clickable" @click="activeTab = 'gastos'" title="Ver gastos variables">
          <span class="metric-label">Gastos variables</span>
          <span class="metric-value metric-value--expense">{{ fmt(store.totalTransacciones) }}</span>
        </div>
        <div class="metric-card metric-card--clickable" @click="activeTab = 'transacciones'" title="Ver transacciones">
          <span class="metric-label">Total gastado</span>
          <span class="metric-value" :class="store.totalGastado > store.totalIngresos ? 'metric-value--danger' : 'metric-value--ok'">
            {{ fmt(store.totalGastado) }}
          </span>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
          <span class="tab-count">{{ tabCount(tab.id) }}</span>
        </button>
      </div>

      <!-- ── TAB: Ingresos ────────────────────────────────────────── -->
      <div v-if="activeTab === 'ingresos'" class="tab-panel">
        <div class="panel-header">
          <h2 class="panel-title">Fuentes de ingreso</h2>
          <AppButton variant="primary" size="sm" @click="openModal('income')">+ Agregar ingreso</AppButton>
        </div>
        <div v-if="store.current.incomes.length === 0" class="empty-state">
          <span class="empty-icon">💰</span>
          <p>Aún no hay ingresos. Agrega tu primer fuente de ingreso.</p>
        </div>
        <div v-else class="data-table">
          <div class="table-head">
            <span>Nombre</span><span>Presupuestado</span><span>Real</span><span></span>
          </div>
          <div
            v-for="inc in store.current.incomes"
            :key="inc.id"
            class="table-row"
          >
            <span class="row-name">{{ inc.name }}</span>
            <span class="row-amount">{{ fmt(inc.budgeted) }}</span>
            <span class="row-amount row-amount--actual">{{ fmt(inc.actual) }}</span>
            <!-- Acciones inline — mismo patrón que Facturas. "Editar" es
                 placeholder hasta que exista la edición de ingresos. -->
            <span class="row-actions">
              <button
                type="button"
                class="btn-action btn-action--edit"
                aria-label="Editar ingreso"
                title="Editar ingreso"
                @click="openEditIncome(inc)"
              >
                <!-- Icono lápiz — heroicons style, currentColor -->
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                type="button"
                class="btn-action btn-action--delete"
                aria-label="Eliminar ingreso"
                title="Eliminar ingreso"
                @click="confirmDeleteIncome(inc.id)"
              >
                <!-- Icono basurero — heroicons style, currentColor -->
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </span>
          </div>
          <div class="table-total">
            <span>Total ingresos</span>
            <span></span>
            <span class="total-value">{{ fmt(store.totalIngresos) }}</span>
            <span></span>
          </div>
        </div>
      </div>

      <!-- ── TAB: Facturas ───────────────────────────────────────── -->
      <div v-if="activeTab === 'facturas'" class="tab-panel">
        <div class="panel-header">
          <h2 class="panel-title">
            Facturas y pagos fijos
            <AppTooltip text="Compromisos predecibles que pagas cada mes en fechas específicas." />
          </h2>
          <AppButton variant="primary" size="sm" @click="openModal('bill')">+ Agregar factura</AppButton>
        </div>
        <div v-if="store.current.bills.length === 0" class="empty-state">
          <span class="empty-icon">🧾</span>
          <p>Aún no hay facturas. Agrega tus pagos recurrentes.</p>
        </div>
        <!-- data-table--bills: agrega una columna "Acciones" angosta al final.
             Requiere 5 columnas — la regla CSS de abajo define el grid específico. -->
        <div v-else class="data-table data-table--bills">
          <div class="table-head">
            <span>Nombre</span><span>Vence</span><span>Monto</span><span>Estado</span><span class="row-actions__head">Acciones</span>
          </div>
          <div
            v-for="bill in store.current.bills"
            :key="bill.id"
            class="table-row"
            :class="{ 'table-row--paid': bill.isPaid }"
          >
            <span class="row-name">{{ bill.name }}</span>
            <span class="row-date">{{ bill.dueDate ? fmtDate(bill.dueDate) : '—' }}</span>
            <span class="row-amount">{{ fmt(bill.actual || bill.budgeted) }}</span>
            <label class="paid-toggle" :title="bill.isPaid ? 'Marcar pendiente' : 'Marcar pagada'">
              <input
                type="checkbox"
                :checked="bill.isPaid"
                @change="store.toggleBillPaid(bill.id, !bill.isPaid)"
              />
              <span class="toggle-label" :class="bill.isPaid ? 'toggle-label--paid' : 'toggle-label--pending'">
                {{ bill.isPaid ? 'Pagada' : 'Pendiente' }}
              </span>
            </label>
            <!-- Celda de acciones — vive DENTRO de la fila (es el 5to grid item).
                 Los botones son <button> puros con SVG; los estilos de .btn-action
                 viven en main.css para reutilizarse en otros listados. -->
            <span class="row-actions">
              <button
                type="button"
                class="btn-action btn-action--edit"
                aria-label="Editar factura"
                title="Editar factura"
                @click="openEditBill(bill)"
              >
                <!-- Icono lápiz — heroicons style, currentColor -->
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                type="button"
                class="btn-action btn-action--delete"
                aria-label="Eliminar factura"
                title="Eliminar factura"
                @click="confirmDeleteBill(bill.id)"
              >
                <!-- Icono basurero — heroicons style, currentColor -->
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </span>
          </div>
          <div class="table-total">
            <span>Total facturas</span><span></span>
            <span class="total-value">{{ fmt(store.totalFacturas) }}</span>
            <span></span><span></span>
          </div>
        </div>
      </div>

      <!-- ── TAB: Gastos Variables ──────────────────────────────── -->
      <div v-if="activeTab === 'gastos'" class="tab-panel">
        <div class="panel-header">
          <h2 class="panel-title">
            Categorías de gasto variable
            <AppTooltip text="Presupuestos: Límites o topes máximos que te permites gastar por categoría durante el mes, no registros de compra." />
          </h2>
          <AppButton variant="primary" size="sm" @click="openModal('expense')">+ Agregar categoría</AppButton>
        </div>
        <div v-if="store.expensesWithActuals.length === 0" class="empty-state">
          <span class="empty-icon">🛒</span>
          <p>Aún no hay categorías de gasto. Agrega tus gastos variables.</p>
        </div>
        <div v-else class="expenses-list">
          <div
            v-for="exp in store.expensesWithActuals"
            :key="exp.id"
            class="expense-row"
          >
            <div class="expense-info">
              <span class="expense-cat">{{ formatCategory(exp.category) }}</span>
              <div class="expense-bar-wrap">
                <div
                  class="expense-bar"
                  :class="expenseBarClass(exp)"
                  :style="{ width: expensePercent(exp) + '%' }"
                ></div>
              </div>
            </div>
            <div class="expense-amounts">
              <span class="exp-actual">{{ fmt(exp.actual) }}</span>
              <span class="exp-sep">/</span>
              <span class="exp-budget">{{ fmt(exp.budgeted) }}</span>
              <AppButton variant="soft-danger" size="xs" icon-only @click="confirmDeleteExpense(exp.id)" title="Eliminar">✕</AppButton>
            </div>
          </div>
        </div>
      </div>

      <!-- ── TAB: Transacciones ─────────────────────────────────── -->
      <div v-if="activeTab === 'transacciones'" class="tab-panel">
        <div class="panel-header">
          <h2 class="panel-title">
            Registro de transacciones
            <AppTooltip text="Tu libreta de movimientos diarios. Registrá cada gasto puntual (compras, comidas, transporte) y se descuenta automáticamente del presupuesto de su categoría." />
          </h2>
          <div class="panel-actions">
            <!-- Filtro por categoría -->
            <select v-model="txFilter" class="input input-sm">
              <option value="">Todas las categorías</option>
              <optgroup v-if="categoryStore.globals.length" label="Globales">
                <option v-for="cat in categoryStore.globals" :key="cat.key" :value="cat.key">{{ cat.label }}</option>
              </optgroup>
              <optgroup v-if="categoryStore.custom.length" label="Mis categorías">
                <option v-for="cat in categoryStore.custom" :key="cat.key" :value="cat.key">{{ cat.label }}</option>
              </optgroup>
            </select>
            <AppButton variant="primary" size="sm" @click="openModal('transaction')">+ Registrar gasto</AppButton>
          </div>
        </div>
        <div v-if="filteredTransactions.length === 0" class="empty-state">
          <span class="empty-icon">💳</span>
          <p>{{ txFilter ? 'No hay transacciones en esta categoría.' : 'Aún no hay transacciones registradas.' }}</p>
        </div>
        <div v-else class="data-table">
          <div class="table-head">
            <span>Fecha</span><span>Categoría</span><span>Nota</span><span>Método</span><span>Monto</span><span></span>
          </div>
          <div
            v-for="tx in filteredTransactions"
            :key="tx.id"
            class="table-row"
          >
            <span class="row-date">{{ fmtDate(tx.date) }}</span>
            <span class="row-cat">{{ formatCategory(tx.category) }}</span>
            <span class="row-note">{{ tx.note || '—' }}</span>
            <span class="row-method">{{ formatPayment(tx.paymentType) }}</span>
            <span class="row-amount row-amount--tx">{{ fmt(tx.amount) }}</span>
            <AppButton variant="soft-danger" size="xs" icon-only @click="confirmDeleteTx(tx.id)" title="Eliminar">✕</AppButton>
          </div>
          <div class="table-total">
            <span>Total</span><span></span><span></span><span></span>
            <span class="total-value">{{ fmt(filteredTransactions.reduce((s, t) => s + t.amount, 0)) }}</span>
            <span></span>
          </div>
        </div>
      </div>

      <!-- ── TAB: Resumen 50/30/20 ──────────────────────────────── -->
      <div v-if="activeTab === 'resumen'" class="tab-panel">
        <div class="panel-header">
          <h2 class="panel-title">
            Resumen 50 / 30 / 20
            <AppTooltip text="Método para dividir tu ingreso mensual: 50% necesidades (renta, servicios), 30% deseos (salidas, hobbies), 20% ahorro/inversión." learn-more-slug="regla-50-30-20" />
          </h2>
          <!-- Summary se calcula localmente como computed -->
        </div>

        <div v-if="!store.summary" class="empty-state">
          <span class="empty-icon">📊</span>
          <p>Cargando resumen…</p>
        </div>
        <template v-else>
          <!-- Regla personalizada -->
          <div class="rule-badge">
            Regla personalizada:
            <strong>{{ store.summary.regla.necesidades.porcentaje }}% Necesidades</strong> ·
            <strong>{{ store.summary.regla.deseos.porcentaje }}% Deseos</strong> ·
            <strong>{{ store.summary.regla.ahorro.porcentaje }}% Ahorros</strong>
          </div>

          <!-- Totales -->
          <div class="summary-overview">
            <div class="so-item">
              <span class="so-label">Ingreso total</span>
              <span class="so-value so-value--income">{{ fmt(store.summary.totalIngresos) }}</span>
            </div>
            <div class="so-item">
              <span class="so-label">Total gastado</span>
              <span class="so-value so-value--expense">{{ fmt(store.summary.totalGastado) }}</span>
            </div>
            <div class="so-item">
              <span class="so-label">Restante</span>
              <span class="so-value" :class="store.summary.disponible >= 0 ? 'so-value--ok' : 'so-value--danger'">
                {{ fmt(store.summary.disponible) }}
              </span>
            </div>
          </div>

          <!-- Bloques 50/30/20 -->
          <div class="summary-blocks">
            <div
              v-for="bloque in summaryBlocks"
              :key="bloque.id"
              class="summary-block"
              :class="`summary-block--${bloque.color}`"
            >
              <div class="block-header">
                <span class="block-icon">{{ bloque.icon }}</span>
                <span class="block-title">{{ bloque.title }}</span>
                <span class="block-pct">{{ bloque.data.porcentaje }}%</span>
              </div>
              <div class="block-bar-wrap">
                <div
                  class="block-bar"
                  :style="{ width: Math.min(100, (bloque.data.actual / bloque.data.objetivo) * 100) + '%' }"
                ></div>
              </div>
              <div class="block-stats">
                <div class="bs-row">
                  <span class="bs-label">Objetivo</span>
                  <span class="bs-val">{{ fmt(bloque.data.objetivo) }}</span>
                </div>
                <div class="bs-row">
                  <span class="bs-label">Actual</span>
                  <span class="bs-val">{{ fmt(bloque.data.actual) }}</span>
                </div>
                <div class="bs-row">
                  <span class="bs-label">Diferencia</span>
                  <span class="bs-val" :class="bloque.data.diferencia >= 0 ? 'bs-val--ok' : 'bs-val--danger'">
                    {{ bloque.data.diferencia >= 0 ? '+' : '' }}{{ fmt(bloque.data.diferencia) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- ════════════════════════════════════════════════════════════
         MODALES
    ════════════════════════════════════════════════════════════ -->

    <!-- Modal: Agregar / editar ingreso (AppModal). Bimodal — el ref
         editingIncomeId decide si submitIncome llama a addIncome o updateIncome. -->
    <AppModal
      :model-value="modal === 'income'"
      @update:model-value="(v) => !v && closeModal()"
      :title="editingIncomeId ? 'Editar ingreso' : 'Agregar ingreso'"
    >
      <div class="form-group">
        <label class="form-label">Nombre *</label>
        <input v-model="incomeForm.name" class="input" placeholder="ej. Sueldo, Freelance…" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Presupuestado *</label>
          <input v-model.number="incomeForm.budgeted" type="number" min="0" step="0.01" class="input" />
        </div>
        <div class="form-group">
          <label class="form-label">Real (ingresado)</label>
          <input v-model.number="incomeForm.actual" type="number" min="0" step="0.01" class="input" />
        </div>
      </div>
      <AppAlert v-if="modalError" type="error" :show="!!modalError">{{ modalError }}</AppAlert>
      <template #footer>
        <AppButton variant="secondary" @click="closeModal">Cancelar</AppButton>
        <AppButton variant="primary" :loading="modalLoading" @click="submitIncome">
          {{ editingIncomeId ? 'Guardar cambios' : 'Guardar' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- Modal: Agregar / editar factura (AppModal). Bimodal — el ref
         editingBillId decide si submitBill llama a addBill o updateBill. -->
    <AppModal
      :model-value="modal === 'bill'"
      @update:model-value="(v) => !v && closeModal()"
      :title="editingBillId ? 'Editar factura' : 'Agregar factura'"
    >
      <div class="form-group">
        <label class="form-label">Nombre *</label>
        <input v-model="billForm.name" class="input" placeholder="ej. Renta, Netflix, CFE…" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Presupuestado *</label>
          <input v-model.number="billForm.budgeted" type="number" min="0" step="0.01" class="input" />
        </div>
        <div class="form-group">
          <label class="form-label">Real pagado</label>
          <input v-model.number="billForm.actual" type="number" min="0" step="0.01" class="input" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Fecha de vencimiento</label>
          <input v-model="billForm.dueDate" type="date" class="input" />
        </div>
        <div class="form-group">
          <label class="form-label">Método de pago</label>
          <select v-model="billForm.paymentType" class="input">
            <option value="">— ninguno —</option>
            <option v-for="p in PAYMENTS" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </div>
      </div>
      <AppAlert v-if="modalError" type="error" :show="!!modalError">{{ modalError }}</AppAlert>
      <template #footer>
        <AppButton variant="secondary" @click="closeModal">Cancelar</AppButton>
        <AppButton variant="primary" :loading="modalLoading" @click="submitBill">
          {{ editingBillId ? 'Guardar cambios' : 'Guardar' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- Modal: Agregar gasto (AppModal) -->
    <AppModal
      :model-value="modal === 'expense'"
      @update:model-value="(v) => !v && closeModal()"
      title="Presupuesto de categoría"
    >
      <div class="form-group">
        <div class="category-label-row">
          <label class="form-label">Categoría *</label>
          <button type="button" class="btn-new-cat" @click="openNewCategoryModal('expense')">+ Nueva categoría</button>
        </div>
        <select v-model="expenseForm.category" class="input">
          <option value="">— selecciona —</option>
          <optgroup v-if="categoryStore.globals.length" label="Globales">
            <option v-for="cat in categoryStore.globals" :key="cat.key" :value="cat.key">{{ cat.label }}</option>
          </optgroup>
          <optgroup v-if="categoryStore.custom.length" label="Mis categorías">
            <option v-for="cat in categoryStore.custom" :key="cat.key" :value="cat.key">{{ cat.label }}</option>
          </optgroup>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Presupuesto para esta categoría *</label>
        <input v-model.number="expenseForm.budgeted" type="number" min="0" step="0.01" class="input" />
      </div>
      <AppAlert v-if="modalError" type="error" :show="!!modalError">{{ modalError }}</AppAlert>
      <template #footer>
        <AppButton variant="secondary" @click="closeModal">Cancelar</AppButton>
        <AppButton variant="primary" :loading="modalLoading" @click="submitExpense">Guardar</AppButton>
      </template>
    </AppModal>

    <!-- Modal: Registrar transacción (AppModal) -->
    <AppModal
      :model-value="modal === 'transaction'"
      @update:model-value="(v) => !v && closeModal()"
      title="Registrar gasto"
      size="lg"
    >
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Monto *</label>
          <input v-model.number="txForm.amount" type="number" min="0.01" step="0.01" class="input" />
        </div>
        <div class="form-group">
          <label class="form-label">Fecha *</label>
          <input v-model="txForm.date" type="date" class="input" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <div class="category-label-row">
            <label class="form-label">Categoría *</label>
            <button type="button" class="btn-new-cat" @click="openNewCategoryModal('transaction')">+ Nueva categoría</button>
          </div>
          <select v-model="txForm.category" class="input">
            <option value="">— selecciona —</option>
            <optgroup v-if="categoryStore.globals.length" label="Globales">
              <option v-for="cat in categoryStore.globals" :key="cat.key" :value="cat.key">{{ cat.label }}</option>
            </optgroup>
            <optgroup v-if="categoryStore.custom.length" label="Mis categorías">
              <option v-for="cat in categoryStore.custom" :key="cat.key" :value="cat.key">{{ cat.label }}</option>
            </optgroup>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Método de pago</label>
          <select v-model="txForm.paymentType" class="input">
            <option value="">— ninguno —</option>
            <option v-for="p in PAYMENTS" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Nota (opcional)</label>
        <input v-model="txForm.note" class="input" placeholder="ej. Uber, Walmart, restaurante…" />
      </div>
      <AppAlert v-if="modalError" type="error" :show="!!modalError">{{ modalError }}</AppAlert>
      <template #footer>
        <AppButton variant="secondary" @click="closeModal">Cancelar</AppButton>
        <AppButton variant="primary" :loading="modalLoading" @click="submitTransaction">Registrar</AppButton>
      </template>
    </AppModal>

    <!-- Modal: Nueva Categoría personalizada -->
    <AppModal
      v-model="newCatModal"
      title="Nueva categoría"
      size="sm"
    >
      <div class="form-group">
        <label class="form-label">Nombre *</label>
        <input
          v-model="newCatForm.label"
          class="input"
          placeholder="ej. Delivery, Masajes, Streaming…"
          maxlength="100"
          @keyup.enter="submitNewCategory"
        />
      </div>
      <div class="form-group">
        <label class="form-label">Clasificación (regla 50/30/20)</label>
        <select v-model="newCatForm.type" class="input">
          <option value="necesidad">Necesidad</option>
          <option value="deseo">Deseo</option>
        </select>
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="newCatModal = false">Cancelar</AppButton>
        <AppButton variant="primary" :loading="newCatLoading" @click="submitNewCategory">Crear</AppButton>
      </template>
    </AppModal>

    <!-- Confirmación de eliminación (AppModal) -->
    <AppModal
      v-model="deleteModalOpen"
      @update:model-value="onDeleteModalClose"
      title="Confirmar eliminación"
      size="sm"
    >
      <p class="modal__desc">¿Estás seguro de que deseas eliminar este elemento? Esta acción no se puede deshacer.</p>
      <template #footer>
        <AppButton variant="secondary" @click="deleteModalOpen = false">Cancelar</AppButton>
        <AppButton variant="danger" :loading="modalLoading" @click="executeDelete">Eliminar</AppButton>
      </template>
    </AppModal>

    <!-- Drawer de ayuda contextual con slug dinámico según el tab activo.
         Los tabs operativos (ingresos/facturas/gastos/transacciones) abren
         "primer-presupuesto" — la guía paso a paso de uso. El tab "resumen"
         apunta al artículo conceptual de la regla 50/30/20. -->
    <AppHelpDrawer :slug="helpSlug" :open="helpOpen" @close="helpOpen = false" />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBudgetStore } from '@/stores/budget.store'
import { useCategoryStore } from '@/stores/category.store'
import type { PaymentType, Expense } from '@/types/budget.types'
import { AppButton, AppModal, AppAlert, AppTooltip, AppHelpDrawer } from '@/components'

const route  = useRoute()
const router = useRouter()
const store  = useBudgetStore()
const categoryStore = useCategoryStore()

// Texto del banner de estado degradado — visible cuando store.degraded === true
const BANNER_DEGRADED_COPY = 'Datos protegidos. Desbloqueá tu cifrado para visualizar tu información.'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const TABS = [
  { id: 'ingresos',       label: 'Ingresos' },
  { id: 'facturas',       label: 'Facturas' },
  { id: 'gastos',         label: 'Gastos variables' },
  { id: 'transacciones',  label: 'Transacciones' },
  { id: 'resumen',        label: 'Resumen 50/30/20' },
]

// Las categorías vienen del store (globales + personalizadas del usuario)
// CATEGORIES ya no es un array hardcodeado

// ── Modal: Nueva Categoría ────────────────────────────────────────────
const newCatModal      = ref(false)
const newCatLoading    = ref(false)
const newCatForm       = ref({ label: '', type: 'deseo' as 'necesidad' | 'deseo' })
// pendingCategoryTarget indica qué formulario recibirá la nueva categoría al crearla
const pendingCategoryTarget = ref<'expense' | 'transaction' | null>(null)

function openNewCategoryModal(target: 'expense' | 'transaction') {
  pendingCategoryTarget.value = target
  newCatForm.value = { label: '', type: 'deseo' }
  newCatModal.value = true
}

async function submitNewCategory() {
  if (!newCatForm.value.label.trim()) return
  newCatLoading.value = true
  const created = await categoryStore.create(newCatForm.value.label.trim(), newCatForm.value.type)
  newCatLoading.value = false
  if (!created) return

  // Auto-selecciona la nueva categoría en el formulario origen
  if (pendingCategoryTarget.value === 'expense') {
    expenseForm.value.category = created.key
  } else if (pendingCategoryTarget.value === 'transaction') {
    txForm.value.category = created.key
  }
  newCatModal.value = false
}

const PAYMENTS = [
  { value: 'efectivo',       label: 'Efectivo' },
  { value: 'tarjeta',        label: 'Tarjeta de crédito' },
  { value: 'debito',         label: 'Tarjeta de débito' },
  { value: 'transferencia',  label: 'Transferencia' },
  { value: 'otro',           label: 'Otro' },
]

// ── Tab activo ───────────────────────────────────────────────────────
const activeTab = ref('ingresos')

// ── Ayuda contextual ─────────────────────────────────────────────────
// Estado del drawer + slug que se calcula según el tab visible. Mantenemos
// los tabs operativos apuntando al tutorial general de presupuesto y el
// tab de resumen apuntando al artículo conceptual de 50/30/20.
const helpOpen = ref(false)
const helpSlug = computed(() =>
  activeTab.value === 'resumen' ? 'regla-50-30-20' : 'primer-presupuesto'
)

function tabCount(id: string): number {
  const c = store.current
  if (!c) return 0
  if (id === 'ingresos')      return c.incomes.length
  if (id === 'facturas')      return c.bills.length
  if (id === 'gastos')        return c.expenses.length
  if (id === 'transacciones') return c.transactions.length
  return 0
}

// ── Filtro de transacciones ───────────────────────────────────────────
const txFilter = ref('')
const filteredTransactions = computed(() => {
  const txs = store.current?.transactions ?? []
  if (!txFilter.value) return txs
  return txs.filter(t => t.category === txFilter.value)
})

// ── Resumen 50/30/20 ──────────────────────────────────────────────────
// Adapta cada entrada de `summary.regla` al shape que el template espera:
// { objetivo, actual, diferencia, porcentaje }. `diferencia` se calcula aquí.
const summaryBlocks = computed(() => {
  const s = store.summary
  if (!s) return []
  const toBlock = (r: { limite: number; actual: number; porcentaje: number }) => ({
    objetivo:   r.limite,
    actual:     r.actual,
    diferencia: r.limite - r.actual,
    porcentaje: r.porcentaje,
  })
  return [
    { id: 'necesidades', icon: '🏠', title: 'Necesidades', color: 'blue',  data: toBlock(s.regla.necesidades) },
    { id: 'deseos',      icon: '🎯', title: 'Deseos',      color: 'amber', data: toBlock(s.regla.deseos) },
    { id: 'ahorros',     icon: '💎', title: 'Ahorros',     color: 'green', data: toBlock(s.regla.ahorro) },
  ]
})

// ── Formateo ──────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatCategory(cat: string): string {
  return categoryStore.labelByKey(cat)
}

function formatPayment(pay: string | null): string {
  if (!pay) return '—'
  return PAYMENTS.find(p => p.value === pay)?.label ?? pay
}

function expensePercent(exp: Expense): number {
  if (!exp.budgeted) return 0
  return Math.min(100, (exp.actual / exp.budgeted) * 100)
}

function expenseBarClass(exp: Expense): string {
  const pct = expensePercent(exp)
  if (pct >= 100) return 'expense-bar--over'
  if (pct >= 80)  return 'expense-bar--warn'
  return 'expense-bar--ok'
}

// ── Modal genérico ────────────────────────────────────────────────────
type ModalType = 'income' | 'bill' | 'expense' | 'transaction' | null
const modal       = ref<ModalType>(null)
const modalLoading = ref(false)
const modalError   = ref<string | null>(null)

// Si tienen valor, el modal correspondiente está en modo edición sobre ese id.
// null = modo creación. El template usa estos flags para título y CTA.
const editingIncomeId = ref<string | null>(null)
const editingBillId   = ref<string | null>(null)

function openModal(type: ModalType) {
  modal.value       = type
  modalError.value  = null
  resetForms()
}

function closeModal() {
  modal.value = null
  // Al cerrar (X, Cancelar, Escape, click afuera) volvemos a modo creación
  // para la próxima apertura. El reset de los formularios se hace en openModal.
  editingIncomeId.value = null
  editingBillId.value   = null
}

function resetForms() {
  const today = new Date().toISOString().split('T')[0]
  incomeForm.value  = { name: '', budgeted: 0, actual: 0 }
  billForm.value    = { name: '', budgeted: 0, actual: 0, dueDate: '', paymentType: '' }
  expenseForm.value = { category: '' as ExpenseCategory, budgeted: 0 }
  txForm.value      = { amount: 0, category: '' as ExpenseCategory, paymentType: '', note: '', date: today }
}

/** Abre el modal de ingreso en modo edición y pre-llena con los datos de
 *  un Income ya descifrado (viene de store.current.incomes). */
function openEditIncome(income: { id: string; name: string; budgeted: number; actual: number }) {
  // Reset previo + carga de los valores actuales
  resetForms()
  incomeForm.value = {
    name:     income.name,
    budgeted: Number(income.budgeted),
    actual:   Number(income.actual ?? 0),
  }
  editingIncomeId.value = income.id
  modalError.value      = null
  modal.value           = 'income'
}

/** Abre el modal de factura en modo edición y pre-llena con los datos de
 *  un Bill ya descifrado (viene de store.current.bills). */
function openEditBill(bill: {
  id: string
  name: string
  budgeted: number
  actual: number
  dueDate: string | null
  paymentType: PaymentType | null
}) {
  resetForms()
  billForm.value = {
    name:        bill.name,
    budgeted:    Number(bill.budgeted),
    actual:      Number(bill.actual ?? 0),
    // dueDate puede venir como ISO con hora — recortamos a YYYY-MM-DD para el input date.
    dueDate:     bill.dueDate ? String(bill.dueDate).slice(0, 10) : '',
    paymentType: bill.paymentType ?? '',
  }
  editingBillId.value = bill.id
  modalError.value    = null
  modal.value         = 'bill'
}

// ── Formularios ───────────────────────────────────────────────────────
const incomeForm  = ref({ name: '', budgeted: 0, actual: 0 })
const billForm    = ref({ name: '', budgeted: 0, actual: 0, dueDate: '', paymentType: '' as PaymentType | '' })
const expenseForm = ref({ category: '' as ExpenseCategory | '', budgeted: 0 })
const txForm      = ref({
  amount: 0,
  category: '' as ExpenseCategory | '',
  paymentType: '' as PaymentType | '',
  note: '',
  date: new Date().toISOString().split('T')[0],
})

// ── Submit: Ingreso (bimodal — crea o actualiza según editingIncomeId) ──
async function submitIncome() {
  if (!incomeForm.value.name.trim() || incomeForm.value.budgeted <= 0) {
    modalError.value = 'Nombre y monto presupuestado son requeridos.'
    return
  }
  modalLoading.value = true
  modalError.value   = null
  try {
    const payload = {
      name:     incomeForm.value.name.trim(),
      budgeted: incomeForm.value.budgeted,
      actual:   incomeForm.value.actual || 0,
    }
    if (editingIncomeId.value) {
      await store.updateIncome(editingIncomeId.value, payload)
    } else {
      await store.addIncome(payload)
    }
    closeModal()
  } catch {
    modalError.value = store.error ?? 'Error al guardar'
  } finally {
    modalLoading.value = false
  }
}

// ── Submit: Factura (bimodal — crea o actualiza según editingBillId) ──
async function submitBill() {
  if (!billForm.value.name.trim() || billForm.value.budgeted <= 0) {
    modalError.value = 'Nombre y monto presupuestado son requeridos.'
    return
  }
  modalLoading.value = true
  modalError.value   = null
  try {
    const payload = {
      name:        billForm.value.name.trim(),
      budgeted:    billForm.value.budgeted,
      actual:      billForm.value.actual || 0,
      dueDate:     billForm.value.dueDate || null,
      paymentType: (billForm.value.paymentType as PaymentType) || null,
    }
    if (editingBillId.value) {
      await store.updateBill(editingBillId.value, payload)
    } else {
      await store.addBill(payload)
    }
    closeModal()
  } catch {
    modalError.value = store.error ?? 'Error al guardar'
  } finally {
    modalLoading.value = false
  }
}

// ── Submit: Gasto variable (categoría) ───────────────────────────────
async function submitExpense() {
  if (!expenseForm.value.category || expenseForm.value.budgeted <= 0) {
    modalError.value = 'Categoría y presupuesto son requeridos.'
    return
  }
  modalLoading.value = true
  modalError.value   = null
  try {
    await store.addExpense({
      category: expenseForm.value.category as ExpenseCategory,
      budgeted: expenseForm.value.budgeted,
    })
    closeModal()
  } catch {
    modalError.value = store.error ?? 'Error al guardar'
  } finally {
    modalLoading.value = false
  }
}

// ── Submit: Transacción ───────────────────────────────────────────────
async function submitTransaction() {
  if (!txForm.value.amount || !txForm.value.category || !txForm.value.date) {
    modalError.value = 'Monto, categoría y fecha son requeridos.'
    return
  }
  modalLoading.value = true
  modalError.value   = null
  try {
    await store.addTransaction({
      amount:      txForm.value.amount,
      category:    txForm.value.category as ExpenseCategory,
      paymentType: txForm.value.paymentType as PaymentType || null,
      note:        txForm.value.note || null,
      date:        txForm.value.date,
    })
    closeModal()
  } catch {
    modalError.value = store.error ?? 'Error al registrar'
  } finally {
    modalLoading.value = false
  }
}

// ── Confirmación de eliminación ───────────────────────────────────────
type DeleteTarget = { type: 'income' | 'bill' | 'expense' | 'transaction'; id: string } | null
const deleteTarget    = ref<DeleteTarget>(null)
const deleteModalOpen = ref(false)

function confirmDeleteIncome(id: string)  { deleteTarget.value = { type: 'income',      id }; deleteModalOpen.value = true }
function confirmDeleteBill(id: string)    { deleteTarget.value = { type: 'bill',         id }; deleteModalOpen.value = true }
function confirmDeleteExpense(id: string) { deleteTarget.value = { type: 'expense',      id }; deleteModalOpen.value = true }
function confirmDeleteTx(id: string)      { deleteTarget.value = { type: 'transaction',  id }; deleteModalOpen.value = true }

function onDeleteModalClose(val: boolean) {
  if (!val) deleteTarget.value = null
}

async function executeDelete() {
  if (!deleteTarget.value) return
  modalLoading.value = true
  try {
    const { type, id } = deleteTarget.value
    if (type === 'income')      await store.removeIncome(id)
    if (type === 'bill')        await store.removeBill(id)
    if (type === 'expense')     await store.removeExpense(id)
    if (type === 'transaction') await store.removeTransaction(id)
    deleteTarget.value    = null
    deleteModalOpen.value = false
  } catch {
    // El error ya está en store.error
  } finally {
    modalLoading.value = false
  }
}


// ── Carga inicial ─────────────────────────────────────────────────────
onMounted(async () => {
  const id = route.params.id as string
  await Promise.all([store.fetchOne(id), categoryStore.fetchIfNeeded()])
  // Abre modal si viene de acceso rápido del dashboard
  const open = route.query.open as string | undefined
  if (open === 'income') {
    activeTab.value = 'ingresos'
    openModal('income')
  } else if (open === 'transaction') {
    activeTab.value = 'transacciones'
    openModal('transaction')
  }
})

// Limpia el presupuesto activo al salir de la vista
onUnmounted(() => store.clearCurrent())
</script>

<style scoped>
.budget-detail {
  padding: var(--space-lg);
  max-width: 1100px;
  margin: 0 auto;
}

/* Cabecera */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-lg);
  flex-wrap: wrap;
  gap: var(--space-md);
}
.header-left   { display: flex; align-items: center; gap: var(--space-md); }
/* Cluster derecho: chip de saldo + botón de ayuda contextual. */
.header-right  { display: flex; align-items: center; gap: var(--space-sm); }
/* .back-btn → AppButton variant="ghost" */
.page-title { font-size: 1.4rem; font-weight: 700; color: var(--color-text); margin: 0; }

.balance-chip {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.85rem;
  border: 1px solid;
}
.balance-chip--ok     { background: rgba(16,185,129,.12); color: #10b981; border-color: rgba(16,185,129,.3); }
.balance-chip--deficit { background: rgba(239,68,68,.12); color: #ef4444;  border-color: rgba(239,68,68,.3); }

/* Métricas rápidas */
.metrics-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}
.metric-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.metric-card--clickable { cursor: pointer; transition: box-shadow .15s, transform .15s; }
.metric-card--clickable:hover { box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,.1)); transform: translateY(-2px); }
.metric-label       { font-size: 0.72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-muted); }
.metric-value       { font-size: 1.15rem; font-weight: 700; }
.metric-value--income  { color: var(--color-success); }
.metric-value--expense { color: var(--color-text); }
.metric-value--ok      { color: var(--color-success); }
.metric-value--danger  { color: var(--color-danger); }

/* Tabs */
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-lg);
  overflow-x: auto;
}
.tab-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color .15s, border-color .15s;
}
.tab-btn:hover              { color: var(--color-text); }
.tab-btn--active            { color: var(--color-primary); border-bottom-color: var(--color-primary); }
.tab-count {
  background: var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.68rem;
  border-radius: 10px;
  padding: 1px 6px;
  min-width: 18px;
  text-align: center;
}
.tab-btn--active .tab-count { background: rgba(37,99,235,.2); color: var(--color-primary); }

/* Panel */
.tab-panel { }
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
  gap: var(--space-sm);
}
/* inline-flex + align-items:center garantiza que el AppTooltip quede alineado verticalmente con el texto del título */
.panel-title  { font-size: 1rem; font-weight: 600; color: var(--color-text); margin: 0; display: inline-flex; align-items: center; }
.panel-actions { display: flex; align-items: center; gap: var(--space-sm); }

/* Tabla de datos */
.data-table { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); overflow: hidden; }
.table-head {
  display: grid;
  grid-template-columns: var(--cols, 1fr 1fr 1fr auto);
  gap: var(--space-sm);
  padding: 10px var(--space-md);
  background: rgba(255,255,255,.03);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}
.table-row {
  display: grid;
  grid-template-columns: var(--cols, 1fr 1fr 1fr auto);
  gap: var(--space-sm);
  align-items: center;
  padding: 10px var(--space-md);
  border-bottom: 1px solid var(--color-border);
  transition: background .15s;
}
.table-row:last-child   { border-bottom: none; }
.table-row:hover        { background: rgba(255,255,255,.02); }
.table-row--paid        { opacity: .65; }
.table-total {
  display: grid;
  grid-template-columns: var(--cols, 1fr 1fr 1fr auto);
  gap: var(--space-sm);
  padding: 10px var(--space-md);
  font-weight: 600;
  color: var(--color-text);
  font-size: 0.88rem;
  background: rgba(255,255,255,.03);
  border-top: 1px solid var(--color-border);
}

/* Columnas específicas por tabla */
.tab-panel:has(.table-head) .table-head,
.tab-panel:has(.table-head) .table-row,
.tab-panel:has(.table-head) .table-total {
  --cols: 1fr 1fr 1fr auto;
}

/* Tabla de facturas — 5 columnas: Nombre / Vence / Monto / Estado / Acciones.
   El selector replica la cadena `.tab-panel:has(.table-head)` de la regla
   global (specificity 0,3,0) y suma `.data-table--bills` para tener mayor
   specificity (0,4,0) y poder sobrescribir `--cols`. Sin esto, el grid
   global de 4 columnas seguía aplicándose y el 5to elemento (Acciones)
   se desbordaba a una fila implícita debajo. */
.tab-panel:has(.table-head) .data-table--bills .table-head,
.tab-panel:has(.table-head) .data-table--bills .table-row,
.tab-panel:has(.table-head) .data-table--bills .table-total {
  --cols: 1.4fr 1fr 1fr 1fr 80px;
}

/* Celda de acciones — centra los dos botones dentro de los 80px de ancho
   y mantiene el gap exigido por el spec. */
.row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.row-actions__head {
  text-align: center;
}

.row-name   { font-size: 0.9rem; color: var(--color-text); }
.row-amount { font-size: 0.9rem; color: var(--color-text); }
.row-amount--actual { color: var(--color-success); }
.row-amount--tx     { color: var(--color-danger); font-weight: 600; }
.row-date   { font-size: 0.8rem; color: var(--color-text-muted); }
.row-cat    { font-size: 0.82rem; }
.row-note   { font-size: 0.8rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-method { font-size: 0.78rem; color: var(--color-text-muted); }
.total-value { color: var(--color-primary); }

/* Toggle de factura pagada */
.paid-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.paid-toggle input { width: 14px; height: 14px; accent-color: var(--color-success); cursor: pointer; }
.toggle-label        { font-size: 0.75rem; border-radius: 10px; padding: 2px 8px; border: 1px solid; }
.toggle-label--paid    { background: rgba(16,185,129,.12); color: #10b981; border-color: rgba(16,185,129,.3); }
.toggle-label--pending { background: rgba(234,179,8,.12);  color: #eab308;  border-color: rgba(234,179,8,.3); }

/* Gastos variables */
.expenses-list { display: flex; flex-direction: column; gap: 10px; }
.expense-row {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 12px var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-md);
}
.expense-info   { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.expense-cat    { font-size: 0.88rem; font-weight: 500; color: var(--color-text); }
.expense-bar-wrap { height: 5px; background: var(--color-border); border-radius: 3px; overflow: hidden; }
.expense-bar    { height: 100%; border-radius: 3px; transition: width .3s; }
.expense-bar--ok   { background: var(--color-success); }
.expense-bar--warn { background: #eab308; }
.expense-bar--over { background: var(--color-danger); }

.expense-amounts { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; }
.exp-actual  { font-weight: 600; color: var(--color-text); }
.exp-sep     { color: var(--color-text-muted); }
.exp-budget  { color: var(--color-text-muted); }

/* .icon-btn → AppButton variant="soft-danger" size="xs" */

/* Resumen 50/30/20 */
.rule-badge {
  background: rgba(37,99,235,.08);
  border: 1px solid rgba(37,99,235,.2);
  border-radius: var(--radius);
  padding: 10px 16px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-bottom: var(--space-md);
}
.rule-badge strong { color: var(--color-primary); }

.summary-overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}
.so-item { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: var(--space-md); display: flex; flex-direction: column; gap: 6px; }
.so-label       { font-size: 0.72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-muted); }
.so-value       { font-size: 1.2rem; font-weight: 700; }
.so-value--income  { color: var(--color-success); }
.so-value--expense { color: var(--color-danger); }
.so-value--ok      { color: var(--color-success); }
.so-value--danger  { color: var(--color-danger); }

.summary-blocks { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-md); }
.summary-block {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-md);
  border-top: 3px solid;
}
.summary-block--blue  { border-top-color: var(--color-primary); }
.summary-block--amber { border-top-color: #eab308; }
.summary-block--green { border-top-color: var(--color-success); }

.block-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}
.block-icon  { font-size: 1.1rem; }
.block-title { font-size: 0.9rem; font-weight: 600; color: var(--color-text); flex: 1; }
.block-pct   { font-size: 1.1rem; font-weight: 700; color: var(--color-primary); }

.block-bar-wrap { height: 6px; background: var(--color-border); border-radius: 3px; overflow: hidden; margin-bottom: var(--space-sm); }
.block-bar      { height: 100%; border-radius: 3px; background: var(--color-primary); transition: width .4s; }

.block-stats { display: flex; flex-direction: column; gap: 6px; }
.bs-row      { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; }
.bs-label    { color: var(--color-text-muted); }
.bs-val      { font-weight: 500; color: var(--color-text); }
.bs-val--ok    { color: var(--color-success); }
.bs-val--danger { color: var(--color-danger); }

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
.empty-icon { font-size: 2rem; }

/* Input pequeño */
.input-sm { padding: 6px 10px; font-size: 0.82rem; max-width: 200px; }

/* Modal → AppModal gestiona overlay/header/footer */
.modal__desc { color: var(--color-text-muted); font-size: 0.88rem; margin: 0; }
.form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 0.8rem; color: var(--color-text-muted); font-weight: 500; }
.category-label-row { display: flex; align-items: center; justify-content: space-between; }
.btn-new-cat {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
.btn-new-cat:hover { text-decoration: underline; }
/* .btn-danger → AppButton variant="danger" */

/* Loading */
.loading-center { display: flex; justify-content: center; padding: var(--space-xl); }

@media (max-width: 900px) {
  .metrics-row    { grid-template-columns: repeat(2, 1fr); }
  .summary-blocks { grid-template-columns: 1fr; }
  .summary-overview { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 640px) {
  .budget-detail  { padding: var(--space-md); }
  .metrics-row    { grid-template-columns: repeat(2, 1fr); }
  .summary-overview { grid-template-columns: 1fr; }
  .panel-header   { flex-direction: column; align-items: flex-start; }
  .panel-actions  { flex-wrap: wrap; }
  .form-row       { grid-template-columns: 1fr; }
  .input-sm       { max-width: 100%; }
}
</style>
