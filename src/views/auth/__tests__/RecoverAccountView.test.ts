import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'

const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
  RouterLink: { template: '<a><slot /></a>' },
}))

const recoverInitMock     = vi.fn()
const recoverCompleteMock = vi.fn()
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    error: null,
    recoverInit:     recoverInitMock,
    recoverComplete: recoverCompleteMock,
  }),
}))

const recoverWithPhraseMock = vi.fn()
const clearSessionMock      = vi.fn()
vi.mock('@/stores/crypto.store', () => ({
  useCryptoStore: () => ({
    error:              null,
    recoverWithPhrase:  recoverWithPhraseMock,
    clearSession:       clearSessionMock,
  }),
}))

vi.mock('@/stores/toast.store', () => ({
  useToastStore: () => ({
    success: vi.fn(),
    error:   vi.fn(),
  }),
}))

vi.mock('@/components', () => ({
  AppButton: { template: '<button @click="$emit(\'click\')"><slot /></button>', emits: ['click'] },
  AppInput:  { template: '<input />' },
  AppAlert:  { template: '<div><slot /></div>' },
}))

// Mock de crypto.service para normalizeRecoveryPhrase
vi.mock('@/services/crypto.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/crypto.service')>()
  return { default: actual.default }
})

import RecoverAccountView from '@/views/auth/RecoverAccountView.vue'

describe('RecoverAccountView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('se monta en el paso 1 por defecto', () => {
    const wrapper = shallowMount(RecoverAccountView)
    expect((wrapper.vm as any).step).toBe(1)
  })

  // ── Paso 1: email ─────────────────────────────────────────────────────

  it('isValidEmail es false con email vacío', () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    expect(vm.isValidEmail).toBe(false)
  })

  it('isValidEmail es true con email válido', () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.email = 'usuario@ejemplo.com'
    expect(vm.isValidEmail).toBe(true)
  })

  it('validateEmail setea error si email vacío', () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.validateEmail()
    expect(vm.emailError).toBe('El correo es requerido')
  })

  it('validateEmail setea error si email inválido', () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.email = 'no-es-email'
    vm.validateEmail()
    expect(vm.emailError).toBe('Formato de correo inválido')
  })

  it('validateEmail no setea error con email válido', () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.email = 'a@b.com'
    vm.validateEmail()
    expect(vm.emailError).toBe('')
  })

  it('handleInitRecovery no avanza si el email es inválido', async () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    await vm.handleInitRecovery()
    expect(recoverInitMock).not.toHaveBeenCalled()
    expect(vm.step).toBe(1)
  })

  it('handleInitRecovery avanza al paso 2 si recoverInit tiene éxito', async () => {
    recoverInitMock.mockResolvedValue({ saltRecovery: 'salt', wrappedDekRecovery: 'wrapped' })
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.email = 'a@b.com'
    await vm.handleInitRecovery()
    expect(vm.step).toBe(2)
    expect(vm.recoveryMaterial).not.toBeNull()
  })

  // ── Paso 2: frase ─────────────────────────────────────────────────────

  it('handlePhraseInput no muestra warning con input vacío', () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.phraseInput = ''
    vm.handlePhraseInput()
    expect(vm.phraseWarning).toBe('')
  })

  it('handlePhraseInput muestra cuántas palabras faltan cuando hay menos de 12', () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.phraseInput = 'hola mundo'
    vm.handlePhraseInput()
    expect(vm.phraseWarning).toContain('Faltan')
  })

  it('phraseReady es false con menos de 12 palabras', () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.phraseInput = 'uno dos tres'
    expect(vm.phraseReady).toBe(false)
  })

  it('verifyPhrase vuelve al paso 1 si no hay recoveryMaterial', async () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.recoveryMaterial = null
    await vm.verifyPhrase()
    expect(vm.step).toBe(1)
  })

  it('verifyPhrase avanza al paso 3 si recoverWithPhrase tiene éxito', async () => {
    recoverWithPhraseMock.mockResolvedValue(undefined)
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.recoveryMaterial = { saltRecovery: 'salt', wrappedDekRecovery: 'wrapped' }
    await vm.verifyPhrase()
    expect(vm.step).toBe(3)
  })

  it('verifyPhrase setea phraseError si recoverWithPhrase falla', async () => {
    recoverInitMock.mockResolvedValue({ saltRecovery: 'salt', wrappedDekRecovery: 'wrapped' })
    recoverWithPhraseMock.mockRejectedValue(new Error('invalid'))

    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any

    // Ir al paso 2 mediante el flujo real
    vm.email = 'a@b.com'
    await vm.handleInitRecovery()
    expect(vm.step).toBe(2)

    // Intentar verificar — falla
    await vm.verifyPhrase()
    expect(vm.phraseError).toBeTruthy()
  })

  it('goToStep1 limpia el estado y vuelve al paso 1', async () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.step = 2
    vm.phraseInput = 'algo'
    vm.recoveryMaterial = { saltRecovery: 'x', wrappedDekRecovery: 'y' }
    vm.goToStep1()
    expect(vm.step).toBe(1)
    expect(vm.phraseInput).toBe('')
    expect(vm.recoveryMaterial).toBeNull()
    expect(clearSessionMock).toHaveBeenCalledTimes(1)
  })

  // ── Paso 3: nueva contraseña ──────────────────────────────────────────

  it('validatePassword setea error si contraseña vacía', () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.validatePassword()
    expect(vm.passwordError).toBe('La contraseña es requerida')
  })

  it('validatePassword setea error si contraseña corta', () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.newPassword = '1234567'
    vm.validatePassword()
    expect(vm.passwordError).toBe('Mínimo 8 caracteres')
  })

  it('validateConfirm setea error si contraseñas no coinciden', () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.newPassword     = 'password123'
    vm.confirmPassword = 'diferente123'
    vm.validateConfirm()
    expect(vm.confirmError).toBe('Las contraseñas no coinciden')
  })

  it('passwordsReady es true cuando contraseñas coinciden y tienen 8+ chars', () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.newPassword     = 'contraseña123'
    vm.confirmPassword = 'contraseña123'
    expect(vm.passwordsReady).toBe(true)
  })

  it('handleReset no llama a recoverComplete si contraseñas son inválidas', async () => {
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    await vm.handleReset()
    expect(recoverCompleteMock).not.toHaveBeenCalled()
  })

  it('handleReset llama a recoverComplete y redirige a Dashboard', async () => {
    recoverCompleteMock.mockResolvedValue(undefined)
    const wrapper = shallowMount(RecoverAccountView)
    const vm = wrapper.vm as any
    vm.email           = 'a@b.com'
    vm.newPassword     = 'contraseña123'
    vm.confirmPassword = 'contraseña123'
    await vm.handleReset()
    expect(recoverCompleteMock).toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith({ name: 'Dashboard' })
  })
})
