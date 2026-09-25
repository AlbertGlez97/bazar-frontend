// Forma de una línea del carrito tal como la pintan los componentes de ui/.
// Coincide con `CartLine` de `stores/cart.store.ts` (que la satisface tal cual),
// pero vive aquí para que ui/ no dependa de un store, ni siquiera en tipos.
export interface CartLineView {
  productId: string
  name: string
  unitPriceMinor: number
  quantity: number
  tipo: 'unica' | 'cantidad'
  /** Existencia local: tope de la cantidad */
  stockAvailable: number
  image: string | null
}
