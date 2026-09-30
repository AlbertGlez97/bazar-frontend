import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DeviceList from '../DeviceList.vue'
import type { ManagedDevice } from '@/types/device.types'

const base = { createdAt: '2026-09-25T18:00:00.000Z', activatedAt: null, revokedAt: null }
const devices: ManagedDevice[] = [
  { ...base, id: 'd-1', name: 'Mostrador', status: 'activo', legacy: false },
  { ...base, id: 'd-2', name: 'Tablet vieja', status: 'activo', legacy: true },
  { ...base, id: 'd-3', name: 'Teléfono de Ana', status: 'pendiente_activacion', legacy: false, identifier: '0190-codigo-3' },
  { ...base, id: 'd-4', name: 'Perdido', status: 'revocado', legacy: false },
]

function mountList(props: Record<string, unknown> = {}) {
  return mount(DeviceList, { props: { devices, ...props } })
}
type Wrapper = ReturnType<typeof mountList>
const rows = (w: Wrapper) => w.findAll('li.device-list__item')
const action = (w: Wrapper, label: string) => w.find(`button[aria-label="${label}"]`)
const actionLabels = (row: ReturnType<Wrapper['findAll']>[number]) => row.findAll('button').map((b) => b.attributes('aria-label'))

describe('DeviceList — presentación', () => {
  it('es una lista con nombre accesible, una fila por dispositivo y en el orden recibido', () => {
    const w = mountList()
    expect(w.get('ul').attributes('aria-label')).toBe('Dispositivos del negocio')
    expect(rows(w).map((r) => r.get('.device-list__name').text())).toEqual(['Mostrador', 'Tablet vieja', 'Teléfono de Ana', 'Perdido'])
  })

  it('el estado se lee en texto (no solo por color)', () => {
    const w = mountList()
    expect(rows(w).map((r) => r.get('.device-list__status').text())).toEqual([
      'Activo', 'Activo', 'Pendiente de activar', 'Revocado',
    ])
  })

  it('un dispositivo heredado (sin token) lo dice con honestidad y sugiere reemitir', () => {
    const w = mountList()
    expect(rows(w)[1].get('.device-list__legacy').text()).toMatch(/sin token/i)
    expect(rows(w)[1].get('.device-list__legacy').text()).toMatch(/reemit/i)
    expect(rows(w)[0].find('.device-list__legacy').exists()).toBe(false)
    expect(rows(w)[2].find('.device-list__legacy').exists()).toBe(false)
  })

  it('marca "Este dispositivo" en el que se está usando', () => {
    const w = mountList({ currentDeviceId: 'd-1' })
    expect(rows(w)[0].get('.device-list__current').text()).toBe('Este dispositivo')
    expect(rows(w)[1].find('.device-list__current').exists()).toBe(false)
  })

  it('sin currentDeviceId ninguno se marca', () => {
    expect(mountList().find('.device-list__current').exists()).toBe(false)
  })

  it('no muestra ids ni el código en pantalla (el código solo se copia)', () => {
    const text = mountList().text()
    expect(text).not.toContain('d-3')
    expect(text).not.toContain('0190-codigo-3')
  })

  it('sin dispositivos muestra un mensaje en vez de una lista vacía', () => {
    const w = mountList({ devices: [] })
    expect(w.find('ul').exists()).toBe(false)
    expect(w.text()).toContain('Todavía no hay dispositivos registrados.')
  })
})

describe('DeviceList — acciones por estado', () => {
  it('activo: Reemitir y Revocar', () => {
    const w = mountList()
    expect(actionLabels(rows(w)[0])).toEqual(['Reemitir Mostrador', 'Revocar Mostrador'])
    expect(actionLabels(rows(w)[1])).toEqual(['Reemitir Tablet vieja', 'Revocar Tablet vieja'])
  })

  it('pendiente: Copiar código, Reemitir y Revocar', () => {
    const w = mountList()
    expect(actionLabels(rows(w)[2])).toEqual(['Copiar código de Teléfono de Ana', 'Reemitir Teléfono de Ana', 'Revocar Teléfono de Ana'])
  })

  it('pendiente sin identifier (ya no viene): no ofrece copiar', () => {
    const w = mountList({ devices: [{ ...devices[2], identifier: undefined }] })
    expect(actionLabels(rows(w)[0])).toEqual(['Reemitir Teléfono de Ana', 'Revocar Teléfono de Ana'])
  })

  it('revocado: solo Reemitir (revocar de nuevo no tiene sentido)', () => {
    const w = mountList()
    expect(actionLabels(rows(w)[3])).toEqual(['Reemitir Perdido'])
  })

  it('cada botón lleva el nombre del dispositivo para distinguirlos con lector de pantalla', () => {
    const w = mountList()
    for (const button of w.findAll('button')) {
      expect(button.attributes('aria-label')).toMatch(/Mostrador|Tablet vieja|Teléfono de Ana|Perdido/)
    }
  })

  it('los botones son de tipo button (no envían formularios)', () => {
    for (const button of mountList().findAll('button')) expect(button.attributes('type')).toBe('button')
  })

  it('emiten el dispositivo completo', async () => {
    const w = mountList()
    await action(w, 'Revocar Mostrador').trigger('click')
    await action(w, 'Reemitir Tablet vieja').trigger('click')
    await action(w, 'Copiar código de Teléfono de Ana').trigger('click')
    expect(w.emitted('revoke')![0]).toEqual([devices[0]])
    expect(w.emitted('reissue')![0]).toEqual([devices[1]])
    expect(w.emitted('copy-code')![0]).toEqual([devices[2]])
  })

  it('con busy: todas las acciones quedan deshabilitadas', () => {
    const w = mountList({ busy: true })
    expect(w.findAll('button').every((b) => b.attributes('disabled') !== undefined)).toBe(true)
  })
})
