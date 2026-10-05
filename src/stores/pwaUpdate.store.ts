import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePwaUpdateStore = defineStore('pwa-update', () => {
  const available = ref(false)
  const updating = ref(false)
  const error = ref('')
  let updater: ((reloadPage?: boolean) => Promise<void>) | undefined

  function notifyUpdate(update: (reloadPage?: boolean) => Promise<void>) {
    updater = update
    available.value = true
  }

  async function update() {
    if (!updater || updating.value) return
    updating.value = true
    error.value = ''
    try {
      // The plugin activates the waiting worker and reloads on controller change.
      await updater(true)
    } catch {
      updating.value = false
      error.value = 'No se pudo actualizar. Comprueba la conexión e intenta nuevamente.'
    }
  }

  return { available, updating, error, notifyUpdate, update }
})
