import { onScopeDispose, shallowRef } from 'vue'
import { VOICE, saleScanNoticeDetail } from '@/config/voice'
import { HAPTIC_ERROR, HAPTIC_OK, useHaptics } from './useHaptics'

/** Cuánto se ve el aviso del escáner. */
export const SCAN_NOTICE_MS = 1500

export interface ScanNotice {
  kind: 'success' | 'error'
  title: string
  detail?: string
}

/**
 * El aviso del escáner: UNO solo a la vez. Cada lectura lo reemplaza (el mismo
 * producto otra vez lo actualiza con su conteo) y reinicia el tiempo. Cada aviso
 * trae su vibración (corta al agregar, doble en un error). No hace ningún sonido.
 */
export function useScanNotice() {
  const { vibrate } = useHaptics()
  const current = shallowRef<ScanNotice | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function clear() {
    if (timer) clearTimeout(timer)
    timer = undefined
    current.value = null
  }

  function show(notice: ScanNotice) {
    if (timer) clearTimeout(timer)
    current.value = notice
    timer = setTimeout(clear, SCAN_NOTICE_MS)
  }

  /** `quantity`: piezas de ese producto que lleva la venta tras agregarlo. */
  function added(productName: string, quantity: number) {
    vibrate(HAPTIC_OK)
    show({ kind: 'success', title: VOICE.scan.noticeAdded, detail: saleScanNoticeDetail(productName, quantity) })
  }

  /** El código no corresponde a ningún producto del catálogo. */
  function unknown() {
    vibrate(HAPTIC_ERROR)
    show({ kind: 'error', title: VOICE.scan.noticeUnknown })
  }

  /** El carrito no lo aceptó (agotado, pieza única repetida, tope): `text` ya es la explicación. */
  function rejected(text: string) {
    vibrate(HAPTIC_ERROR)
    show({ kind: 'error', title: text })
  }

  onScopeDispose(clear)

  return { current, added, unknown, rejected, clear }
}
