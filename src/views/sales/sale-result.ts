import { VOICE, saleSuccessMessage } from '@/config/voice'
import type { CheckoutResult } from '@/stores/checkout.store'
import type { SaleResultView } from '@/types/sale-result.types'

/**
 * `CheckoutResult` del store -> lo que pinta `SaleResult`. Aquí (en la vista,
 * que sí conoce los stores) se decide el texto: los componentes de ui/ solo
 * reciben una vista plana.
 */
export function describeCheckoutResult(result: CheckoutResult, sellerName?: string): SaleResultView {
  switch (result.kind) {
    case 'success':
      return {
        kind: 'success',
        totalMinor: result.totalMinor,
        changeMinor: result.changeMinor,
        summary: saleSuccessMessage({ totalMinor: result.totalMinor, changeMinor: result.changeMinor, sellerName }),
      }
    case 'saved-offline':
      return { kind: 'saved-offline', totalMinor: result.totalMinor, changeMinor: result.changeMinor }
    case 'conflict':
      // `reason` ya es el texto amable de la marca; el del servidor solo es detalle.
      return { kind: 'conflict', message: result.reason, detail: result.sale.conflictReason }
    case 'rejected':
      return { kind: 'rejected', message: result.reasonMessage }
    case 'auth-needed':
      return { kind: 'auth-needed', message: result.message, totalMinor: result.totalMinor, changeMinor: result.changeMinor }
    case 'failed-to-save':
      return { kind: 'failed-to-save', message: result.message }
    case 'blocked':
      return { kind: 'blocked', message: BLOCKED_MESSAGES[result.reason] }
  }
}

const BLOCKED_MESSAGES = {
  'empty-cart': VOICE.sale.blockedEmptyCart,
  'cash-insufficient': VOICE.sale.cashInsufficient,
  'missing-context': VOICE.sale.blockedMissingContext,
} as const
