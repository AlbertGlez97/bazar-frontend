import type { PaymentMethod } from '@/types/payment.types'

/** Los tres métodos, en el orden en que se ofrecen en pantalla. */
export const PAYMENT_METHODS: readonly PaymentMethod[] = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA']

/** Lo que se asume cuando no hay método: así se cobraba todo antes de existir el campo. */
export const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'EFECTIVO'

/** Nombres para mostrar: siempre con palabras, nunca solo un ícono. */
export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
}

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method]
}

/**
 * Normaliza un método que puede faltar o venir de datos viejos (una venta
 * encolada antes de existir el campo, un abono anterior): sin método, o con uno
 * desconocido, es EFECTIVO.
 */
export function resolvePaymentMethod(value: unknown): PaymentMethod {
  return PAYMENT_METHODS.find((method) => method === value) ?? DEFAULT_PAYMENT_METHOD
}

/** Solo EFECTIVO tiene "cuánto te dan" y cambio a devolver. */
export function isCashPayment(method: PaymentMethod | null | undefined): boolean {
  return resolvePaymentMethod(method) === 'EFECTIVO'
}

/**
 * Método de una operación de la cola offline. Lo encolado antes de existir el
 * campo (una venta sin `paymentMethod`, un fiado sin `abonoInicialPaymentMethod`)
 * es EFECTIVO: así se cobraba todo. El cuerpo congelado de la cola nunca se
 * reescribe; esto solo lo lee.
 */
export function queuedPaymentMethod(record: {
  kind?: string
  payload: { paymentMethod?: unknown; abonoInicialPaymentMethod?: unknown }
}): PaymentMethod {
  return resolvePaymentMethod(
    record.kind === 'debt' ? record.payload.abonoInicialPaymentMethod : record.payload.paymentMethod,
  )
}
