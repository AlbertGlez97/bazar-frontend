// Tests de componente para RegisterView (wizard Fase C).
// Cubre el flow: paso 1 (datos) → initSession → paso 2 (kit) → paso 3 (confirm)
// → authStore.register con payload completo incluyendo material crypto.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'

// ── Mocks de infraestructura ──────────────────────────────────────────────────
const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter:  () => ({ push: pushMock }),
  RouterLink: { template: '<a><slot /></a>' },
}))

// Material mock que el cryptoStore retorna desde initSession.
const MOCK_MATERIAL = {
  recoveryPhrase: [
    'ábaco', 'abdomen', 'abeja', 'abierto', 'abogado', 'abono',
    'aborto', 'abrazo', 'abrir', 'abuelo', 'abuso', 'acabar',
  ],
  saltPassword:       'salt-p',
  wrappedDekPassword: { iv: 'iv-p', ct: 'ct-p' },
  saltRecovery:       'salt-r',
  wrappedDekRecovery: { iv: 'iv-r', ct: 'ct-r' },
}
const initSessionMock = vi.fn(() => Promise.resolve(MOCK_MATERIAL))
const clearSessionMock = vi.fn()
vi.mock('@/stores/crypto.store', () => ({
  useCryptoStore: vi.fn(() => ({
    canRestore:          vi.fn(() => false),
    initSession:         initSessionMock,
    persistPasswordCache: vi.fn(),
    restoreSession:      vi.fn(),
    clearSession:        clearSessionMock,
    wipeSession:         vi.fn(),
    isReady:             false,
  })),
}))

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

// Imports después de los mocks
import RegisterView from '@/views/auth/RegisterView.vue'
import { useAuthStore } from '@/stores/auth.store'

// Stubs que emiten lo necesario para simular interacciones del wizard sin
// depender del CSS/lógica de los hijos reales.
const globalStubs = {
  AppButton: {
    template: '<button type="submit" @click="$emit(\'click\', $event)"><slot /></button>',
    props:    ['tag', 'to', 'variant', 'size', 'block', 'loading', 'disabled', 'type'],
  },
  AppInput: {
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props:    ['modelValue', 'label', 'type', 'placeholder', 'autocomplete', 'disabled', 'error', 'size'],
  },
  AppAlert:           { template: '<div><slot /></div>', props: ['type', 'show'] },
  EmergencyKit:       { template: '<div class="stub-kit">kit</div>', props: ['phrase', 'email'] },
  PhraseConfirmation: {
    template: `<div class="stub-phrase">
      <button @click="$emit(\'confirmed\')" class="stub-phrase__confirm">confirm</button>
      <button @click="$emit(\'request-reshow\')" class="stub-phrase__back">back</button>
    </div>`,
    props:    ['phrase'],
  },
}

function mountWizard() {
  const wrapper = mount(RegisterView, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })],
      stubs:   globalStubs,
    },
  })

  // Setear datos válidos del paso 1 directamente en el ref del componente.
  const vm = wrapper.vm as unknown as {
    form: { name: string; email: string; password: string; confirm: string }
  }
  vm.form.name     = 'Alberto González'
  vm.form.email    = 'user@test.com'
  vm.form.password = 'password123'
  vm.form.confirm  = 'password123'
  return wrapper
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('RegisterView — wizard Fase C', () => {
  beforeEach(() => {
    pushMock.mockClear()
    initSessionMock.mockClear()
    clearSessionMock.mockClear()
    toastInfoMock.mockClear()
    toastSuccessMock.mockClear()
    toastErrorMock.mockClear()
  })

  it('paso 1 submit con datos válidos → llama cryptoStore.initSession con el password', async () => {
    const wrapper = mountWizard()
    await wrapper.vm.$nextTick()

    await wrapper.find('form').trigger('submit')
    await new Promise(r => setTimeout(r, 0))

    expect(initSessionMock).toHaveBeenCalledWith('password123')
  })

  it('emit confirmed desde PhraseConfirmation → authStore.register con payload + material + redirige', async () => {
    const wrapper   = mountWizard()
    const authStore = useAuthStore()
    authStore.register = vi.fn().mockResolvedValue(undefined)

    // Avanzar al paso 3 seteando state interno (evita pilotar la UI entera en tests)
    const vm = wrapper.vm as unknown as {
      step:     { value?: number } | number
      material: { value?: unknown } | unknown
    }
    // step y material son refs — usamos .value si están envueltos, o directo
    if (typeof vm.step === 'number') {
      ;(vm as any).step = 3
      ;(vm as any).material = MOCK_MATERIAL
    } else {
      (vm.step as any).value = 3
      ;(vm.material as any).value = MOCK_MATERIAL
    }
    await wrapper.vm.$nextTick()

    // Disparar el emit 'confirmed' del stub de PhraseConfirmation
    const confirmBtn = wrapper.find('.stub-phrase__confirm')
    await confirmBtn.trigger('click')
    await new Promise(r => setTimeout(r, 0))
    await new Promise(r => setTimeout(r, 0))

    expect(authStore.register).toHaveBeenCalledWith(
      expect.objectContaining({
        name:               'Alberto González',
        email:              'user@test.com',
        password:           'password123',
        saltPassword:       'salt-p',
        wrappedDekPassword: { iv: 'iv-p', ct: 'ct-p' },
        saltRecovery:       'salt-r',
        wrappedDekRecovery: { iv: 'iv-r', ct: 'ct-r' },
      }),
    )
    expect(pushMock).toHaveBeenCalledWith({ name: 'Dashboard' })
  })

  it('si authStore.register falla → NO redirige (el wizard mantiene al usuario en paso 3)', async () => {
    const wrapper   = mountWizard()
    const authStore = useAuthStore()
    authStore.register = vi.fn().mockRejectedValue(new Error('Email ya registrado'))

    const vm = wrapper.vm as unknown as any
    if (typeof vm.step === 'number') {
      vm.step = 3
      vm.material = MOCK_MATERIAL
    } else {
      vm.step.value = 3
      vm.material.value = MOCK_MATERIAL
    }
    await wrapper.vm.$nextTick()

    await wrapper.find('.stub-phrase__confirm').trigger('click')
    await new Promise(r => setTimeout(r, 0))
    await new Promise(r => setTimeout(r, 0))

    expect(authStore.register).toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })
})
