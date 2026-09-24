import { defineStore } from 'pinia'
import { ref } from 'vue'
import { MsiService } from '@/services/msi.service'
import { useToastStore } from '@/stores/toast.store'
import type { MsiPurchase, CreateMsiPayload } from '@/types/msi.types'

export const useMsiStore = defineStore('msi', () => {
  const compras   = ref<MsiPurchase[]>([])
  const loading   = ref(false)
  const toast     = useToastStore()

  async function fetchAll() {
    loading.value = true
    try {
      compras.value = await MsiService.getAll()
    } catch {
      toast.error('No se pudieron cargar las compras MSI')
    } finally {
      loading.value = false
    }
  }

  async function create(payload: CreateMsiPayload) {
    const nueva = await MsiService.create(payload)
    compras.value.unshift(nueva)
    toast.success('Compra MSI registrada correctamente')
    return nueva
  }

  async function remove(id: string) {
    await MsiService.remove(id)
    compras.value = compras.value.filter(c => c.id !== id)
    toast.success('Compra MSI cancelada')
  }

  return { compras, loading, fetchAll, create, remove }
})
