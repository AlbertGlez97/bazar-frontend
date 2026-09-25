import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useCartStore } from './cart.store'
import { useSaleCatalogStore } from './sale-catalog.store'
import { useSessionStore } from './session.store'
import SalesService from '@/services/sales.service'
import * as salesQueue from '@/services/sales-queue'
import { classifySaleError, friendlySaleErrorMessage } from '@/services/sale-errors'
import { VOICE, saleConflictMessage } from '@/config/voice'
import { buildSalePayload, newSaleId } from '@/utils/sale'
import type { CreateSalePayload, Sale } from '@/types/sale.types'

/**
 * Orquestación del cobro (decisión: store de Pinia, no composable, porque el
 * resultado y `loading` los lee la vista y el intento congelado debe
 * sobrevivir a re-montajes del componente).
 *
 * `charge()` lee carrito + sesión y devuelve un `CheckoutResult` que la UI
 * pinta. Reglas:
 * - El `id` (UUID v7) y `occurredAt` se generan al primer `charge()` y se
 *   REUTILIZAN si se reintenta con el carrito, el efectivo y la persona sin
 *   cambios (mismo cuerpo => el servidor lo reconoce como reenvío idempotente).
 *   Si algo cambia, el intento se descarta y se genera un id nuevo.
 * - Un `charge()` mientras otro está en curso NO envía otra venta: devuelve el
 *   mismo resultado (doble toque).
 * - Si no hay conexión, o el resultado es desconocido (red / timeout / 5xx), la
 *   venta se encola con su cuerpo congelado y se responde `saved-offline`: para
 *   quien vende es un éxito. Solo si ni siquiera se pudo guardar en el
 *   dispositivo se responde `failed-to-save`.
 * - El carrito NO se limpia aquí: la UI llama `startNewSale()` cuando la
 *   persona termina con el resultado (success, conflict, saved-offline,
 *   auth-needed). Tras `rejected`, `failed-to-save` o `blocked` el carrito se
 *   conserva para corregirlo.
 */

export type CheckoutBlockedReason = 'empty-cart' | 'cash-insufficient' | 'missing-context'

export type CheckoutResult =
  /** Venta cobrada. Totales del SERVIDOR. Stock local descontado. */
  | { kind: 'success'; sale: Sale; totalMinor: number; changeMinor: number }
  /** 201/200 `rechazada_por_conflicto`: NO se cobró (nunca pintar como éxito). Stock local intacto. */
  | { kind: 'conflict'; sale: Sale; reason: string }
  /** Guardada en el dispositivo; se enviará sola. Totales locales. Debe sentirse como éxito. */
  | { kind: 'saved-offline'; pendingId: string; totalMinor: number; changeMinor: number }
  /** 400/409 en línea: el servidor no la aceptó. Nada quedó en cola; el carrito se conserva. */
  | { kind: 'rejected'; reasonMessage: string; canFix: true }
  /** 401/403 en línea: la venta está a salvo en la cola; hay que volver a iniciar sesión. */
  | { kind: 'auth-needed'; pendingId: string; totalMinor: number; changeMinor: number; message: string }
  /** Ni siquiera se pudo guardar en el dispositivo (IndexedDB no disponible): conservar el carrito. */
  | { kind: 'failed-to-save'; message: string }
  /** No se intentó: falta algo para poder cobrar. */
  | { kind: 'blocked'; reason: CheckoutBlockedReason }

/** El intento en curso: todo lo que debe repetirse idéntico en un reintento. */
interface Attempt {
  payload: CreateSalePayload
  signature: string
  memberId: string
  deviceId: string
  sellerName: string
  totalMinor: number
  changeMinor: number
  /** ¿Hay una copia de este id en la cola? */
  enqueued: boolean
  /** ¿Ya se descontó el stock local por este id? (una sola vez por intento) */
  stockApplied: boolean
}

export const useCheckoutStore = defineStore('checkout', () => {
  const cart = useCartStore()
  const session = useSessionStore()
  const catalog = useSaleCatalogStore()

  /** `true` mientras un cobro está en curso (deshabilita el botón "Cobrar"). */
  const loading = ref(false)
  const lastResult = ref<CheckoutResult | null>(null)

  let attempt: Attempt | null = null
  let inFlight: Promise<CheckoutResult> | null = null

  const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false

  /** Reutiliza el intento si nada cambió; si no, congela uno nuevo. `null` si falta la sesión. */
  function currentAttempt(): Attempt | null {
    const memberId = session.memberId
    const deviceId = session.deviceId
    if (!memberId || !deviceId) return null

    if (
      attempt
      && attempt.signature === cart.signature
      && attempt.memberId === memberId
      && attempt.deviceId === deviceId
    ) {
      return attempt
    }

    attempt = {
      payload: buildSalePayload({
        id: newSaleId(),
        memberId,
        deviceId,
        occurredAt: new Date(),
        cashReceivedMinor: cart.cashReceivedMinor,
        lines: cart.lines.map(({ productId, quantity, unitPriceMinor }) => ({ productId, quantity, unitPriceMinor })),
      }),
      signature: cart.signature,
      memberId,
      deviceId,
      sellerName: session.member?.name ?? '',
      totalMinor: cart.totalMinor,
      changeMinor: cart.changeMinor,
      enqueued: false,
      stockApplied: false,
    }
    return attempt
  }

  async function applyStockOnce(current: Attempt): Promise<void> {
    if (current.stockApplied) return
    current.stockApplied = true
    await catalog.applySoldItems(current.payload.items)
  }

  /** Quita la copia encolada de este intento tras una respuesta definitiva del servidor. */
  async function dropQueuedCopy(current: Attempt): Promise<void> {
    if (!current.enqueued) return
    try {
      await salesQueue.remove(current.payload.id)
      current.enqueued = false
    } catch {
      // Si no se pudo quitar, la sincronización recibirá un 200 idempotente y la limpiará.
    }
  }

  /** Guarda la venta en la cola (idempotente por id). `false` si no se pudo guardar. */
  async function saveToQueue(current: Attempt): Promise<boolean> {
    try {
      const saved = await salesQueue.enqueue({
        payload: current.payload,
        // La cola se ordena por creación: usar el instante de la venta mantiene el orden real.
        createdAt: current.payload.occurredAt,
        sellerName: current.sellerName || undefined,
        totalMinorEstimate: current.totalMinor,
        changeMinorEstimate: current.changeMinor,
      })
      if (!saved.ok) return false
      current.enqueued = true
      return true
    } catch {
      return false
    }
  }

  const failedToSave = (): CheckoutResult => ({ kind: 'failed-to-save', message: VOICE.sale.failedToSave })

  async function saveOffline(current: Attempt): Promise<CheckoutResult> {
    if (!(await saveToQueue(current))) return failedToSave()
    await applyStockOnce(current)
    return {
      kind: 'saved-offline',
      pendingId: current.payload.id,
      totalMinor: current.totalMinor,
      changeMinor: current.changeMinor,
    }
  }

  async function run(): Promise<CheckoutResult> {
    if (cart.isEmpty) return { kind: 'blocked', reason: 'empty-cart' }
    if (!cart.canCharge) return { kind: 'blocked', reason: 'cash-insufficient' }
    const current = currentAttempt()
    if (!current) return { kind: 'blocked', reason: 'missing-context' }

    if (!isOnline()) return saveOffline(current)

    let response
    try {
      response = await SalesService.createSale(current.payload, { handleAuthLocally: true })
    } catch (error) {
      switch (classifySaleError(error)) {
        case 'business':
        case 'conflict-payload':
          // El servidor no guardó nada: si una copia quedó encolada antes, ya no aplica.
          await dropQueuedCopy(current)
          return { kind: 'rejected', reasonMessage: friendlySaleErrorMessage(error, 'checkout'), canFix: true }
        case 'auth': {
          // La venta es válida: se guarda y se enviará al volver a entrar.
          const saved = await saveOffline(current)
          if (saved.kind !== 'saved-offline') return saved
          return { ...saved, kind: 'auth-needed', message: VOICE.sale.authNeeded }
        }
        default:
          // network / server: no sabemos si llegó. Se encola el MISMO registro; el reenvío idempotente lo resuelve.
          return saveOffline(current)
      }
    }

    // Respuesta definitiva del servidor: la copia en cola (si hubo) ya no hace falta.
    await dropQueuedCopy(current)

    // Se decide por `body.status`, nunca por el código HTTP (§1.6).
    if (response.outcome === 'conflict') {
      // Nota: si un intento anterior de este id ya había descontado el stock
      // local (se encoló tras un fallo de red), esa cifra queda baja hasta la
      // siguiente carga del catálogo.
      return { kind: 'conflict', sale: response.sale, reason: saleConflictMessage() }
    }

    await applyStockOnce(current)
    return {
      kind: 'success',
      sale: response.sale,
      totalMinor: response.sale.totalMinor ?? current.totalMinor,
      changeMinor: response.sale.changeMinor ?? current.changeMinor,
    }
  }

  /**
   * Cobra. Nunca lanza. Un segundo llamado mientras hay uno en curso devuelve
   * el mismo resultado sin enviar otra venta.
   */
  function charge(): Promise<CheckoutResult> {
    if (inFlight) return inFlight
    loading.value = true
    const current = run()
      .catch((): CheckoutResult => failedToSave())
      .then((result) => {
        lastResult.value = result
        return result
      })
      .finally(() => {
        loading.value = false
        if (inFlight === current) inFlight = null
      })
    inFlight = current
    return current
  }

  /** Venta nueva: vacía carrito y efectivo y olvida el intento congelado. */
  function startNewSale(): void {
    cart.clear()
    attempt = null
    lastResult.value = null
  }

  /**
   * Quita el resultado de la pantalla ("Regresar a la venta") SIN tocar el
   * carrito, el efectivo ni el intento congelado: un reintento sin cambios
   * sigue mandando el mismo id.
   */
  function dismissResult(): void {
    lastResult.value = null
  }

  return { loading, lastResult, charge, startNewSale, dismissResult }
})
