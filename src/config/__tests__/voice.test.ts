import { describe, it, expect } from 'vitest'
import {
  VOICE,
  cameraErrorMessage,
  catalogSnapshotMessage,
  saleChargeHint,
  salesSyncingMessage,
  isNetworkError,
  saleScanAddedMessage,
  saleScanUnknownMessage,
  saleConflictMessage,
  saleSavedOfflineMessage,
  saleSuccessMessage,
  salesNeedReviewMessage,
  salesPendingMessage,
} from '@/config/voice'

describe('saleSuccessMessage (patrón de confirmación de venta)', () => {
  it('dice el hecho concreto: qué se anotó y cuánto', () => {
    expect(saleSuccessMessage({ totalMinor: 25000 })).toBe('Venta anotada: $250.00.')
  })

  it('añade el cambio y a nombre de quién cuando hay', () => {
    expect(
      saleSuccessMessage({ totalMinor: 25000, changeMinor: 5000, sellerName: 'Carlos' }),
    ).toBe('Venta anotada: $250.00. Cambio: $50.00. Quedó a nombre de Carlos.')
  })

  it('omite el cambio cuando es cero o no viene', () => {
    expect(saleSuccessMessage({ totalMinor: 12550, changeMinor: 0 })).not.toContain('Cambio')
    expect(saleSuccessMessage({ totalMinor: 12550, changeMinor: null })).not.toContain('Cambio')
  })

  it('nunca cae en el "¡Éxito!" genérico', () => {
    expect(saleSuccessMessage({ totalMinor: 100, sellerName: 'Ana' })).not.toMatch(/éxito|exito|!/i)
  })
})

describe('mensajes de error compartidos', () => {
  it('dicen qué pasó y qué hacer', () => {
    expect(VOICE.genericError).toMatch(/Intenta de nuevo/)
    expect(VOICE.networkError).toMatch(/Revisa tu internet/)
  })

  it('isNetworkError distingue "sin respuesta" de "el servidor respondió"', () => {
    expect(isNetworkError(new Error('Network Error'))).toBe(true)
    expect(isNetworkError(null)).toBe(true)
    expect(isNetworkError({ response: { status: 500 } })).toBe(false)
  })
})

describe('copy de ventas (VOICE.sale)', () => {
  const entries = Object.entries(VOICE.sale)

  it('todo mensaje está en español, sin "¡Éxito!", códigos HTTP ni texto crudo del servidor', () => {
    for (const [key, text] of entries) {
      expect(text, key).not.toMatch(/éxito|exito|error \d{3}|\b[45]\d\d\b/i)
      expect(text, key).not.toMatch(/insufficient|deactivated|exist in this context|payload/i)
      expect(text.trim().length, key).toBeGreaterThan(10)
    }
  })

  it('los errores dicen qué hacer (verbo de acción) y no culpan a la persona', () => {
    for (const key of ['insufficientStock', 'cashInsufficient', 'productDeactivated', 'productMissing', 'rejectedGeneric'] as const) {
      expect(VOICE.sale[key], key).toMatch(/Quít|Revisa|Ajusta|Intenta|Baja|Vuelve/)
      expect(VOICE.sale[key], key).not.toMatch(/tu culpa|te equivocaste|error tuyo/i)
    }
  })

  it('la sesión vencida promete que la venta sigue guardada', () => {
    expect(VOICE.sale.authNeeded).toMatch(/guardada/)
    expect(VOICE.sale.authNeeded).toMatch(/inicia sesión/i)
  })
})

describe('saleSavedOfflineMessage', () => {
  it('se siente como éxito: hecho concreto, cuánto y cuándo se envía', () => {
    const msg = saleSavedOfflineMessage({ totalMinor: 25000, changeMinor: 5000 })
    expect(msg).toBe('Venta guardada: $250.00. Cambio: $50.00. Se enviará sola en cuanto haya internet.')
    expect(msg).not.toMatch(/error|falló|no se pudo/i)
  })

  it('omite el cambio cuando es cero', () => {
    expect(saleSavedOfflineMessage({ totalMinor: 100, changeMinor: 0 })).not.toContain('Cambio')
  })
})

describe('saleConflictMessage', () => {
  it('nunca suena a venta cobrada y explica el siguiente paso', () => {
    const msg = saleConflictMessage()
    expect(msg).not.toMatch(/anotada|guardada|cobrada/i)
    expect(msg).toMatch(/socio/i)
  })
})

describe('salesPendingMessage / salesNeedReviewMessage', () => {
  it('singular y plural', () => {
    expect(salesPendingMessage(1)).toBe('1 venta pendiente de sincronizar')
    expect(salesPendingMessage(3)).toBe('3 ventas pendientes de sincronizar')
    expect(salesNeedReviewMessage(1)).toMatch(/^1 venta /)
    expect(salesNeedReviewMessage(2)).toMatch(/^2 ventas /)
  })

  it('con cero devuelven cadena vacía (no hay nada que avisar)', () => {
    expect(salesPendingMessage(0)).toBe('')
    expect(salesNeedReviewMessage(0)).toBe('')
  })
})

describe('copy del lector de QR (VOICE.scan)', () => {
  const codes = ['permission-denied', 'no-camera', 'camera-busy', 'insecure-context', 'unsupported', 'unknown'] as const

  it('cada falla de cámara tiene su mensaje: dice qué pasó y qué hacer, sin jerga', () => {
    const seen = new Set<string>()
    for (const code of codes) {
      const text = cameraErrorMessage(code)
      expect(text, code).toMatch(/[.]$/)
      expect(text, code).toMatch(/Actívalo|Ciérrala|Intenta|Abre|Busca|Prueba|Usa/)
      expect(text, code).not.toMatch(/getUserMedia|wasm|https|NotAllowed|exception|error \d/i)
      seen.add(text)
    }
    expect(seen.size).toBe(codes.length)
  })

  it('el permiso denegado no culpa a la persona y explica dónde activarlo', () => {
    expect(cameraErrorMessage('permission-denied')).toMatch(/permiso/)
    expect(cameraErrorMessage('permission-denied')).toMatch(/ajustes/i)
  })

  it('sin conexión segura habla de "conexión segura", no de protocolos', () => {
    expect(cameraErrorMessage('insecure-context')).toMatch(/segur/)
  })

  it('un código desconocido cae en el mensaje genérico de cámara', () => {
    expect(cameraErrorMessage('lo-que-sea' as never)).toBe(cameraErrorMessage('unknown'))
  })

  it('un QR que no es de un producto se explica sin culpar y ofrece salida', () => {
    const text = saleScanUnknownMessage()
    expect(text).toMatch(/No reconocemos ese código/)
    expect(text).toMatch(/nombre/)
    expect(text).not.toMatch(/error|inválido|invalido/i)
  })

  it('confirma con el nombre del producto', () => {
    expect(saleScanAddedMessage('Café de olla')).toBe('Café de olla: agregado a tu venta.')
  })

  it('los textos fijos de la pantalla de escaneo están en español y sin exclamaciones de relleno', () => {
    for (const [key, text] of Object.entries(VOICE.scan)) {
      expect(text, key).not.toMatch(/éxito|!/i)
      expect(text.trim().length, key).toBeGreaterThan(4)
    }
  })
})

describe('saleChargeHint (por qué "Cobrar" no está disponible)', () => {
  it('carrito vacío: pide agregar un producto', () => {
    expect(saleChargeHint({ itemCount: 0, totalMinor: 0, cashMinor: 0, missingMinor: 0 }))
      .toBe('Agrega un producto para poder cobrar.')
  })

  it('sin efectivo: pide escribir cuánto recibió', () => {
    expect(saleChargeHint({ itemCount: 2, totalMinor: 5000, cashMinor: 0, missingMinor: 5000 }))
      .toBe('Escribe el efectivo recibido para poder cobrar.')
  })

  it('efectivo insuficiente: dice cuánto falta, exacto', () => {
    expect(saleChargeHint({ itemCount: 1, totalMinor: 15050, cashMinor: 10000, missingMinor: 5050 }))
      .toBe('Faltan $50.50 para poder cobrar.')
  })

  it('cuando se puede cobrar no hay nada que explicar', () => {
    expect(saleChargeHint({ itemCount: 1, totalMinor: 5000, cashMinor: 5000, missingMinor: 0 })).toBe('')
    // Precio 0 sin efectivo también se puede cobrar
    expect(saleChargeHint({ itemCount: 1, totalMinor: 0, cashMinor: 0, missingMinor: 0 })).toBe('')
  })
})

describe('catalogSnapshotMessage (catálogo guardado, sin alarmar)', () => {
  const now = new Date(2026, 8, 25, 18, 0)

  it('el mismo día dice solo la hora', () => {
    const msg = catalogSnapshotMessage(new Date(2026, 8, 25, 10, 5).toISOString(), now)
    expect(msg).toMatch(/^Estás viendo el catálogo guardado de las 10:05/)
    expect(msg).not.toMatch(/septiembre/)
  })

  it('otro día agrega la fecha', () => {
    const msg = catalogSnapshotMessage(new Date(2026, 8, 23, 9, 30).toISOString(), now)
    expect(msg).toMatch(/23 de septiembre/)
    expect(msg).toMatch(/9:30/)
  })

  it('suena tranquilo: sin "error", "falló" ni exclamaciones', () => {
    const msg = catalogSnapshotMessage(new Date(2026, 8, 25, 10, 5).toISOString(), now)
    expect(msg).not.toMatch(/error|falló|falla|!/i)
  })

  it('una fecha inválida no rompe: mensaje sin hora', () => {
    expect(catalogSnapshotMessage('no-es-fecha', now)).toBe('Estás viendo el catálogo guardado en este dispositivo.')
  })
})

describe('salesSyncingMessage', () => {
  it('singular y plural, con puntos suspensivos', () => {
    expect(salesSyncingMessage(1)).toBe('Enviando 1 venta…')
    expect(salesSyncingMessage(4)).toBe('Enviando 4 ventas…')
  })

  it('con cero no hay mensaje', () => {
    expect(salesSyncingMessage(0)).toBe('')
  })
})
