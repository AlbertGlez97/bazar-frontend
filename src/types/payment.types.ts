/**
 * Cómo se pagó una venta o un abono. Mayúsculas en español, como el enum
 * `PaymentMethod` del backend (doc/api-contract-for-frontend.md). Solo se
 * registra el medio: no hay folio ni referencia de la terminal.
 */
export type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'
