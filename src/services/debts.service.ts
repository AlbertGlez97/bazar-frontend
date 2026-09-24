// Servicio de deudas: CRUD, pagos, amortización y planes de pago
import api from './api'
import type {
  Debt, CreateDebtPayload, DebtPayment, AmortizationRow, AmortizationData, DebtPlan
} from '@/types/debt.types'

const DebtsService = {
  // ── Deudas ───────────────────────────────────────────────────────────────
  async getAll(): Promise<Debt[]> {
    const { data } = await api.get<Debt[]>('/debts')
    return data
  },

  async getOne(id: string): Promise<Debt> {
    const { data } = await api.get<Debt>(`/debts/${id}`)
    return data
  },

  // Usa CreateDebtPayload (espejo del DTO backend) para no enviar campos de solo lectura
  async create(payload: CreateDebtPayload): Promise<Debt> {
    const { data } = await api.post<Debt>('/debts', payload)
    return data
  },

  async update(id: string, payload: Partial<Debt>): Promise<Debt> {
    const { data } = await api.patch<Debt>(`/debts/${id}`, payload)
    return data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/debts/${id}`)
  },

  // ── Pagos de una deuda ───────────────────────────────────────────────────
  async getPayments(debtId: string): Promise<DebtPayment[]> {
    const { data } = await api.get<DebtPayment[]>(`/debts/${debtId}/payments`)
    return data
  },

  async registerPayment(
    debtId: string,
    payload: Pick<DebtPayment, 'actualAmount' | 'paymentDate' | 'note'>
  ): Promise<DebtPayment> {
    const { data } = await api.post<DebtPayment>(`/debts/${debtId}/payments`, payload)
    return data
  },

  async updatePayment(
    debtId: string,
    paymentId: string,
    payload: { actualAmount?: number; paymentDate?: string; note?: string; transactionId?: string }
  ): Promise<DebtPayment> {
    const { data } = await api.patch<DebtPayment>(`/debts/${debtId}/payments/${paymentId}`, payload)
    return data
  },

  async removePayment(debtId: string, paymentId: string): Promise<void> {
    await api.delete(`/debts/${debtId}/payments/${paymentId}`)
  },

  /**
   * Tabla de amortización proyectada + metadata.
   *
   * Devuelve el objeto completo (antes solo `tabla`) para que el store pueda
   * detectar `isNegativeAmortization` y mostrar el banner de advertencia
   * cuando el pago mínimo no cubre ni el interés del primer mes.
   */
  async getAmortization(debtId: string): Promise<AmortizationData> {
    const { data } = await api.get<AmortizationData>(`/debts/${debtId}/amortization`)
    return data
  },

  // ── Planes de liquidación ────────────────────────────────────────────────
  // Bola de nieve: paga primero la deuda de menor saldo
  async getSnowballPlan(): Promise<DebtPlan> {
    const { data } = await api.get<DebtPlan>('/debts/plans/snowball')
    return data
  },

  // Avalancha: paga primero la deuda con mayor tasa de interés
  async getAvalanchePlan(): Promise<DebtPlan> {
    const { data } = await api.get<DebtPlan>('/debts/plans/avalanche')
    return data
  },

  // Fireball: híbrido — avalancha si tasa ≥ 7%, bola de nieve si < 7%
  async getFireballPlan(): Promise<DebtPlan> {
    const { data } = await api.get<DebtPlan>('/debts/plans/fireball')
    return data
  },
}

export default DebtsService
