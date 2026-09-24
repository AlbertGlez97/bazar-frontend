// Store del módulo de ahorros — gestiona metas y contribuciones
import { defineStore } from 'pinia'
import { ref } from 'vue'
import SavingsService from '@/services/savings.service'
import { useToastStore } from '@/stores/toast.store'
import type { SavingGoal, SavingContribution } from '@/types/savings.types'

export const useSavingsStore = defineStore('savings', () => {
  const toast = useToastStore()

  // ── Estado ───────────────────────────────────────────────────────────────
  const goals         = ref<SavingGoal[]>([])              // Lista de todas las metas
  const current       = ref<SavingGoal | null>(null)       // Meta seleccionada para ver detalle
  const contributions = ref<SavingContribution[]>([])      // Contribuciones de la meta activa
  const loading       = ref(false)
  const error         = ref<string | null>(null)

  // ── Acciones: metas ───────────────────────────────────────────────────────

  // Carga todas las metas del usuario
  async function fetchAll() {
    loading.value = true
    error.value   = null
    try {
      goals.value = await SavingsService.getAll()
    } catch (e: unknown) {
      error.value = (e as Error).message ?? 'Error al cargar las metas'
    } finally {
      loading.value = false
    }
  }

  // Carga una meta por ID junto con sus contribuciones. El progreso
  // (porcentaje, restante) se calcula a partir de currentAmount / targetAmount
  // — no necesitamos un endpoint dedicado ni almacenarlo en el store.
  async function fetchOne(id: string) {
    loading.value = true
    error.value   = null
    try {
      const [goal, contribs] = await Promise.all([
        SavingsService.getOne(id),
        SavingsService.getContributions(id),
      ])
      current.value       = goal
      contributions.value = contribs
    } catch (e: unknown) {
      error.value = (e as Error).message ?? 'Error al cargar la meta'
    } finally {
      loading.value = false
    }
  }

  // Crea una nueva meta de ahorro
  async function createGoal(payload: Omit<SavingGoal, 'id' | 'currentAmount' | 'isCompleted' | 'createdAt'>) {
    loading.value = true
    error.value   = null
    try {
      const newGoal = await SavingsService.create(payload)
      goals.value.unshift(newGoal) // La coloca al inicio de la lista
      toast.success(`Meta "${newGoal.name}" creada correctamente`)
      return newGoal
    } catch (e: unknown) {
      error.value = (e as Error).message ?? 'Error al crear la meta'
      throw e
    } finally {
      loading.value = false
    }
  }

  // Actualiza los datos de una meta existente
  async function updateGoal(id: string, payload: Partial<SavingGoal>) {
    loading.value = true
    error.value   = null
    try {
      const updated = await SavingsService.update(id, payload)
      // Actualiza el estado local sin refetch
      const idx = goals.value.findIndex(g => g.id === id)
      if (idx !== -1) goals.value[idx] = updated
      if (current.value?.id === id) current.value = updated
      toast.success('Meta actualizada correctamente')
      return updated
    } catch (e: unknown) {
      error.value = (e as Error).message ?? 'Error al actualizar la meta'
      throw e
    } finally {
      loading.value = false
    }
  }

  // Elimina una meta por ID
  async function deleteGoal(id: string) {
    loading.value = true
    error.value   = null
    try {
      await SavingsService.remove(id)
      goals.value = goals.value.filter(g => g.id !== id)
      if (current.value?.id === id) current.value = null
      toast.success('Meta eliminada')
    } catch (e: unknown) {
      error.value = (e as Error).message ?? 'Error al eliminar la meta'
      throw e
    } finally {
      loading.value = false
    }
  }

  // ── Acciones: contribuciones ─────────────────────────────────────────────

  // Registra una contribución y actualiza el currentAmount localmente.
  // Antes refetcheabamos /progress para resincronizar; ahora sumamos el
  // monto del aporte al saldo en memoria — es matemáticamente equivalente
  // y nos ahorra un round-trip + un endpoint que ya no existe en backend.
  async function addContribution(
    goalId: string,
    payload: Pick<SavingContribution, 'amount' | 'date' | 'note'>
  ) {
    loading.value = true
    error.value   = null
    try {
      const contrib = await SavingsService.addContribution(goalId, payload)
      contributions.value.unshift(contrib)

      // Sincroniza currentAmount sumando el aporte. Misma cuenta que hace el
      // backend al guardar el record.
      if (current.value?.id === goalId) {
        current.value = {
          ...current.value,
          currentAmount: +(current.value.currentAmount + contrib.amount).toFixed(2),
        }
      }
      const idx = goals.value.findIndex(g => g.id === goalId)
      if (idx !== -1) {
        goals.value[idx] = {
          ...goals.value[idx],
          currentAmount: +(goals.value[idx].currentAmount + contrib.amount).toFixed(2),
        }
      }

      toast.success('Contribución registrada correctamente')
      return contrib
    } catch (e: unknown) {
      error.value = (e as Error).message ?? 'Error al registrar la contribución'
      throw e
    } finally {
      loading.value = false
    }
  }

  // Limpia la meta activa al salir del detalle
  function clearCurrent() {
    current.value       = null
    contributions.value = []
  }

  return {
    goals, current, contributions, loading, error,
    fetchAll, fetchOne, createGoal, updateGoal, deleteGoal,
    addContribution, clearCurrent,
  }
})
