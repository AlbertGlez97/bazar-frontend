import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SelectContextView from '../SelectContextView.vue'
import DevicesService from '@/services/devices.service'
import MembersService from '@/services/members.service'
import { useSessionStore } from '@/stores/session.store'
import { useToastStore } from '@/stores/toast.store'
import type { Member } from '@/types/member.types'

vi.mock('@/services/devices.service', () => ({ default: { identify: vi.fn() } }))
vi.mock('@/services/members.service', () => ({ default: { list: vi.fn() } }))

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const members: Member[] = [
  { id: 'm-1', name: 'Alberto', role: 'socio', active: true },
  { id: 'm-2', name: 'Carlos', role: 'colaborador', active: true },
]

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('SelectContextView', () => {
  it('sin dispositivo identificado, muestra el formulario de identificación', () => {
    const wrapper = mount(SelectContextView)
    expect(wrapper.find('form').exists()).toBe(true)
    expect(MembersService.list).not.toHaveBeenCalled()
  })

  it('identifica el dispositivo, lo persiste y continúa automáticamente al selector', async () => {
    vi.mocked(DevicesService.identify).mockResolvedValue({ deviceId: 'd-1' })
    vi.mocked(MembersService.list).mockResolvedValue(members)

    const wrapper = mount(SelectContextView)
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('shared-tablet')
    await inputs[1].setValue('Shared tablet')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(DevicesService.identify).toHaveBeenCalledExactlyOnceWith({
      identifier: 'shared-tablet', name: 'Shared tablet',
    })

    const session = useSessionStore()
    expect(session.deviceId).toBe('d-1')
    expect(JSON.parse(localStorage.getItem('device_context') ?? 'null')).toEqual({
      deviceId: 'd-1', identifier: 'shared-tablet', name: 'Shared tablet',
    })

    // Ya identificado el dispositivo, debe mostrar el selector de persona
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Alberto')
  })

  it('si el dispositivo no está autorizado (403), muestra un mensaje claro y no continúa', async () => {
    vi.mocked(DevicesService.identify).mockRejectedValue({ response: { status: 403 } })

    const wrapper = mount(SelectContextView)
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('unknown')
    await inputs[1].setValue('Unknown')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('no está autorizado')
    expect(MembersService.list).not.toHaveBeenCalled()
    expect(useSessionStore().isDeviceIdentified).toBe(false)
  })

  it('con dispositivo ya identificado, carga y muestra la lista de members', async () => {
    localStorage.setItem('device_context', JSON.stringify({
      deviceId: 'd-1', identifier: 'shared-tablet', name: 'Shared tablet',
    }))
    vi.mocked(MembersService.list).mockResolvedValue(members)

    const wrapper = mount(SelectContextView)
    await flushPromises()

    expect(MembersService.list).toHaveBeenCalledOnce()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Alberto')
    expect(wrapper.text()).toContain('Carlos')
  })

  it('al elegir una persona, la guarda en el session store y redirige a /app', async () => {
    localStorage.setItem('device_context', JSON.stringify({
      deviceId: 'd-1', identifier: 'shared-tablet', name: 'Shared tablet',
    }))
    vi.mocked(MembersService.list).mockResolvedValue(members)

    const wrapper = mount(SelectContextView)
    await flushPromises()

    const cards = wrapper.findAll('[role="listitem"]')
    await cards[0].trigger('click')

    const session = useSessionStore()
    expect(session.memberId).toBe('m-1')
    expect(JSON.parse(sessionStorage.getItem('member_context') ?? 'null')).toEqual(members[0])
    expect(push).toHaveBeenCalledExactlyOnceWith({ name: 'AppHome' })
  })

  it('si falla la carga de members, notifica por toast', async () => {
    localStorage.setItem('device_context', JSON.stringify({
      deviceId: 'd-1', identifier: 'shared-tablet', name: 'Shared tablet',
    }))
    vi.mocked(MembersService.list).mockRejectedValue(new Error('offline'))

    mount(SelectContextView)
    await flushPromises()

    const toast = useToastStore()
    expect(toast.toasts).toHaveLength(1)
    expect(toast.toasts[0]).toMatchObject({
      type: 'error', message: 'No se pudo cargar la lista de personas, intenta de nuevo',
    })
  })
})
