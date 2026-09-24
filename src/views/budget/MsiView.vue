<template>
  <div class="msi-view">
    <div class="msi-view__header">
      <div>
        <h1 class="msi-view__title">
          Compras a Meses Sin Intereses
          <AppTooltip text="Solo para compras financiadas SIN intereses (ej: TV en 12 MSI = mismo precio dividido en 12 cuotas). El sistema resta la cuota mensual de tu ingreso disponible. Si tu deuda GENERA interés (tarjeta de crédito, préstamo personal), regístrala en el módulo de Deudas." learn-more-slug="msi-vs-deuda-revolvente" />
        </h1>
        <p class="msi-view__subtitle">
          Las parcialidades activas se descuentan automáticamente de tu ingreso disponible mensual.
        </p>
      </div>
      <AppButton variant="primary" @click="showModal = true">+ Nueva compra MSI</AppButton>
    </div>

    <!-- Lista de compras -->
    <div v-if="msiStore.loading" class="msi-view__skeleton-list">
      <AppSkeleton v-for="n in 3" :key="n" height="80px" radius="12px" />
    </div>

    <div v-else-if="msiStore.compras.length === 0" class="msi-view__empty">
      <p>💳 No tienes compras MSI registradas.</p>
      <AppButton variant="outline" size="sm" @click="showModal = true">Registrar primera compra</AppButton>
    </div>

    <div v-else class="msi-view__list">
      <AppCard
        v-for="compra in msiStore.compras"
        :key="compra.id"
        :accent="compra.status === 'active' ? 'var(--color-primary)' : 'var(--color-muted)'"
      >
        <div class="msi-card">
          <div class="msi-card__info">
            <span class="msi-card__name">{{ compra.name }}</span>
            <span v-if="compra.store" class="msi-card__store">{{ compra.store }}</span>
            <AppBadge :color="compra.status === 'active' ? 'green' : 'gray'" filled>
              {{ STATUS_LABEL[compra.status] }}
            </AppBadge>
          </div>

          <div class="msi-card__amounts">
            <div class="msi-card__amount-group">
              <span class="msi-card__label">Total</span>
              <span class="msi-card__value">{{ fmt(compra.totalAmount) }}</span>
            </div>
            <div class="msi-card__amount-group">
              <span class="msi-card__label">Cuota mensual</span>
              <span class="msi-card__value msi-card__value--monthly">{{ fmt(compra.monthlyAmount) }}</span>
            </div>
            <div class="msi-card__amount-group">
              <span class="msi-card__label">Plazo</span>
              <span class="msi-card__value">{{ compra.installments }} meses</span>
            </div>
            <div class="msi-card__amount-group">
              <span class="msi-card__label">Inicio</span>
              <span class="msi-card__value">{{ MONTHS[compra.startMonth - 1] }} {{ compra.startYear }}</span>
            </div>
          </div>

          <!-- Barra de progreso de cuotas -->
          <div v-if="compra.status === 'active'" class="msi-card__progress">
            <AppProgress
              :percent="cuotasPercent(compra)"
              color="var(--color-primary)"
              :show-label="false"
            />
            <span class="msi-card__progress-label">
              Cuota {{ cuotaActual(compra) }} de {{ compra.installments }}
            </span>
          </div>

          <div class="msi-card__actions">
            <AppButton
              v-if="compra.status === 'active'"
              variant="ghost"
              size="sm"
              @click="confirmCancel(compra.id)"
            >
              Cancelar MSI
            </AppButton>
          </div>
        </div>
      </AppCard>
    </div>

    <!-- Modal nueva compra MSI -->
    <AppModal v-model="showModal" title="Nueva compra MSI" size="md">
      <form class="msi-form" @submit.prevent="handleSubmit">
        <AppInput
          v-model="form.name"
          label="Descripción de la compra"
          placeholder='ej: TV Samsung 55"'
          :error="errors.name"
        />
        <AppInput
          v-model="form.store"
          label="Tienda (opcional)"
          placeholder="ej: Liverpool"
        />
        <AppInput
          v-model.number="form.totalAmount"
          label="Monto total"
          type="number"
          placeholder="12000"
          :error="errors.totalAmount"
        />
        <AppInput
          v-model.number="form.installments"
          label="Número de meses"
          type="number"
          placeholder="12"
          :error="errors.installments"
        />

        <div class="msi-form__row">
          <AppSelect v-model.number="form.startMonth" label="Mes de inicio">
            <option v-for="(m, i) in MONTHS" :key="i" :value="i + 1">{{ m }}</option>
          </AppSelect>
          <AppInput
            v-model.number="form.startYear"
            label="Año de inicio"
            type="number"
            placeholder="2026"
          />
        </div>

        <!-- Preview de cuota mensual -->
        <div v-if="form.totalAmount > 0 && form.installments > 1" class="msi-form__preview">
          <span>Cuota mensual estimada:</span>
          <strong>{{ fmt(form.totalAmount / form.installments) }}</strong>
        </div>

        <div class="msi-form__actions">
          <AppButton type="button" variant="ghost" @click="showModal = false">Cancelar</AppButton>
          <AppButton type="submit" variant="primary" :loading="submitting">Registrar</AppButton>
        </div>
      </form>
    </AppModal>

    <!-- Modal confirmación cancelar -->
    <AppModal v-model="showCancelModal" title="Cancelar compra MSI" size="sm">
      <p>¿Estás seguro? La compra dejará de descontarse del ingreso disponible.</p>
      <div class="msi-form__actions">
        <AppButton variant="ghost" @click="showCancelModal = false">No</AppButton>
        <AppButton variant="danger" :loading="cancelling" @click="doCancel">Sí, cancelar</AppButton>
      </div>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useMsiStore } from '@/stores/msi.store'
import AppButton   from '@/components/ui/atoms/AppButton.vue'
import AppInput    from '@/components/ui/atoms/AppInput.vue'
import AppSelect   from '@/components/ui/atoms/AppSelect.vue'
import AppBadge    from '@/components/ui/atoms/AppBadge.vue'
import AppProgress from '@/components/ui/atoms/AppProgress.vue'
import AppSkeleton from '@/components/ui/atoms/AppSkeleton.vue'
import AppCard     from '@/components/ui/organisms/AppCard.vue'
import AppModal    from '@/components/ui/organisms/AppModal.vue'
import AppTooltip  from '@/components/ui/atoms/AppTooltip.vue'
import type { MsiPurchase } from '@/types/msi.types'

const msiStore = useMsiStore()

const showModal       = ref(false)
const showCancelModal = ref(false)
const submitting      = ref(false)
const cancelling      = ref(false)
const cancelTargetId  = ref<string | null>(null)

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const STATUS_LABEL: Record<string, string> = {
  active:    'Activa',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

const today = new Date()

const form = reactive({
  name:         '',
  store:        '',
  totalAmount:  0,
  installments: 12,
  startYear:    today.getFullYear(),
  startMonth:   today.getMonth() + 1,
})

const errors = reactive({ name: '', totalAmount: '', installments: '' })

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}

function cuotaActual(compra: MsiPurchase): number {
  const now    = today.getFullYear() * 12 + today.getMonth() + 1
  const inicio = compra.startYear * 12 + compra.startMonth
  return Math.min(Math.max(now - inicio + 1, 1), compra.installments)
}

function cuotasPercent(compra: MsiPurchase): number {
  return Math.round((cuotaActual(compra) / compra.installments) * 100)
}

function validateForm(): boolean {
  errors.name         = form.name.trim()   ? '' : 'Requerido'
  errors.totalAmount  = form.totalAmount > 0 ? '' : 'Debe ser mayor a 0'
  errors.installments = form.installments >= 2 ? '' : 'Mínimo 2 meses'
  return !errors.name && !errors.totalAmount && !errors.installments
}

async function handleSubmit() {
  if (!validateForm()) return
  submitting.value = true
  try {
    await msiStore.create({
      name:         form.name.trim(),
      store:        form.store.trim() || undefined,
      totalAmount:  form.totalAmount,
      installments: form.installments,
      startYear:    form.startYear,
      startMonth:   form.startMonth,
    })
    showModal.value  = false
    Object.assign(form, { name: '', store: '', totalAmount: 0, installments: 12 })
  } finally {
    submitting.value = false
  }
}

function confirmCancel(id: string) {
  cancelTargetId.value  = id
  showCancelModal.value = true
}

async function doCancel() {
  if (!cancelTargetId.value) return
  cancelling.value = true
  try {
    await msiStore.remove(cancelTargetId.value)
    showCancelModal.value = false
  } finally {
    cancelling.value     = false
    cancelTargetId.value = null
  }
}

onMounted(() => msiStore.fetchAll())
</script>

<style scoped>
.msi-view { display: flex; flex-direction: column; gap: var(--spacing-lg); }

.msi-view__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.msi-view__title    { font-size: 1.5rem; font-weight: 700; margin: 0; display: inline-flex; align-items: center; gap: 6px; }
.msi-view__subtitle { color: var(--color-muted); margin: 4px 0 0; font-size: 0.9rem; }

.msi-view__skeleton-list { display: flex; flex-direction: column; gap: var(--spacing-md); }

.msi-view__empty {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.msi-view__list { display: flex; flex-direction: column; gap: var(--spacing-md); }

.msi-card { display: flex; flex-direction: column; gap: var(--spacing-sm); }

.msi-card__info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.msi-card__name  { font-weight: 600; font-size: 1rem; }
.msi-card__store { color: var(--color-muted); font-size: 0.875rem; }

.msi-card__amounts {
  display: flex;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
}

.msi-card__amount-group { display: flex; flex-direction: column; gap: 2px; }
.msi-card__label        { font-size: 0.75rem; color: var(--color-muted); text-transform: uppercase; }
.msi-card__value        { font-size: 0.95rem; font-weight: 500; }
.msi-card__value--monthly { color: var(--color-danger); font-weight: 700; }

.msi-card__progress { display: flex; align-items: center; gap: var(--spacing-sm); }
.msi-card__progress-label { font-size: 0.8rem; color: var(--color-muted); white-space: nowrap; }

.msi-card__actions { display: flex; justify-content: flex-end; }

.msi-form         { display: flex; flex-direction: column; gap: var(--spacing-md); }
.msi-form__row    { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); }

.msi-form__preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
}

.msi-form__preview strong { color: var(--color-primary); font-size: 1.1rem; }

.msi-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}
</style>
