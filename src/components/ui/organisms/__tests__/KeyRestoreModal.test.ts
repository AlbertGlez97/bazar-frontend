import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'

const restoreSessionMock = vi.fn()
const logoutMock         = vi.fn()

vi.mock('@/stores/crypto.store', () => ({
  useCryptoStore: () => ({
    error:           null,
    restoreSession:  restoreSessionMock,
  }),
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    user:   { id: 'u-1', email: 'a@b.com' },
    logout: logoutMock,
  }),
}))

import KeyRestoreModal from '@/components/ui/organisms/KeyRestoreModal.vue'

describe('KeyRestoreModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('se monta sin errores', () => {
    const wrapper = shallowMount(KeyRestoreModal)
    expect(wrapper.exists()).toBe(true)
  })

  it('handleRestore no llama a restoreSession si no hay contraseña', async () => {
    const wrapper = shallowMount(KeyRestoreModal)
    const vm = wrapper.vm as any
    vm.password = ''
    await vm.handleRestore()
    expect(restoreSessionMock).not.toHaveBeenCalled()
  })

  it('handleRestore llama a restoreSession con la contraseña y el userId', async () => {
    restoreSessionMock.mockResolvedValue(undefined)
    const wrapper = shallowMount(KeyRestoreModal)
    const vm = wrapper.vm as any
    vm.password = 'miContraseña123'
    await vm.handleRestore()
    expect(restoreSessionMock).toHaveBeenCalledWith('miContraseña123', 'u-1')
  })

  it('handleRestore limpia la contraseña si restoreSession falla', async () => {
    restoreSessionMock.mockRejectedValue(new Error('invalid key'))
    const wrapper = shallowMount(KeyRestoreModal)
    const vm = wrapper.vm as any
    vm.password = 'contraseñaMala'
    await vm.handleRestore()
    expect(vm.password).toBe('')
  })

  it('handleLogout llama a authStore.logout()', () => {
    const wrapper = shallowMount(KeyRestoreModal)
    const vm = wrapper.vm as any
    vm.handleLogout()
    expect(logoutMock).toHaveBeenCalledTimes(1)
  })
})
