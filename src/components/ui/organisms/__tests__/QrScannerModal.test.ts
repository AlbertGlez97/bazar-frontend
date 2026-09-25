import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QrScannerError } from '@/services/qr-scanner'

// El adaptador (cámara + WASM) se sustituye: en jsdom no hay cámara. Se conserva
// el antirrebote real para probar que el componente lo usa.
const { startQrScanner, getScanSupport } = vi.hoisted(() => ({
  startQrScanner: vi.fn(),
  getScanSupport: vi.fn(() => 'ok'),
}))
vi.mock('@/services/qr-scanner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/qr-scanner')>()),
  startQrScanner,
  getScanSupport,
}))

import QrScannerModal from '../QrScannerModal.vue'

interface Session {
  stop: ReturnType<typeof vi.fn>
  onDecode: (text: string) => void
}

/** Cada arranque de cámara deja aquí su sesión para que el test "lea" códigos. */
let sessions: Session[] = []

function cameraWorks() {
  startQrScanner.mockImplementation(async (_video: HTMLVideoElement, onDecode: (text: string) => void) => {
    const session: Session = { stop: vi.fn(), onDecode }
    sessions.push(session)
    return { stop: session.stop }
  })
}

function mountModal(props: { modelValue?: boolean; feedback?: { kind: 'success' | 'warning'; text: string } | null } = {}) {
  return mount(QrScannerModal, {
    props: { modelValue: true, ...props },
    global: { stubs: { teleport: true } },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-25T10:00:00Z'))
  sessions = []
  startQrScanner.mockReset()
  getScanSupport.mockReset()
  getScanSupport.mockReturnValue('ok')
  cameraWorks()
})
afterEach(() => vi.useRealTimers())

describe('QrScannerModal — arranque y estados', () => {
  it('abre la cámara al mostrarse y pinta el video con su instrucción', async () => {
    const wrapper = mountModal()
    expect(wrapper.text()).toContain('Abriendo la cámara')
    await flushPromises()

    expect(startQrScanner).toHaveBeenCalledTimes(1)
    expect(startQrScanner.mock.calls[0][0]).toBeInstanceOf(HTMLVideoElement)
    expect(wrapper.text()).toContain('Apunta la cámara al código QR del producto.')
    expect(wrapper.text()).not.toContain('Abriendo la cámara')
    expect(wrapper.get('video').attributes('aria-label')).toBeTruthy()
  })

  it('cerrado no pide la cámara', async () => {
    mountModal({ modelValue: false })
    await flushPromises()
    expect(startQrScanner).not.toHaveBeenCalled()
  })

  it('al abrirse después de estar cerrado arranca la cámara', async () => {
    const wrapper = mountModal({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(startQrScanner).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['permission-denied', /permiso/],
    ['no-camera', /No encontramos una cámara/],
    ['camera-busy', /Otra aplicación/],
    ['unsupported', /no puede leer códigos QR/],
    ['unknown', /No pudimos abrir la cámara/],
  ] as const)('falla "%s": mensaje amable, sin video visible', async (code, message) => {
    startQrScanner.mockRejectedValue(new QrScannerError(code))
    const wrapper = mountModal()
    await flushPromises()

    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toMatch(message)
    expect(wrapper.text()).not.toMatch(/QrScannerError|NotAllowed|exception/i)
    expect(wrapper.get('video').isVisible()).toBe(false)
  })

  it('contexto inseguro: lo explica y ni siquiera intenta abrir la cámara', async () => {
    getScanSupport.mockReturnValue('insecure-context')
    const wrapper = mountModal()
    await flushPromises()

    expect(startQrScanner).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('conexión segura')
  })

  it('navegador sin soporte: lo explica y no ofrece reintentar (no serviría)', async () => {
    getScanSupport.mockReturnValue('unsupported')
    const wrapper = mountModal()
    await flushPromises()

    expect(startQrScanner).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('no puede leer códigos QR')
    expect(wrapper.findAll('button').some((b) => b.text() === 'Intentar de nuevo')).toBe(false)
  })

  it('permiso denegado ofrece "Intentar de nuevo" y reabre la cámara', async () => {
    startQrScanner.mockRejectedValueOnce(new QrScannerError('permission-denied'))
    const wrapper = mountModal()
    await flushPromises()

    const retry = wrapper.findAll('button').find((b) => b.text() === 'Intentar de nuevo')!
    expect(retry).toBeTruthy()
    await retry.trigger('click')
    await flushPromises()

    expect(startQrScanner).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Apunta la cámara')
  })
})

describe('QrScannerModal — lecturas', () => {
  it('emite scan(texto) con lo leído', async () => {
    const wrapper = mountModal()
    await flushPromises()

    sessions[0].onDecode('11111111-1111-4111-8111-111111111111')

    expect(wrapper.emitted('scan')).toEqual([['11111111-1111-4111-8111-111111111111']])
  })

  it('una cámara sostenida sobre el mismo QR emite UNA sola vez', async () => {
    const wrapper = mountModal()
    await flushPromises()

    for (let i = 0; i < 20; i += 1) {
      sessions[0].onDecode('abc')
      vi.advanceTimersByTime(100)
    }

    expect(wrapper.emitted('scan')).toHaveLength(1)
  })

  it('el mismo código vuelve a valer cuando estuvo ~1.5 s fuera de la vista', async () => {
    const wrapper = mountModal()
    await flushPromises()

    sessions[0].onDecode('abc')
    vi.advanceTimersByTime(1600)
    sessions[0].onDecode('abc')

    expect(wrapper.emitted('scan')).toHaveLength(2)
  })

  it('un código distinto se emite enseguida', async () => {
    const wrapper = mountModal()
    await flushPromises()

    sessions[0].onDecode('a')
    sessions[0].onDecode('b')

    expect(wrapper.emitted('scan')).toEqual([['a'], ['b']])
  })

  it('al reabrir el modal el antirrebote empieza de cero', async () => {
    const wrapper = mountModal()
    await flushPromises()
    sessions[0].onDecode('abc')

    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    sessions[1].onDecode('abc')

    expect(wrapper.emitted('scan')).toHaveLength(2)
  })

  it('muestra la respuesta del contenedor (agregado / no reconocido) en una región viva', async () => {
    const wrapper = mountModal({ feedback: null })
    await flushPromises()
    const live = () => wrapper.get('[role="status"][aria-live="polite"]')
    expect(live().text()).toBe('')

    await wrapper.setProps({ feedback: { kind: 'success', text: 'Café de olla: agregado a tu venta.' } })
    expect(live().text()).toContain('Café de olla: agregado a tu venta.')
    expect(live().classes()).toContain('qr-scanner__feedback--success')

    await wrapper.setProps({ feedback: { kind: 'warning', text: 'No reconocemos ese código.' } })
    expect(live().text()).toContain('No reconocemos ese código.')
    expect(live().classes()).toContain('qr-scanner__feedback--warning')
  })
})

describe('QrScannerModal — región viva', () => {
  it('con Teleport real la región viva es el mismo nodo al cambiar el mensaje (si se reemplazara, el lector de pantalla no lo anunciaría)', async () => {
    const wrapper = mount(QrScannerModal, { props: { modelValue: true, feedback: null }, attachTo: document.body })
    await flushPromises()
    const region = () => document.body.querySelector('.qr-scanner__feedback')!
    const before = region()

    await wrapper.setProps({ feedback: { kind: 'success', text: 'Listo.' } })

    expect(region()).toBe(before)
    expect(before.textContent).toContain('Listo.')
    wrapper.unmount()
  })
})

describe('QrScannerModal — apagar la cámara', () => {
  it('cerrar (v-model=false) detiene la cámara', async () => {
    const wrapper = mountModal()
    await flushPromises()

    await wrapper.setProps({ modelValue: false })

    expect(sessions[0].stop).toHaveBeenCalledTimes(1)
  })

  it('"Listo" cierra el modal y la cámara se apaga', async () => {
    const wrapper = mountModal()
    await flushPromises()

    await wrapper.findAll('button').find((b) => b.text() === 'Listo')!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])

    await wrapper.setProps({ modelValue: false })
    expect(sessions[0].stop).toHaveBeenCalled()
  })

  it('desmontar el componente con la cámara abierta la apaga', async () => {
    const wrapper = mountModal()
    await flushPromises()

    wrapper.unmount()

    expect(sessions[0].stop).toHaveBeenCalledTimes(1)
  })

  it('si se cierra mientras la cámara todavía arranca, se apaga en cuanto está lista', async () => {
    let finishStart!: () => void
    const stop = vi.fn()
    startQrScanner.mockImplementation(
      () => new Promise((resolve) => { finishStart = () => resolve({ stop }) }),
    )
    const wrapper = mountModal()
    await flushPromises()

    await wrapper.setProps({ modelValue: false })
    expect(stop).not.toHaveBeenCalled()
    finishStart()
    await flushPromises()

    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('una lectura que llega tras cerrar no se emite', async () => {
    const wrapper = mountModal()
    await flushPromises()

    await wrapper.setProps({ modelValue: false })
    sessions[0].onDecode('tarde')

    expect(wrapper.emitted('scan')).toBeUndefined()
  })

  it('reabrir después de cerrar apaga la sesión vieja y abre una nueva', async () => {
    const wrapper = mountModal()
    await flushPromises()
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()

    expect(sessions).toHaveLength(2)
    expect(sessions[0].stop).toHaveBeenCalledTimes(1)
    expect(sessions[1].stop).not.toHaveBeenCalled()
  })
})

describe('QrScannerModal — accesibilidad y objetivos táctiles', () => {
  it('es un diálogo con título y "Listo" es un botón real', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.get('[role="dialog"]').attributes('aria-labelledby')).toBeTruthy()
    expect(wrapper.text()).toContain('Escanear producto')
    const done = wrapper.findAll('button').find((b) => b.text() === 'Listo')!
    expect(done.attributes('type') ?? 'button').toBe('button')
  })
})
