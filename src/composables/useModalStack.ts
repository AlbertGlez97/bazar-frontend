/**
 * Pila de modales abiertos. Con dos a la vez (la ficha de un producto encima del
 * escáner) el teclado y el scroll son del de arriba: Escape cierra solo ese, y el
 * scroll de la página sigue bloqueado hasta que se cierra el último.
 */
const stack: symbol[] = []

/** Registra el modal como el de más arriba (si ya estaba, no cambia su lugar). */
export function pushModal(id: symbol): void {
  if (!stack.includes(id)) stack.push(id)
}

/** Lo saca de la pila (cerrado o desmontado). */
export function popModal(id: symbol): void {
  const index = stack.indexOf(id)
  if (index !== -1) stack.splice(index, 1)
}

/** ¿Es el de más arriba? Solo ese atiende el teclado. */
export function isTopModal(id: symbol): boolean {
  return stack.at(-1) === id
}

/** ¿Queda algún modal abierto? */
export function hasOpenModal(): boolean {
  return stack.length > 0
}
