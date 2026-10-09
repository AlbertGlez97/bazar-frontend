<template>
  <section
    v-if="allowed"
    class="agreements-page"
    data-test="agreements-page"
  >
    <TabNav
      label="Secciones de Finanzas"
      :tabs="FINANCE_TABS"
      active="/app/finanzas/acuerdos"
    />
    <header>
      <p>Finanzas</p><h1>Acuerdos de reparto</h1>
      <p>Resultados aceptados que se conservan sin editar. No registran pagos, retiros ni movimientos de dinero.</p>
      <RouterLink to="/app/finanzas/simulador">
        Ir al simulador
      </RouterLink>
    </header>
    <AppCard>
      <form
        class="agreements-filters"
        novalidate
        data-test="agreement-filters"
        @submit.prevent="refresh"
      >
        <fieldset>
          <legend>Períodos a mostrar</legend>
          <label><input
            v-model="scope"
            type="radio"
            value="all"
            name="agreement-scope"
            data-test="scope-all"
          > Todos los períodos</label>
          <label><input
            v-model="scope"
            type="radio"
            value="period"
            name="agreement-scope"
            data-test="scope-period"
          > Período exacto</label>
        </fieldset>
        <div
          v-if="scope === 'period'"
          class="agreements-range"
        >
          <AppInput
            id="agreement-from"
            v-model="range.from"
            type="date"
            label="Fecha inicial"
          />
          <AppInput
            id="agreement-to"
            v-model="range.to"
            type="date"
            label="Fecha final (incluida)"
          />
          <p>Solo se muestran acuerdos del mismo período completo, no los que se superponen.</p>
        </div>
        <div class="agreements-field">
          <label for="agreement-status">Estado</label>
          <select
            id="agreement-status"
            v-model="status"
          >
            <option value="active">
              Activos
            </option><option value="voided">
              Anulados
            </option>
          </select>
        </div>
        <AppInput
          id="agreement-folio"
          v-model="folio"
          label="Folio exacto (opcional)"
          placeholder="AC-2026-00001"
        />
        <p
          v-if="filterError"
          role="alert"
          data-test="filter-error"
        >
          {{ filterError }}
        </p>
        <AppButton
          type="submit"
          :disabled="store.loading || !online"
          data-test="apply-agreement-filters"
        >
          Consultar acuerdos
        </AppButton>
      </form>
    </AppCard>
    <p
      v-if="!online"
      role="status"
      data-test="agreements-offline"
    >
      Sin conexión. El historial mostrado es la última consulta confirmada; no se actualizará sin conexión.
    </p>
    <p
      v-if="filtersPending"
      role="status"
      data-test="agreement-filters-pending"
    >
      Cambiaste los filtros. Consulta de nuevo para aplicarlos; el historial todavía corresponde a la consulta anterior.
    </p>
    <section
      aria-labelledby="agreements-history"
      aria-live="polite"
      :aria-busy="store.loading || store.loadingMore"
    >
      <h2 id="agreements-history">
        Historial de acuerdos
      </h2>
      <p
        v-if="store.loading"
        role="status"
        data-test="agreements-loading"
      >
        Consultando acuerdos…
      </p>
      <AppAlert
        v-if="store.error"
        type="error"
        title="No se pudo consultar el historial"
        data-test="agreements-error"
      >
        <p>{{ store.error }}</p>
        <AppButton
          type="button"
          variant="ghost"
          :disabled="store.loading || !online"
          data-test="retry-agreements"
          @click="refresh"
        >
          Reintentar consulta
        </AppButton>
      </AppAlert>
      <p
        v-if="store.shown && !store.loading && !store.error && !store.items.length"
        data-test="agreements-empty"
      >
        No hay acuerdos para esta consulta.
      </p>
      <ul
        v-if="store.items.length"
        class="agreement-list"
        data-test="agreement-list"
      >
        <li
          v-for="item in store.items"
          :key="item.id"
        >
          <AppCard
            class="agreement-history-card"
            data-test="agreement-card"
          >
            <h3>
              <RouterLink :to="'/app/finanzas/acuerdos/' + item.id">
                {{ item.folio }} · {{ item.title }}
              </RouterLink>
            </h3>
            <AppBadge :color="item.status === 'voided' ? 'gray' : 'green'">
              {{ item.status === 'voided' ? 'Anulado' : 'Activo' }}
            </AppBadge>
            <p v-if="item.note">
              {{ item.note }}
            </p>
            <p>Período: {{ formatReservePeriod(item.from, item.to) }}</p>
            <p>Monto acordado: {{ formatMinorMoney(item.requestedAmountMinor) }} · Asignado: {{ formatMinorMoney(item.distributedMinor) }}</p>
            <p>{{ bpsToPercentText(item.partnerShareBps) }}% socios · {{ bpsToPercentText(item.workShareBps) }}% trabajo · {{ item.workBasis === 'WORK_SHIFTS' ? 'Jornadas' : 'Horas registradas' }}</p>
            <p>{{ item.participantCount }} personas participantes · Base financiera {{ item.financialStatus === 'partial' ? 'parcial' : 'completa' }}.</p>
            <p>Registrado: {{ formatAgreementInstant(item.receivedAt) }} (UTC−6).</p>
            <p v-if="item.voidedAt">
              Anulado: {{ formatAgreementInstant(item.voidedAt) }}. Consulta el detalle para ver el motivo.
            </p>
            <p v-if="item.replacesAgreement">
              Reemplaza a <RouterLink :to="'/app/finanzas/acuerdos/' + item.replacesAgreement.id">
                {{ item.replacesAgreement.folio }}
              </RouterLink>.
            </p>
          </AppCard>
        </li>
      </ul>
      <AppButton
        v-if="store.nextCursor"
        type="button"
        variant="secondary"
        :loading="store.loadingMore"
        :disabled="!online || store.loading || filtersPending"
        data-test="more-agreements"
        @click="store.loadMore"
      >
        Ver más acuerdos
      </AppButton>
    </section>
  </section>
  <p v-else>
    {{ AGREEMENT_ACCESS_COPY }}
  </p>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { AppAlert, AppBadge, AppButton, AppCard, AppInput, TabNav } from '@/components'
import { useFinanceAgreementsStore } from '@/stores/finance-agreements.store'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import { addDaysToKey, isValidDateKey } from '@/utils/business-time'
import { simulatorPreset, bpsToPercentText } from '@/utils/finance-distribution'
import { formatReservePeriod } from '@/utils/finance-reserves'
import { formatMinorMoney } from '@/utils/money'
import { AGREEMENT_ACCESS_COPY, formatAgreementInstant } from '@/utils/finance-agreements'
import type { AgreementFilter, AgreementStatus } from '@/types/finance-agreement.types'
import { FINANCE_TABS } from './finance-tabs'

const store = useFinanceAgreementsStore(), auth = useAuthStore(), session = useSessionStore(), mode = useUiModeStore()
const allowed = computed(() => !!auth.token && session.member?.role === 'socio' && session.member.active === true && mode.currentMode === 'gestion')
const online = ref(navigator.onLine)
const scope = ref<'all' | 'period'>('all'), status = ref<AgreementStatus>('active'), folio = ref('')
const range = reactive(simulatorPreset('mes'))
const filterError = ref('')
function query(): AgreementFilter | null {
  const filter: AgreementFilter = { status: status.value, limit: 20 }
  if (scope.value === 'period') {
    if (!isValidDateKey(range.from) || !isValidDateKey(range.to) || range.from > range.to) return null
    filter.from = range.from; filter.to = addDaysToKey(range.to, 1)
  }
  const exactFolio = folio.value.trim().toUpperCase()
  if (exactFolio) {
    if (!/^AC-[0-9]{4}-[0-9]{5,}$/.test(exactFolio)) return null
    filter.folio = exactFolio
  }
  return filter
}
const filtersPending = computed(() => !!store.shown && JSON.stringify(query()) !== JSON.stringify(store.shown))
function refresh() {
  if (!allowed.value || !online.value) return
  const filter = query()
  if (!filter) { filterError.value = 'Revisa las dos fechas del período y el formato del folio.'; return }
  filterError.value = ''
  void store.load(filter)
}
function onOnline() { online.value = true }
function onOffline() { online.value = false }
watch([allowed, () => auth.token, () => session.owner?.accountId, () => session.owner?.apiBase,
  () => session.memberId, () => session.deviceId, () => session.deviceToken], () => {
  if (!allowed.value) return
  refresh()
}, { immediate: true })
onMounted(() => { window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline) })
onUnmounted(() => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) })
</script>

<style scoped>
.agreements-page { display: grid; gap: var(--spacing-lg); max-width: 1000px; margin: 0 auto; min-width: 0; overflow-wrap: anywhere; }
.agreements-filters, .agreements-range, .agreements-field { display: grid; gap: var(--spacing-sm); }
fieldset { display: flex; flex-wrap: wrap; gap: var(--spacing-md); border: 0; padding: 0; min-width: 0; }
select { min-height: 44px; width: 100%; max-width: 320px; font: inherit; background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.agreement-list { list-style: none; display: grid; gap: var(--spacing-md); padding: 0; }
.agreement-history-card { min-width: 0; }
h3 { margin: 0 0 var(--spacing-sm); }
[role='alert'] { color: var(--color-danger); }
@media (min-width: 768px) { .agreements-range { grid-template-columns: 1fr 1fr; } .agreements-range p { grid-column: 1 / -1; } }
</style>
