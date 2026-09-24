// Configuración global de Vitest — se ejecuta antes de cada suite de tests
import { config } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach } from 'vitest'

// Inicializa una instancia limpia de Pinia antes de cada test
// Evita que el estado de un test contamine al siguiente
beforeEach(() => {
  setActivePinia(createPinia())
})

// Suprime advertencias de Vue relacionadas con componentes no registrados
// (necesario cuando testeamos stores sin montar el árbol completo de componentes)
config.global.config.warnHandler = (msg) => {
  if (msg.includes('Failed to resolve component')) return
}
