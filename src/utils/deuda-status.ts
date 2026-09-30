// Derivados de una Deuda que el backend NO manda por deuda: no hay campo de
// saldo ni de "atrasado" en el registro crudo (doc/api-contract-for-
// frontend.md §10) — se calculan aquí con la MISMA fórmula que documenta el
// contrato, sobre datos que sí vienen del servidor (`abonos`/`cuotasPlaneadas`).
import { sumMinor, subtractMinor } from './money'
import type { Deuda } from '@/types/deuda.types'

/** Saldo pendiente: `totalMinor - suma(abonos[].montoMinor)`. Nunca lo manda el backend. */
export function pendienteMinorOf(deuda: Deuda): number {
  return subtractMinor(deuda.totalMinor, sumMinor(deuda.abonos.map((abono) => abono.montoMinor)))
}

/**
 * Atrasada (BE-15, misma regla que `GET /deudas?atrasado=`): tiene al menos
 * una `CuotaPlaneada` vencida (`fechaEsperada` pasada) Y la suma de
 * `montoEsperadoMinor` vencidas supera la suma de `Abono.montoMinor` reales
 * recibidos hasta hoy. El backend no expone un campo `atrasado` por deuda
 * (solo el filtro de query del listado); esto reproduce esa misma fórmula
 * client-side para poder mostrar el indicador en cada fila.
 */
export function isDeudaAtrasada(deuda: Deuda, now: Date = new Date()): boolean {
  const vencidas = deuda.cuotasPlaneadas.filter((cuota) => new Date(cuota.fechaEsperada).getTime() < now.getTime())
  if (vencidas.length === 0) return false
  const vencidoMinor = sumMinor(vencidas.map((cuota) => cuota.montoEsperadoMinor))
  const abonadoMinor = sumMinor(deuda.abonos.map((abono) => abono.montoMinor))
  return vencidoMinor > abonadoMinor
}
