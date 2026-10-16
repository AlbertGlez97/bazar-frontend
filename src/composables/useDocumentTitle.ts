import { onBeforeUnmount, onMounted } from 'vue'

/** Pone el título de la pestaña mientras la pantalla está abierta y lo devuelve al salir. */
export function useDocumentTitle(title: string) {
  let previous = ''
  onMounted(() => {
    previous = document.title
    document.title = title
  })
  onBeforeUnmount(() => {
    document.title = previous
  })
}
