import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToastStore } from '@/stores/toast.store'

describe('useToastStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('add() agrega un toast con tipo y mensaje', () => {
    const store = useToastStore()
    store.add('success', 'Guardado')

    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0].type).toBe('success')
    expect(store.toasts[0].message).toBe('Guardado')
  })

  it('add() auto-dismiss tras la duración por defecto (3500ms)', () => {
    const store = useToastStore()
    store.add('info', 'Mensaje')

    expect(store.toasts).toHaveLength(1)

    vi.advanceTimersByTime(3500)
    expect(store.toasts).toHaveLength(0)
  })

  it('add() respeta duración personalizada', () => {
    const store = useToastStore()
    store.add('warning', 'Cuidado', 1000)

    vi.advanceTimersByTime(999)
    expect(store.toasts).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(store.toasts).toHaveLength(0)
  })

  it('dismiss() elimina solo el toast con ese id', () => {
    const store = useToastStore()
    store.add('success', 'Primero')
    store.add('error',   'Segundo')

    const idToRemove = store.toasts[0].id
    store.dismiss(idToRemove)

    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0].message).toBe('Segundo')
  })

  it('dismiss() con id inexistente no modifica la lista', () => {
    const store = useToastStore()
    store.add('info', 'Hola')
    store.dismiss(99999)

    expect(store.toasts).toHaveLength(1)
  })

  it('success() agrega toast de tipo success', () => {
    const store = useToastStore()
    store.success('Éxito')

    expect(store.toasts[0].type).toBe('success')
    expect(store.toasts[0].message).toBe('Éxito')
  })

  it('error() agrega toast de tipo error', () => {
    const store = useToastStore()
    store.error('Error fatal')

    expect(store.toasts[0].type).toBe('error')
  })

  it('warning() agrega toast de tipo warning', () => {
    const store = useToastStore()
    store.warning('Alerta')

    expect(store.toasts[0].type).toBe('warning')
  })

  it('info() agrega toast de tipo info', () => {
    const store = useToastStore()
    store.info('Información')

    expect(store.toasts[0].type).toBe('info')
  })

  it('cada toast recibe un id único incremental', () => {
    const store = useToastStore()
    store.add('success', 'A')
    store.add('success', 'B')

    const [a, b] = store.toasts
    expect(a.id).not.toBe(b.id)
    expect(b.id).toBeGreaterThan(a.id)
  })
})
