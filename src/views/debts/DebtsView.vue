<template>
  <div class="debts-view">

    <!-- Cabecera -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">Deudas</h1>
        <p class="page-subtitle">Gestiona y elimina tus deudas con estrategia</p>
      </div>
      <div class="page-header__actions">
        <AppButton variant="primary" @click="openCreateModal">+ Nueva deuda</AppButton>
        <!-- Ayuda contextual — slug dinámico según el tab activo. -->
        <button
          type="button"
          class="btn-help"
          aria-label="Ayuda"
          title="Ayuda"
          @click="helpOpen = true"
        >?</button>
      </div>
    </div>

    <!-- Skeleton inicial — previsualiza 3 tarjetas de deuda -->
    <div v-if="store.loading && !store.debts.length" class="debts-list">
      <div v-for="n in 3" :key="n" class="debt-card" style="padding:var(--space-md);display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="display:flex;flex-direction:column;gap:6px;flex:1">
            <AppSkeleton variant="text" width="45%" height="16" />
            <AppSkeleton variant="text" width="30%" height="12" />
          </div>
          <AppSkeleton variant="rect" width="60" height="22" rounded />
        </div>
        <AppSkeleton variant="rect" width="100%" height="6" rounded />
        <div style="display:flex;gap:16px">
          <AppSkeleton variant="text" width="25%" height="12" />
          <AppSkeleton variant="text" width="25%" height="12" />
          <AppSkeleton variant="text" width="25%" height="12" />
        </div>
      </div>
    </div>

    <div v-else-if="store.error && !store.debts.length" class="alert alert-error">
      {{ store.error }}
    </div>

    <template v-else>

      <!-- ── Resumen global ──────────────────────────────────────────── -->
      <div class="summary-strip">
        <div class="ss-item">
          <span class="ss-label">
            Capital total inicial
            <AppTooltip text="Suma del capital original (sin intereses) de tus deudas ACTIVAS. No incluye deudas ya liquidadas. Es tu punto de partida real." learn-more-slug="capital-vs-interes" />
          </span>
          <span class="ss-value">{{ fmt(store.totalInitial) }}</span>
        </div>
        <div class="ss-item">
          <span class="ss-label">
            Capital amortizado
            <AppTooltip text="Cuánto capital REAL redujiste con tus pagos. Solo cuenta la parte del pago que fue a capital — el interés que le pagas al banco no se suma aquí (ese es un gasto)." learn-more-slug="desglose-pago" />
          </span>
          <span class="ss-value ss-value--ok">{{ fmt(store.totalPaid) }}</span>
        </div>
        <div class="ss-item">
          <span class="ss-label">
            Capital restante
            <AppTooltip text="Lo que realmente te queda por pagar de capital en deudas activas (sin contar el interés que se acumule de aquí en adelante)." />
          </span>
          <span class="ss-value ss-value--debt">{{ fmt(store.totalRemaining) }}</span>
        </div>
        <div class="ss-item">
          <span class="ss-label">
            Intereses al banco
            <AppTooltip text="Suma de TODOS los intereses que ya pagaste en todas tus deudas (activas + liquidadas). Es plata que se fue. Si este número crece mucho, considera pagar más que el mínimo para reducir capital más rápido." learn-more-slug="tasa-anual-vs-mensual" />
          </span>
          <span class="ss-value ss-value--warn">{{ fmt(store.totalInterestPaid) }}</span>
        </div>
        <div class="ss-item">
          <span class="ss-label">
            Pago mínimo/mes
            <AppTooltip text="Suma del pago mínimo mensual de todas tus deudas activas. Es lo que debes cubrir SÍ o SÍ para no caer en mora." />
          </span>
          <span class="ss-value">{{ fmt(store.totalMinPayment) }}</span>
        </div>
        <div class="ss-progress">
          <div class="ss-pct-row">
            <span class="ss-label">
              Avance global
              <AppTooltip text="Porcentaje de capital amortizado sobre el capital inicial de deudas ACTIVAS. No cuenta las liquidadas para no inflar artificialmente el progreso de hoy." />
            </span>
            <span class="ss-pct-val">{{ store.globalProgress }}%</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar" :style="{ width: store.globalProgress + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- ── Alerta: deudas vencidas ──────────────────────────────────── -->
      <div v-if="overdueDebts.length" class="overdue-banner">
        <span class="overdue-banner__icon">🚨</span>
        <div class="overdue-banner__body">
          <strong>{{ overdueDebts.length === 1 ? '1 deuda vencida' : `${overdueDebts.length} deudas vencidas` }}</strong>
          — superaste la fecha límite de pago sin registrar un abono.
          <span v-if="totalLateInterest > 0" class="overdue-banner__extra">
            Interés moratorio acumulado: <strong>{{ fmt(totalLateInterest) }}</strong>
          </span>
        </div>
      </div>

      <!-- ── Tabs: Lista / Comparador de planes ─────────────────────── -->
      <div class="tabs">
        <button class="tab-btn" :class="{ 'tab-btn--active': tab === 'list' }" @click="tab = 'list'">
          Mis deudas <span class="tab-count">{{ store.debts.length }}</span>
        </button>
        <button class="tab-btn" :class="{ 'tab-btn--active': tab === 'plans' }" @click="goToPlans">
          Comparador de estrategias
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════════════
           TAB 1 — Lista de deudas
      ══════════════════════════════════════════════════════════════ -->
      <div v-if="tab === 'list'">
        <div v-if="!store.debts.length" class="empty-state">
          <span class="empty-icon">💳</span>
          <p>Aún no tienes deudas registradas.</p>
          <AppButton variant="primary" @click="openCreateModal">Agregar primera deuda</AppButton>
        </div>

        <div v-else class="debts-list">
          <div
            v-for="debt in store.debts"
            :key="debt.id"
            class="debt-card"
            :class="[`debt-card--${debt.status}`, { 'debt-card--overdue': debt.isOverdue }]"
          >
            <div class="debt-card__info" @click="goToDetail(debt.id)">
              <div class="debt-card__top">
                <div class="debt-name-row">
                  <!-- Prioridad y estado como AppBadge -->
                  <AppBadge color="blue" filled>#{{ debt.priorityOrder }}</AppBadge>
                  <span class="debt-name">{{ debt.name }}</span>
                  <AppBadge
                    :color="debt.status === 'active' ? 'blue' : debt.status === 'paid' ? 'green' : 'amber'"
                    filled
                  >
                    {{ formatStatus(debt.status) }}
                  </AppBadge>
                  <AppBadge v-if="debt.isOverdue" color="red" filled>⚠ Vencida</AppBadge>
                </div>
                <span class="debt-rate">{{ debt.annualInterestRate }}% anual</span>
              </div>

              <div class="debt-progress">
                <div class="debt-progress__bar-wrap">
                  <div
                    class="debt-progress__bar"
                    :style="{ width: debtProgress(debt) + '%' }"
                    :class="debtProgressClass(debt)"
                  ></div>
                </div>
                <div class="debt-progress__labels">
                  <span>{{ fmt(paidAmount(debt)) }} pagado</span>
                  <span>{{ fmt(debt.remainingBalance) }} restante</span>
                </div>
              </div>

              <div class="debt-stats">
                <div class="ds-item">
                  <span class="ds-label">Inicial</span>
                  <span class="ds-val">{{ fmt(debt.initialAmount) }}</span>
                </div>
                <div class="ds-item">
                  <span class="ds-label">Pago mín/mes</span>
                  <span class="ds-val">{{ fmt(debt.minimumPayment) }}</span>
                </div>
                <div class="ds-item">
                  <span class="ds-label">Inicio</span>
                  <span class="ds-val">{{ fmtDate(debt.startDate) }}</span>
                </div>
                <div class="ds-item">
                  <span class="ds-label">Avance</span>
                  <span class="ds-val ds-val--pct">{{ debtProgress(debt) }}%</span>
                </div>
              </div>
            </div>

            <div class="debt-card__actions">
              <!-- CTA primario — se mantiene arriba, sin tocar -->
              <AppButton variant="primary" size="sm" @click="goToDetail(debt.id)">Ver detalle →</AppButton>

              <!-- Fila secundaria DENTRO del card: editar + eliminar.
                   Los .btn-action viven en main.css (ver assets/main.css)
                   y se reutilizan idénticos en la tabla de facturas. -->
              <div class="card-actions-row">
                <button
                  type="button"
                  class="btn-action btn-action--edit"
                  aria-label="Editar deuda"
                  title="Editar deuda"
                  @click="openEditModal(debt)"
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
                  aria-label="Eliminar deuda"
                  title="Eliminar deuda"
                  @click="confirmDelete(debt.id, debt.name)"
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
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════════
           TAB 2 — Comparador de estrategias
      ══════════════════════════════════════════════════════════════ -->
      <div v-if="tab === 'plans'">
        <div class="strategies-hint">
          <span class="strategies-hint__icon">📖</span>
          <span class="strategies-hint__text">
            ¿No sabes qué diferencia hay entre las estrategias?
            <AppTooltip text="Bola de Nieve: menor saldo primero (motivación). Avalancha: tasa más alta primero (ahorro matemático). Fireball: mezcla — tasas altas con avalancha, tasas bajas con bola de nieve." learn-more-slug="estrategias-pago-deudas" />
            Lee el artículo de la guía para elegir la que mejor te adapte.
          </span>
        </div>

        <div v-if="!store.activeDebts.length" class="empty-state">
          <span class="empty-icon">📊</span>
          <p>Necesitas al menos una deuda activa para comparar estrategias.</p>
        </div>

        <template v-else>
          <div v-if="store.plansLoading" class="loading-center">
            <div class="spinner"></div>
            <p class="loading-text">Calculando planes de pago…</p>
          </div>

          <div v-else-if="store.planSnowball" class="plans-grid">
            <!-- Snowball -->
            <div class="plan-card plan-card--snowball">
              <div class="plan-card__header">
                <span class="plan-icon">❄️</span>
                <div>
                  <h3 class="plan-title">Bola de Nieve</h3>
                  <p class="plan-desc">Primero la deuda de menor saldo — motivación psicológica</p>
                </div>
              </div>
              <div class="plan-stats">
                <div class="plan-stat">
                  <span class="ps-label">Meses hasta libertad</span>
                  <span class="ps-val ps-val--months">{{ store.planSnowball.mesesHastaLibertad }}</span>
                </div>
                <div class="plan-stat">
                  <span class="ps-label">Total intereses</span>
                  <span class="ps-val ps-val--interest">{{ fmt(store.planSnowball.totalInteresesPagados) }}</span>
                </div>
              </div>
              <div class="plan-order">
                <p class="plan-order__title">Orden de pago:</p>
                <div v-for="(item, i) in store.planSnowball.orden" :key="i" class="plan-order__item">
                  <span class="poi-priority">{{ item.prioridad }}</span>
                  <span class="poi-name">{{ item.deuda }}</span>
                  <span class="poi-months">{{ item.mesesParaLiquidar }} meses</span>
                </div>
              </div>
            </div>

            <!-- Avalanche -->
            <div class="plan-card plan-card--avalanche">
              <div class="plan-card__header">
                <span class="plan-icon">🌊</span>
                <div>
                  <h3 class="plan-title">Avalancha</h3>
                  <p class="plan-desc">Primero la deuda con mayor interés — máximo ahorro matemático</p>
                </div>
              </div>
              <div class="plan-stats">
                <div class="plan-stat">
                  <span class="ps-label">Meses hasta libertad</span>
                  <span class="ps-val ps-val--months">{{ store.planAvalanche!.mesesHastaLibertad }}</span>
                </div>
                <div class="plan-stat">
                  <span class="ps-label">Total intereses</span>
                  <span class="ps-val ps-val--interest">{{ fmt(store.planAvalanche!.totalInteresesPagados) }}</span>
                </div>
              </div>
              <div class="plan-order">
                <p class="plan-order__title">Orden de pago:</p>
                <div v-for="(item, i) in store.planAvalanche!.orden" :key="i" class="plan-order__item">
                  <span class="poi-priority">{{ item.prioridad }}</span>
                  <span class="poi-name">{{ item.deuda }}</span>
                  <span class="poi-months">{{ item.mesesParaLiquidar }} meses</span>
                </div>
              </div>
            </div>

            <!-- Fireball -->
            <div class="plan-card plan-card--fireball">
              <div class="plan-card__header">
                <span class="plan-icon">🔥</span>
                <div>
                  <h3 class="plan-title">Fireball</h3>
                  <p class="plan-desc">Híbrido — avalancha si tasa ≥ 7%, bola de nieve si &lt; 7%</p>
                </div>
              </div>
              <div class="plan-stats">
                <div class="plan-stat">
                  <span class="ps-label">Meses hasta libertad</span>
                  <span class="ps-val ps-val--months">{{ store.planFireball!.mesesHastaLibertad }}</span>
                </div>
                <div class="plan-stat">
                  <span class="ps-label">Total intereses</span>
                  <span class="ps-val ps-val--interest">{{ fmt(store.planFireball!.totalInteresesPagados) }}</span>
                </div>
              </div>
              <div class="plan-order">
                <p class="plan-order__title">Orden de pago:</p>
                <div v-for="(item, i) in store.planFireball!.orden" :key="i" class="plan-order__item">
                  <span class="poi-priority">{{ item.prioridad }}</span>
                  <span class="poi-name">{{ item.deuda }}</span>
                  <span class="poi-months">{{ item.mesesParaLiquidar }} meses</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Tabla comparativa -->
          <div v-if="!store.plansLoading && store.planSnowball" class="comparison-table">
            <h3 class="comparison-title">Resumen comparativo</h3>
            <div class="ct-grid">
              <div class="ct-head">
                <span>Estrategia</span>
                <span>Meses</span>
                <span>Fecha estimada de libertad</span>
                <span>Total intereses</span>
                <span>Diferencia vs Mejor</span>
              </div>
              <div v-for="plan in comparisonRows" :key="plan.name" class="ct-row" :class="{ 'ct-row--best': plan.isBest }">
                <span class="ct-name">
                  {{ plan.icon }} {{ plan.name }}
                  <AppBadge v-if="plan.isBest" color="green" filled>Mejor</AppBadge>
                </span>
                <span class="ct-months">{{ plan.months }}</span>
                <span class="ct-date">{{ plan.freedomDate }}</span>
                <span class="ct-interest">{{ fmt(plan.interest) }}</span>
                <span class="ct-diff" :class="plan.diff > 0 ? 'ct-diff--more' : 'ct-diff--same'">
                  {{ plan.diff > 0 ? '+' + fmt(plan.diff) : '—' }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </div>

    </template>

    <!-- Modal: Crear / Editar deuda. El mismo formulario sirve para ambos
         flujos — el ref `editingId` decide si llamamos al store con createDebt
         o updateDebt. Al cerrar siempre se limpia el form (ver onModalClose). -->
    <AppModal
      v-model="showCreate"
      :title="editingId ? 'Editar deuda' : 'Nueva deuda'"
      size="lg"
      @update:model-value="onModalToggle"
    >
      <!-- Hint: guía al usuario a MSI cuando la compra es sin intereses -->
      <div class="debt-hint">
        <span class="debt-hint__icon">💡</span>
        <span class="debt-hint__text">
          ¿Es una compra a <strong>meses sin intereses</strong> (MSI)? No la registres aquí —
          <router-link :to="{ name: 'Msi' }" class="debt-hint__link">usa el módulo de MSI</router-link>.
          Este formulario es solo para deudas que <strong>generan intereses</strong>.
        </span>
      </div>
      <div class="form-row">
        <div class="form-group form-group--full">
          <label class="form-label">Nombre de la deuda *</label>
          <input v-model="form.name" class="input" placeholder="ej. Tarjeta Banamex, Crédito auto…" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">
            Capital inicial *
            <AppTooltip text="Lo que debes HOY, sin contar intereses futuros. El sistema calcula los intereses automáticamente con la tasa anual. Ejemplo: si tu tarjeta dice que tu saldo al corte es $20,000, ese es el capital inicial." learn-more-slug="capital-vs-interes" />
          </label>
          <input v-model.number="form.initialAmount" type="number" min="0.01" step="0.01" class="input" placeholder="ej. 20000" />
        </div>
        <div class="form-group">
          <label class="form-label">
            Saldo restante actual *
            <AppTooltip text="Cuánto te falta por pagar de esa deuda. Si recién la estás registrando, suele ser igual al capital inicial. Se irá reduciendo cada vez que registres un pago." />
          </label>
          <input v-model.number="form.remainingBalance" type="number" min="0" step="0.01" class="input" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">
            Pago mínimo mensual *
            <AppTooltip text="El monto más bajo que te exige el banco pagar cada mes. Si pagas solo el mínimo, la deuda tarda más en cerrarse y pagas mucho más interés en total." />
          </label>
          <input v-model.number="form.minimumPayment" type="number" min="0.01" step="0.01" class="input" />
        </div>
        <div class="form-group">
          <label class="form-label">
            Tasa de interés anual (%) *
            <AppTooltip text="El porcentaje anual que te cobra el banco sobre tu saldo. El sistema lo divide entre 12 para calcular el interés que se acumula cada mes. Si la compra es SIN intereses, no la registres aquí — usa el módulo de MSI." learn-more-slug="tasa-anual-vs-mensual" />
          </label>
          <!-- Input numérico + selector fija/variable juntos. El selector va al
               lado de la tasa porque el tipo aplica directamente sobre ese valor:
               si es 'variable' el banco la puede mover y la proyección queda
               desactualizada; el detalle de la deuda muestra un banner con
               la fecha de la última edición. -->
          <div class="rate-row">
            <input
              v-model.number="form.annualInterestRate"
              type="number" min="0" max="200" step="0.01"
              class="input rate-row__input"
              placeholder="ej. 60.5"
            />
            <select v-model="form.rateType" class="input rate-row__select" aria-label="Tipo de tasa">
              <option value="fixed">Fija</option>
              <option value="variable">Variable</option>
            </select>
          </div>
          <span class="form-hint">
            <AppTooltip text="Fija: la tasa pactada no cambia hasta que liquides la deuda. Variable: la tasa puede cambiar (típicamente referenciada a un índice como TIIE). Si es variable, recuerda actualizarla manualmente cuando el banco te avise." />
            ¿Fija o variable? Toca el ícono para entender la diferencia.
          </span>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════
           Plazo + IVA sobre intereses — campos opcionales para
           créditos a término fijo. Si se llenan, el motor calcula el
           pago con la fórmula PMT y desglosa el IVA mes a mes.
      ══════════════════════════════════════════════════════════ -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">
            Plazo (meses) — opcional
            <AppTooltip text="Número de meses en que se dividirá el crédito. Si tu deuda tiene una fecha fija de liquidación, indícalo aquí. Si lo dejas vacío, el sistema calculará cuántos meses tomará pagar con el mínimo." />
          </label>
          <input v-model.number="form.plazo" type="number" min="1" max="600" step="1" class="input" />
          <span class="form-hint">Si tu crédito tiene un número fijo de cuotas, indícalo</span>
        </div>
        <div class="form-group">
          <label class="form-label">
            IVA sobre intereses (%) — opcional
            <AppTooltip text="Algunos créditos cobran IVA sobre los intereses generados cada mes. Revisa tu contrato o estado de cuenta. Si no estás seguro, déjalo en 0." />
          </label>
          <input v-model.number="form.ivaRate" type="number" min="0" max="100" step="0.01" class="input" />
          <span class="form-hint">Solo si tu contrato lo especifica</span>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Fecha de inicio *</label>
          <input v-model="form.startDate" type="date" class="input" />
        </div>
        <div class="form-group">
          <label class="form-label">Orden de prioridad</label>
          <input v-model.number="form.priorityOrder" type="number" min="1" class="input" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">
            Estrategia preferida
            <AppTooltip text="Define el orden en que el sistema prioriza tus deudas. Bola de Nieve (❄️) ataca la más chica primero — motivación. Avalancha (🌊) ataca la de tasa más alta — ahorra intereses. Fireball (🔥) mezcla ambas según la tasa." learn-more-slug="estrategias-pago-deudas" />
          </label>
          <select v-model="form.method" class="input">
            <option value="snowball">❄️ Bola de nieve</option>
            <option value="avalanche">🌊 Avalancha</option>
            <option value="fireball">🔥 Fireball</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select v-model="form.status" class="input">
            <option value="active">Activa</option>
            <option value="paused">Pausada</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notas (opcional)</label>
        <input v-model="form.notes" class="input" placeholder="ej. Tasa fija, se renegociará en julio…" />
      </div>
      <!-- Error de validación (AppAlert) -->
      <AppAlert v-if="formError" type="error" :show="!!formError">{{ formError }}</AppAlert>

      <template #footer>
        <AppButton variant="secondary" @click="showCreate = false">Cancelar</AppButton>
        <AppButton variant="primary" :loading="creating" @click="submitForm">
          {{ editingId ? 'Guardar cambios' : 'Guardar deuda' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- Modal: confirmar eliminación (molécula AppModal) -->
    <AppModal
      v-model="deleteModalOpen"
      title="Eliminar deuda"
      size="sm"
      @update:model-value="onDeleteModalClose"
    >
      <p class="modal__desc">
        ¿Eliminar <strong>{{ deleteTarget?.name }}</strong>? Se borrarán todos sus pagos e historial.
        Esta acción no se puede deshacer.
      </p>
      <template #footer>
        <AppButton variant="secondary" @click="deleteModalOpen = false">Cancelar</AppButton>
        <AppButton variant="danger" :loading="deleting" @click="executeDelete">Eliminar</AppButton>
      </template>
    </AppModal>

    <!-- Drawer de ayuda contextual: tab Mis deudas → guía de registro,
         tab Comparador → artículo conceptual de las tres estrategias. -->
    <AppHelpDrawer :slug="helpSlug" :open="helpOpen" @close="helpOpen = false" />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDebtsStore } from '@/stores/debts.store'
import type { DebtMethod, DebtStatus, DebtRateType, Debt } from '@/types/debt.types'
import { AppButton, AppBadge, AppModal, AppAlert, AppSkeleton, AppTooltip, AppHelpDrawer } from '@/components'

const router = useRouter()
const store  = useDebtsStore()

// ── Tab activo ────────────────────────────────────────────────────────
const tab = ref<'list' | 'plans'>('list')

// ── Ayuda contextual ──────────────────────────────────────────────────
// El slug cambia en función del tab visible: en "Mis deudas" abre el
// tutorial de cómo registrar una deuda; en el comparador abre el artículo
// conceptual sobre las estrategias (snowball/avalancha/fireball).
const helpOpen = ref(false)
const helpSlug = computed(() =>
  tab.value === 'plans' ? 'estrategias-pago-deudas' : 'registrar-deudas'
)

async function goToPlans() {
  tab.value = 'plans'
  if (!store.planSnowball && store.activeDebts.length) {
    await store.fetchAllPlans()
  }
}

// ── Formateo ──────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
    month: 'short', year: 'numeric',
  })
}

function freedomDate(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

function formatStatus(s: string): string {
  return ({ active: 'Activa', paid: 'Liquidada', paused: 'Pausada' } as Record<string,string>)[s] ?? s
}

// ── Deudas vencidas ────────────────────────────────────────────────────
const overdueDebts     = computed(() => store.debts.filter(d => d.isOverdue))
const totalLateInterest = computed(() =>
  overdueDebts.value.reduce((s, d) => s + Number(d.lateInterestAmount), 0)
)

// ── Helpers de deuda ──────────────────────────────────────────────────
function paidAmount(debt: Debt): number {
  return Math.max(0, Number(debt.initialAmount) - Number(debt.remainingBalance))
}
function debtProgress(debt: Debt): number {
  if (!debt.initialAmount) return 0
  return Math.round((paidAmount(debt) / debt.initialAmount) * 100)
}
function debtProgressClass(debt: Debt): string {
  const p = debtProgress(debt)
  if (p >= 80) return 'progress-bar--great'
  if (p >= 40) return 'progress-bar--mid'
  return 'progress-bar--low'
}

// ── Tabla comparativa ─────────────────────────────────────────────────
const comparisonRows = computed(() => {
  const plans = [
    { name: 'Bola de Nieve', icon: '❄️', plan: store.planSnowball },
    { name: 'Avalancha',     icon: '🌊', plan: store.planAvalanche },
    { name: 'Fireball',      icon: '🔥', plan: store.planFireball },
  ]
  const minInterest = Math.min(
    ...plans.filter(p => p.plan).map(p => p.plan!.totalInteresesPagados)
  )
  return plans
    .filter(p => p.plan)
    .map(p => ({
      name:        p.name,
      icon:        p.icon,
      months:      p.plan!.mesesHastaLibertad,
      interest:    p.plan!.totalInteresesPagados,
      freedomDate: freedomDate(p.plan!.mesesHastaLibertad),
      diff:        p.plan!.totalInteresesPagados - minInterest,
      isBest:      p.plan!.totalInteresesPagados === minInterest,
    }))
})

// ── Navegación ────────────────────────────────────────────────────────
function goToDetail(id: string) {
  router.push({ name: 'DebtDetail', params: { id } })
}

// ── Modal crear / editar deuda ────────────────────────────────────────
const showCreate = ref(false)
const creating   = ref(false)
const formError  = ref<string | null>(null)
// Si tiene valor, el formulario está en modo edición sobre esa deuda.
// null = modo creación (post). El template usa este flag para el título y CTA.
const editingId  = ref<string | null>(null)

const makeForm = () => ({
  name:               '',
  initialAmount:      0,
  remainingBalance:   0,
  minimumPayment:     0,
  annualInterestRate: 0,
  // Default 'fixed': la mayoría de tarjetas de crédito tienen tasa fija
  // contractualmente. El usuario marca 'variable' explícitamente cuando aplica.
  rateType:           'fixed' as DebtRateType,
  startDate:          new Date().toISOString().split('T')[0],
  priorityOrder:      store.debts.length + 1,
  method:             'avalanche' as DebtMethod,
  status:             'active' as DebtStatus,
  notes:              '',
  plazo:              undefined as number | undefined,
  ivaRate:            undefined as number | undefined,
})

const form = ref(makeForm())

function openCreateModal() {
  form.value       = makeForm()
  formError.value  = null
  editingId.value  = null
  showCreate.value = true
}

/** Pre-llena el formulario con los datos de una deuda existente y abre en
 *  modo edición. El template muestra el título y CTA acordes a `editingId`. */
function openEditModal(debt: Debt) {
  form.value = {
    name:               debt.name,
    initialAmount:      Number(debt.initialAmount),
    remainingBalance:   Number(debt.remainingBalance),
    minimumPayment:     Number(debt.minimumPayment),
    annualInterestRate: Number(debt.annualInterestRate),
    // Las deudas migradas antes de este campo llegan sin rateType — caemos
    // en 'fixed' para no romper el select y mantener el comportamiento previo.
    rateType:           debt.rateType ?? 'fixed',
    startDate:          String(debt.startDate).slice(0, 10),
    priorityOrder:      debt.priorityOrder,
    method:             debt.method,
    // El select solo expone Activa/Pausada en su markup, pero conservamos el
    // valor real (incluyendo 'paid') para no alterar el estado al guardar si
    // el usuario edita una deuda liquidada sin tocar este campo.
    status:             debt.status,
    notes:              debt.notes ?? '',
    plazo:              debt.plazo   ?? undefined,
    ivaRate:            debt.ivaRate ?? undefined,
  }
  formError.value  = null
  editingId.value  = debt.id
  showCreate.value = true
}

/** Limpia el form cada vez que el modal se cierra (sea por X, click afuera,
 *  Escape o cancel). Garantiza que la próxima apertura arranque limpia. */
function onModalToggle(value: boolean) {
  if (!value) {
    form.value      = makeForm()
    formError.value = null
    editingId.value = null
  }
}

/** Convierte cualquier valor proveniente de un input number en number | undefined.
 *  Los inputs `type="number"` con `v-model.number` pueden devolver string vacío
 *  cuando el usuario borra el campo — class-validator rechaza esos "" aunque el
 *  campo sea @IsOptional(), porque `IsNumber` no acepta strings. Esta función
 *  unifica el tratamiento para todos los numéricos opcionales del formulario. */
function toOptionalNumber(v: unknown): number | undefined {
  if (v === '' || v === null || v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** Submit unificado — bifurca a create o update según `editingId`. */
async function submitForm() {
  if (!form.value.name.trim() || form.value.initialAmount <= 0 || form.value.minimumPayment <= 0) {
    formError.value = 'Nombre, monto inicial y pago mínimo son requeridos.'
    return
  }
  creating.value  = true
  formError.value = null

  // Payload compartido — los DTO de create y update aceptan los mismos campos.
  // Cada numérico opcional pasa por toOptionalNumber para evitar mandar "" al
  // backend (rompe la validación @IsNumber/@IsInt aunque sea @IsOptional).
  const payload = {
    name:               form.value.name.trim(),
    initialAmount:      form.value.initialAmount,
    remainingBalance:   form.value.remainingBalance || form.value.initialAmount,
    minimumPayment:     form.value.minimumPayment,
    // annualInterestRate es opcional — un input vacío llegaría como "" y
    // rompería @IsNumber. Si no hay valor lo omitimos (undefined ⇒ skip).
    annualInterestRate: toOptionalNumber(form.value.annualInterestRate),
    rateType:           form.value.rateType,
    startDate:          form.value.startDate,
    priorityOrder:      toOptionalNumber(form.value.priorityOrder),
    method:             form.value.method,
    status:             form.value.status,
    notes:              form.value.notes || undefined,
    plazo:              toOptionalNumber(form.value.plazo),
    ivaRate:            toOptionalNumber(form.value.ivaRate),
  }

  try {
    if (editingId.value) {
      await store.updateDebt(editingId.value, payload)
      showCreate.value = false
      store.clearPlans()
    } else {
      const nueva = await store.createDebt(payload)
      if (nueva) {
        showCreate.value = false
        store.clearPlans()
      } else {
        formError.value = store.error ?? 'Error al guardar'
      }
    }
  } catch {
    formError.value = store.error ?? 'Error al guardar'
  } finally {
    creating.value = false
  }
}

// ── Eliminar deuda ────────────────────────────────────────────────────
const deleteTarget    = ref<{ id: string; name: string } | null>(null)
const deleteModalOpen = ref(false)
const deleting        = ref(false)

function confirmDelete(id: string, name: string) {
  deleteTarget.value    = { id, name }
  deleteModalOpen.value = true
}

// Cuando AppModal cierra, limpia el target
function onDeleteModalClose(val: boolean) {
  if (!val) deleteTarget.value = null
}

async function executeDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await store.removeDebt(deleteTarget.value.id)
    deleteTarget.value    = null
    deleteModalOpen.value = false
    store.clearPlans()
  } catch { /* error en store.error */ } finally {
    deleting.value = false
  }
}

// ── Carga inicial ─────────────────────────────────────────────────────
onMounted(() => store.fetchAll())
</script>

<style scoped>
.debts-view {
  padding: var(--space-lg);
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
  flex-wrap: wrap;
}
/* Cluster de acciones a la derecha del header (CTA principal + ayuda). */
.page-header__actions { display: flex; align-items: center; gap: var(--space-sm); }
.page-title    { font-size: 1.6rem; font-weight: 700; color: var(--color-text); margin: 0; }
.page-subtitle { font-size: 0.9rem; color: var(--color-text-muted); margin: 4px 0 0; }

/* Resumen strip */
.summary-strip {
  display: grid;
  grid-template-columns: repeat(5, 1fr) 1.4fr;
  gap: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-md) var(--space-lg);
  margin-bottom: var(--space-lg);
  align-items: center;
}
.ss-item    { display: flex; flex-direction: column; gap: 4px; }
.ss-label   { font-size: 0.72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-muted); display: inline-flex; align-items: center; gap: 4px; }
.ss-value   { font-size: 1.05rem; font-weight: 700; color: var(--color-text); }
.ss-value--ok   { color: var(--color-success); }
.ss-value--debt { color: var(--color-danger); }
.ss-value--warn { color: #f59e0b; }
.ss-progress    { display: flex; flex-direction: column; gap: 6px; }
.ss-pct-row     { display: flex; justify-content: space-between; align-items: center; }
.ss-pct-val     { font-size: 0.85rem; font-weight: 600; color: var(--color-primary); }
.progress-bar-wrap { height: 6px; background: var(--color-border); border-radius: 3px; overflow: hidden; }
.progress-bar      { height: 100%; border-radius: 3px; background: var(--color-primary); transition: width .4s; }

/* Tabs */
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--color-border); margin-bottom: var(--space-lg); }
.tab-btn {
  background: none; border: none; color: var(--color-text-muted);
  font-size: 0.85rem; padding: 10px 16px; cursor: pointer;
  border-bottom: 2px solid transparent;
  display: flex; align-items: center; gap: 6px;
  transition: color .15s, border-color .15s;
}
.tab-btn:hover           { color: var(--color-text); }
.tab-btn--active         { color: var(--color-primary); border-bottom-color: var(--color-primary); }
.tab-count { background: var(--color-border); color: var(--color-text-muted); font-size: 0.68rem; border-radius: 10px; padding: 1px 6px; }
.tab-btn--active .tab-count { background: rgba(37,99,235,.2); color: var(--color-primary); }

/* Lista de deudas */
.debts-list { display: flex; flex-direction: column; gap: var(--space-md); }

.debt-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  border-left: 4px solid var(--color-primary);
  display: flex;
  overflow: hidden;
  transition: box-shadow .2s;
}
.debt-card:hover       { box-shadow: 0 4px 16px rgba(0,0,0,.25); }
.debt-card--paid       { border-left-color: var(--color-success); opacity: .8; }
.debt-card--paused     { border-left-color: #eab308; }
.debt-card--overdue    { border-left-color: var(--color-danger); box-shadow: 0 0 0 1px rgba(239,68,68,.25); }

.debt-card__info {
  flex: 1; padding: var(--space-md) var(--space-lg); cursor: pointer;
  display: flex; flex-direction: column; gap: var(--space-sm);
}
.debt-card__top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); flex-wrap: wrap; }
.debt-name-row  { display: flex; align-items: center; gap: var(--space-sm); }
/* .priority-badge y .status-badge → ahora son AppBadge */
.debt-name { font-size: 1rem; font-weight: 600; color: var(--color-text); }
.debt-rate { font-size: 0.8rem; color: var(--color-text-muted); }

.debt-progress { display: flex; flex-direction: column; gap: 6px; }
.debt-progress__bar-wrap { height: 6px; background: var(--color-border); border-radius: 3px; overflow: hidden; }
.debt-progress__bar      { height: 100%; border-radius: 3px; transition: width .4s; }
.progress-bar--great { background: var(--color-success); }
.progress-bar--mid   { background: #eab308; }
.progress-bar--low   { background: var(--color-primary); }
.debt-progress__labels { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--color-text-muted); }

.debt-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-sm); padding-top: var(--space-sm); border-top: 1px solid var(--color-border); }
.ds-item  { display: flex; flex-direction: column; gap: 2px; }
.ds-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-muted); }
.ds-val   { font-size: 0.85rem; font-weight: 500; color: var(--color-text); }
.ds-val--pct { color: var(--color-primary); font-weight: 600; }

.debt-card__actions {
  display: flex; flex-direction: column; align-items: stretch; justify-content: center;
  gap: var(--space-sm); padding: var(--space-md); border-left: 1px solid var(--color-border); min-width: 110px;
}
/* Fila de acciones secundarias DENTRO del card — editar + eliminar.
   Vive como hijo de .debt-card__actions: aparece debajo de "Ver detalle →"
   sin salirse del contenedor ni cambiar el tamaño del card. Toma el ancho
   completo del bloque (igual al de "Ver detalle →") y centra los dos
   botones para que queden alineados al CTA primario de arriba. */
.card-actions-row {
  display: flex;
  width: 100%;
  gap: 4px;
  justify-content: center;
  margin-top: 8px;
}

/* Comparador de planes */
.plans-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-md); margin-bottom: var(--space-lg); }
.plan-card {
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius); border-top: 4px solid;
  padding: var(--space-md); display: flex; flex-direction: column; gap: var(--space-md);
}
.plan-card--snowball  { border-top-color: #60a5fa; }
.plan-card--avalanche { border-top-color: #818cf8; }
.plan-card--fireball  { border-top-color: #f97316; }

.plan-card__header { display: flex; align-items: flex-start; gap: var(--space-sm); }
.plan-icon  { font-size: 1.6rem; line-height: 1; }
.plan-title { font-size: 0.95rem; font-weight: 600; color: var(--color-text); margin: 0; }
.plan-desc  { font-size: 0.75rem; color: var(--color-text-muted); margin: 4px 0 0; }

.plan-stats { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm); }
.plan-stat  { display: flex; flex-direction: column; gap: 4px; background: rgba(255,255,255,.03); border-radius: 6px; padding: 8px 10px; }
.ps-label   { font-size: 0.68rem; text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-muted); }
.ps-val     { font-size: 1.1rem; font-weight: 700; color: var(--color-text); }
.ps-val--months   { color: var(--color-primary); }
.ps-val--interest { color: var(--color-danger); }

.plan-order { display: flex; flex-direction: column; gap: 6px; }
.plan-order__title { font-size: 0.72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-muted); margin: 0; }
.plan-order__item  { display: flex; align-items: center; gap: var(--space-sm); font-size: 0.82rem; padding: 4px 0; border-bottom: 1px solid var(--color-border); }
.plan-order__item:last-child { border-bottom: none; }
.poi-priority { background: var(--color-border); border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; flex-shrink: 0; }
.poi-name     { flex: 1; color: var(--color-text); }
.poi-months   { color: var(--color-text-muted); white-space: nowrap; }

/* Tabla comparativa */
.comparison-table { margin-top: var(--space-lg); }
.comparison-title { font-size: 0.9rem; font-weight: 600; color: var(--color-text); margin: 0 0 var(--space-md); }
.ct-grid { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); overflow: hidden; }
.ct-head {
  display: grid; grid-template-columns: 1.5fr 1fr 1.5fr 1fr 1fr;
  padding: 10px var(--space-md); font-size: 0.72rem; text-transform: uppercase;
  letter-spacing: .05em; color: var(--color-text-muted);
  background: rgba(255,255,255,.03); border-bottom: 1px solid var(--color-border);
}
.ct-row {
  display: grid; grid-template-columns: 1.5fr 1fr 1.5fr 1fr 1fr;
  padding: 12px var(--space-md); border-bottom: 1px solid var(--color-border);
  font-size: 0.85rem; align-items: center;
}
.ct-row:last-child { border-bottom: none; }
.ct-row--best      { background: rgba(16,185,129,.06); }
.ct-name     { display: flex; align-items: center; gap: var(--space-sm); color: var(--color-text); font-weight: 500; }
.ct-months   { color: var(--color-primary); font-weight: 600; }
.ct-date     { color: var(--color-text-muted); }
.ct-interest { color: var(--color-danger); }
.ct-diff--more { color: var(--color-danger); }
.ct-diff--same { color: var(--color-text-muted); }
/* .best-badge → ahora es AppBadge */

/* Loading / Empty */
.loading-center { display: flex; flex-direction: column; align-items: center; gap: var(--space-sm); padding: var(--space-xl); }
.loading-text   { font-size: 0.85rem; color: var(--color-text-muted); }
.empty-state {
  text-align: center; padding: var(--space-xl); color: var(--color-text-muted);
  display: flex; flex-direction: column; align-items: center; gap: var(--space-sm);
  background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: var(--radius);
}
.empty-icon { font-size: 2rem; }

/* Los iconos-btn, modal overlay y .btn-danger ahora son AppButton/AppModal — eliminados */
/* Los form inputs del modal mantienen estilos .input/.form-row/.form-group */
.modal__desc      { color: var(--color-text-muted); font-size: 0.88rem; margin: 0; }
.form-row         { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); }
.form-group       { display: flex; flex-direction: column; gap: 6px; }
.form-group--full { grid-column: 1 / -1; }
.form-label       { font-size: 0.8rem; color: var(--color-text-muted); font-weight: 500; }
.form-hint        { font-size: 0.7rem; color: var(--color-text-muted); }

/* Tasa anual + selector fija/variable lado a lado.
   El input toma el espacio sobrante y el select queda con ancho fijo
   para que la palabra "Variable" no se corte. En 640px todo el form-row
   ya colapsa a 1 columna; aquí sólo necesitamos la fila interna. */
.rate-row             { display: flex; gap: 8px; align-items: stretch; }
.rate-row__input      { flex: 1; min-width: 0; }
.rate-row__select     { flex: 0 0 110px; }

@media (max-width: 900px) {
  .plans-grid    { grid-template-columns: 1fr; }
  .summary-strip { grid-template-columns: 1fr 1fr; }
  .ct-head, .ct-row { grid-template-columns: 1.5fr 1fr 1fr; }
  .ct-head span:nth-child(3), .ct-row .ct-date,
  .ct-head span:nth-child(5), .ct-row .ct-diff { display: none; }
}
/* Banner de alerta de deudas vencidas */
.overdue-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  background: rgba(239, 68, 68, .1);
  border: 1px solid rgba(239, 68, 68, .4);
  border-left: 4px solid var(--color-danger);
  border-radius: var(--radius);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
  color: var(--color-text);
  font-size: 0.88rem;
}
.overdue-banner__icon { font-size: 1.1rem; flex-shrink: 0; }
.overdue-banner__body { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.overdue-banner__extra {
  background: rgba(239, 68, 68, .12);
  border-radius: 4px;
  padding: 2px 8px;
  color: var(--color-danger);
}

@media (max-width: 640px) {
  .debts-view  { padding: var(--space-md); }
  .debt-stats  { grid-template-columns: 1fr 1fr; }
  .debt-card__actions { display: none; }
  .summary-strip { grid-template-columns: 1fr 1fr; }
  .form-row    { grid-template-columns: 1fr; }
}

/* Hint del tab comparador: remite a la guía de estrategias */
.strategies-hint {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  margin-bottom: var(--space-md);
  background: rgba(124, 58, 237, 0.06);
  border: 1px solid rgba(124, 58, 237, 0.2);
  border-radius: var(--radius-sm);
  font-size: 0.88rem;
  line-height: 1.4;
}
.strategies-hint__icon { font-size: 1.1rem; flex-shrink: 0; }
.strategies-hint__text { flex: 1; color: var(--color-text); }

/* Hint del modal: remite a MSI cuando la compra es sin intereses */
.debt-hint {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-start;
  padding: var(--space-sm) var(--space-md);
  margin-bottom: var(--space-md);
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  color: var(--color-text);
  line-height: 1.4;
}
.debt-hint__icon { font-size: 1.1rem; flex-shrink: 0; }
.debt-hint__text { flex: 1; }
.debt-hint__link {
  color: var(--color-primary, #3b82f6);
  font-weight: 600;
  text-decoration: underline;
}
.debt-hint__link:hover { opacity: 0.85; }
</style>
