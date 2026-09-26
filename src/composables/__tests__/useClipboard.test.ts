import { afterEach, describe, expect, it, vi } from 'vitest'
import { useClipboard } from '../useClipboard'

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const originalExec = document.execCommand

function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  })
}

afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
  document.execCommand = originalExec
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('useClipboard.copy', () => {
  it('usa la API del portapapeles y devuelve true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)
    expect(await useClipboard().copy('codigo-123')).toBe(true)
    expect(writeText).toHaveBeenCalledExactlyOnceWith('codigo-123')
  })

  it('si la API rechaza (permiso denegado, contexto inseguro) prueba el método clásico', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    const exec = vi.fn().mockReturnValue(true)
    document.execCommand = exec
    expect(await useClipboard().copy('codigo-123')).toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
  })

  it('sin la API del portapapeles usa el método clásico', async () => {
    stubClipboard(undefined)
    const exec = vi.fn().mockReturnValue(true)
    document.execCommand = exec
    expect(await useClipboard().copy('codigo-123')).toBe(true)
  })

  it('el método clásico no deja nada en el documento (ni el texto copiado)', async () => {
    stubClipboard(undefined)
    document.execCommand = vi.fn().mockReturnValue(true)
    await useClipboard().copy('codigo-secreto')
    expect(document.body.innerHTML).not.toContain('codigo-secreto')
    expect(document.body.querySelector('textarea')).toBeNull()
  })

  it('si nada funciona devuelve false, sin lanzar', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    document.execCommand = vi.fn().mockReturnValue(false)
    expect(await useClipboard().copy('codigo-123')).toBe(false)
  })

  it('si el método clásico lanza, también false', async () => {
    stubClipboard(undefined)
    document.execCommand = vi.fn(() => { throw new Error('no soportado') })
    expect(await useClipboard().copy('codigo-123')).toBe(false)
  })

  it('un texto vacío no se copia', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)
    expect(await useClipboard().copy('')).toBe(false)
    expect(writeText).not.toHaveBeenCalled()
  })
})
