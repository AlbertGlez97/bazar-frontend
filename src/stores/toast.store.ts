// Store global de toasts — permite lanzar notificaciones desde cualquier componente
import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id:      number
  type:    ToastType
  message: string
}

let _id = 0

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<ToastItem[]>([])

  function add(type: ToastType, message: string, duration = 3500) {
    const id = ++_id
    toasts.value.push({ id, type, message })
    // Auto-dismiss después de `duration` ms
    setTimeout(() => dismiss(id), duration)
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  // Atajos semánticos
  const success = (msg: string, d?: number) => add('success', msg, d)
  const error   = (msg: string, d?: number) => add('error',   msg, d)
  const warning = (msg: string, d?: number) => add('warning', msg, d)
  const info    = (msg: string, d?: number) => add('info',    msg, d)

  return { toasts, add, dismiss, success, error, warning, info }
})
