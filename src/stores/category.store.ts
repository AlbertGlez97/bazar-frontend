import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import CategoryService, { type CategoryItem } from '@/services/category.service'
import { useToastStore } from '@/stores/toast.store'

export const useCategoryStore = defineStore('categories', () => {
  const toast      = useToastStore()
  const items      = ref<CategoryItem[]>([])
  const loading    = ref(false)
  const loaded     = ref(false)

  // Carga una sola vez por sesión
  async function fetchIfNeeded() {
    if (loaded.value) return
    loading.value = true
    try {
      items.value = await CategoryService.getAll()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function create(label: string, type: 'necesidad' | 'deseo'): Promise<CategoryItem | null> {
    try {
      const cat = await CategoryService.create(label, type)
      items.value.push(cat)
      toast.success(`Categoría "${cat.label}" creada`)
      return cat
    } catch {
      toast.error('No se pudo crear la categoría')
      return null
    }
  }

  async function remove(id: string) {
    try {
      await CategoryService.remove(id)
      items.value = items.value.filter(c => c.id !== id)
      toast.success('Categoría eliminada')
    } catch {
      toast.error('No se pudo eliminar la categoría')
    }
  }

  // Resuelve label a partir del key (para formatCategory)
  function labelByKey(key: string): string {
    return items.value.find(c => c.key === key)?.label ?? key
  }

  const globals = computed(() => items.value.filter(c => c.isGlobal))
  const custom  = computed(() => items.value.filter(c => !c.isGlobal))

  return { items, loading, loaded, globals, custom, fetchIfNeeded, create, remove, labelByKey }
})
