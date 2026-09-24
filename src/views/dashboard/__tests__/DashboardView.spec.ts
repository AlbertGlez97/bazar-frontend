// Tests de componente para DashboardView — verifica el banner de estado degradado E2EE.
// Strict TDD: tests RED escritos antes de la implementación del banner.
//
// IMPORTANTE: vi.mock debe declararse ANTES de cualquier import del componente
// para que Vitest lo intercepte en la primera evaluación del módulo.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'

// ── Mocks de infraestructura ──────────────────────────────────────────────────

// Mock de vue-router — evita navegación real
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute:  () => ({ params: {}, query: {} }),
}))

// Mock de crypto.store — evita errores de módulo al instanciar stores internos
vi.mock('@/stores/crypto.store', () => ({
  useCryptoStore: vi.fn(() => ({
    isReady:    true,
    canRestore: vi.fn(() => false),
    encrypt:    vi.fn(),
    decrypt:    vi.fn(),
  })),
}))

// Mock de auth.store — evita dependencias de sesión
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 'user-1' },
  })),
}))

// Mock de budget.store — evita fetchAll real
vi.mock('@/stores/budget.store', () => ({
  useBudgetStore: vi.fn(() => ({
    budgets:  [],
    fetchAll: vi.fn(),
  })),
}))

// ── Imports (después de los mocks) ───────────────────────────────────────────
import DashboardView from '@/views/dashboard/DashboardView.vue'
import { AppAlert } from '@/components'

// ── Constante de copia (misma que en el componente — assertamos el valor real) ──
const BANNER_DEGRADED_COPY = 'Datos protegidos. Desbloqueá tu cifrado para visualizar tu información.'

// ── Stubs globales para UI atoms ─────────────────────────────────────────────
const globalStubs = {
  AppButton: { template: '<button><slot /></button>' },
  AppBadge:  { template: '<span><slot /></span>' },
}

// ── Helper: monta DashboardView con degraded controlable ─────────────────────
// degraded es DeepReadonly en el store — lo sobreescribimos con Object.defineProperty
// después de instanciar el store y antes del mount del componente.
import { useDashboardStore } from '@/stores/dashboard.store'
import { setActivePinia } from 'pinia'

function mountViewWithDegraded(degradedValue: boolean) {
  const pinia = createTestingPinia({
    createSpy:   vi.fn,
    stubActions: true,
  })
  setActivePinia(pinia)

  // Instanciar el store ANTES del mount para poder parchear degraded
  const store = useDashboardStore()
  // degraded es DeepReadonly<Ref<boolean>> — necesitamos bypassear el readonly
  Object.defineProperty(store, 'degraded', {
    get: () => degradedValue,
    configurable: true,
  })

  return mount(DashboardView, {
    global: {
      plugins: [pinia],
      stubs:   globalStubs,
    },
  })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('DashboardView — banner de estado degradado E2EE', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // RED-DV-01: banner visible cuando store.degraded === true
  it('RED-DV-01: DashboardView renders AppAlert with BANNER_DEGRADED_COPY when dashboardStore.degraded=true', () => {
    const wrapper = mountViewWithDegraded(true)

    // El componente AppAlert debe existir en el DOM
    const alert = wrapper.findComponent(AppAlert)
    expect(alert.exists()).toBe(true)

    // El texto del banner debe coincidir con la constante de copia
    expect(alert.text()).toContain(BANNER_DEGRADED_COPY)
  })

  // RED-DV-02: banner oculto cuando store.degraded === false
  it('RED-DV-02: DashboardView does NOT render AppAlert when dashboardStore.degraded=false', () => {
    const wrapper = mountViewWithDegraded(false)

    // Buscamos el AppAlert que contiene el texto del banner específicamente
    const alerts = wrapper.findAllComponents(AppAlert)
    const bannerAlert = alerts.find(a => a.text().includes(BANNER_DEGRADED_COPY))
    expect(bannerAlert).toBeUndefined()
  })

  // RED-DV-03: el AppAlert del banner tiene type="warning"
  it('RED-DV-03: DashboardView AppAlert has type="warning"', () => {
    const wrapper = mountViewWithDegraded(true)

    const alert = wrapper.findComponent(AppAlert)
    expect(alert.exists()).toBe(true)
    expect(alert.props('type')).toBe('warning')
  })
})
