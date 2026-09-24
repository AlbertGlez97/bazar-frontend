// Tests de componente para LoginView — verifica el wiring de toast.info con cryptoWarning.
// Patrón de mocks establecido aquí; Phase 5 (RegisterView) reutiliza la misma estructura.
//
// IMPORTANTE: los vi.mock deben declararse ANTES de cualquier import del componente o stores
// para que Vitest los intercepte cuando el módulo se evalúe por primera vez.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'

// ── Mocks de infraestructura ──────────────────────────────────────────────────

// Mock de vue-router — captura push sin navegación real
const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
  RouterLink: { template: '<a><slot /></a>' },
}))

// Mock del crypto.store — authStore lo instancia internamente; evita errores de módulo
vi.mock('@/stores/crypto.store', () => ({
  useCryptoStore: vi.fn(() => ({
    canRestore:     vi.fn(() => false),
    initSession:    vi.fn(() => Promise.resolve()),
    restoreSession: vi.fn(() => Promise.resolve()),
    clearSession:   vi.fn(),
    wipeSession:    vi.fn(),
    isReady:        false,
  })),
}))

// Mock del toast.store — captura llamadas a info/success/error
const toastInfoMock    = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock   = vi.fn()
vi.mock('@/stores/toast.store', () => ({
  useToastStore: () => ({
    info:    toastInfoMock,
    success: toastSuccessMock,
    error:   toastErrorMock,
  }),
}))

// ── Imports (después de los mocks) ───────────────────────────────────────────
import LoginView from '@/views/auth/LoginView.vue'
import { useAuthStore } from '@/stores/auth.store'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Stubs globales para componentes UI — evita resolución de CSS vars y dependencias internas
const globalStubs = {
  AppButton: { template: '<button type="submit"><slot /></button>' },
  AppInput:  { template: '<input />', props: ['modelValue', 'label', 'type', 'placeholder', 'disabled', 'error', 'size'] },
  AppAlert:  { template: '<div><slot /></div>', props: ['type', 'show'] },
}

// Monta LoginView con authStore controlable vía createTestingPinia.
// Precarga el formulario con valores válidos para que isFormValid=true
// y la validación no bloquee handleSubmit antes de llegar a authStore.login.
async function mountWithValidForm() {
  const wrapper = mount(LoginView, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
        }),
      ],
      stubs: globalStubs,
    },
  })

  // Inyectamos valores válidos directamente en el estado reactivo del componente.
  // En <script setup>, los refs se exponen sin .value en el proxy del componente (vm.form
  // ya es el objeto reactivo interno, no el Ref<>). Esto evita que isFormValid bloquee
  // handleSubmit antes de que llegue a invocar authStore.login.
  const vm = wrapper.vm as unknown as { form: { email: string; password: string } }
  vm.form.email    = 'user@test.com'
  vm.form.password = 'password123'
  await wrapper.vm.$nextTick()

  return wrapper
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('LoginView — wiring de toast.info con cryptoWarning', () => {
  beforeEach(() => {
    pushMock.mockClear()
    toastInfoMock.mockClear()
    toastSuccessMock.mockClear()
    toastErrorMock.mockClear()
  })

  // T1 — Happy path: login OK sin cryptoWarning → router.push llamado, toast.info NO
  it('T1 — login exitoso sin cryptoWarning: redirige sin llamar toast.info', async () => {
    const wrapper   = await mountWithValidForm()
    const authStore = useAuthStore()

    // login resuelve normalmente; cryptoWarning queda null
    authStore.login = vi.fn().mockImplementation(async () => {
      authStore.cryptoWarning = null
    })

    await wrapper.find('form').trigger('submit')
    await Promise.resolve()
    await Promise.resolve()

    expect(authStore.login).toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith({ name: 'Dashboard' })
    expect(toastInfoMock).not.toHaveBeenCalled()
  })

  // T2 — Crypto-fail path: login OK con cryptoWarning → toast.info llamado + redirect igual
  it('T2 — login exitoso con cryptoWarning: llama toast.info y redirige igual', async () => {
    const wrapper   = await mountWithValidForm()
    const authStore = useAuthStore()

    // login resuelve pero deja cryptoWarning seteado (E2EE falló)
    authStore.login = vi.fn().mockImplementation(async () => {
      authStore.cryptoWarning = 'WebCrypto no disponible'
    })

    await wrapper.find('form').trigger('submit')
    await Promise.resolve()
    await Promise.resolve()

    expect(authStore.login).toHaveBeenCalled()
    // La redirección ocurre aunque haya cryptoWarning (REQ-VIEW-LOGIN-04)
    expect(pushMock).toHaveBeenCalledWith({ name: 'Dashboard' })
    // El toast informa al usuario de forma no invasiva (R31)
    expect(toastInfoMock).toHaveBeenCalledWith('WebCrypto no disponible')
  })

  // T3 — Backend-fail path: login lanza → sin redirect, sin toast.info
  it('T3 — login fallido (backend throw): no redirige y no llama toast.info', async () => {
    const wrapper   = await mountWithValidForm()
    const authStore = useAuthStore()

    // login rechaza (credenciales incorrectas, error de red, etc.)
    authStore.login = vi.fn().mockRejectedValue(new Error('Credenciales inválidas'))
    authStore.error = 'Credenciales inválidas'

    await wrapper.find('form').trigger('submit')
    await Promise.resolve()
    await Promise.resolve()

    expect(authStore.login).toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
    expect(toastInfoMock).not.toHaveBeenCalled()
  })

  // T4 — validateEmail: email vacío → mensaje de requerido
  it('T4 — validateEmail: email vacío establece error "El correo es requerido"', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createTestingPinia()], stubs: globalStubs },
    })
    const vm = wrapper.vm as any
    vm.form.email = ''
    vm.validateEmail()
    await wrapper.vm.$nextTick()
    expect(vm.errors.email).toBe('El correo es requerido')
  })

  // T5 — validateEmail: formato inválido → mensaje de formato
  it('T5 — validateEmail: formato inválido establece error "Formato de correo inválido"', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createTestingPinia()], stubs: globalStubs },
    })
    const vm = wrapper.vm as any
    vm.form.email = 'not-an-email'
    vm.validateEmail()
    await wrapper.vm.$nextTick()
    expect(vm.errors.email).toBe('Formato de correo inválido')
  })

  // T6 — validatePassword: contraseña vacía → mensaje de requerido
  it('T6 — validatePassword: contraseña vacía establece error "La contraseña es requerida"', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createTestingPinia()], stubs: globalStubs },
    })
    const vm = wrapper.vm as any
    vm.form.password = ''
    vm.validatePassword()
    await wrapper.vm.$nextTick()
    expect(vm.errors.password).toBe('La contraseña es requerida')
  })

  // T7 — validatePassword: contraseña muy corta → mensaje de mínimo
  it('T7 — validatePassword: contraseña < 6 chars establece error "Mínimo 6 caracteres"', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createTestingPinia()], stubs: globalStubs },
    })
    const vm = wrapper.vm as any
    vm.form.password = '123'
    vm.validatePassword()
    await wrapper.vm.$nextTick()
    expect(vm.errors.password).toBe('Mínimo 6 caracteres')
  })
})
