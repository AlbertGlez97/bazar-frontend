import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { changeDueMinor, multiplyMinor, parseCashInput, shortfallMinor, sumMinor } from '@/utils/money'
import { DEFAULT_PAYMENT_METHOD, PAYMENT_METHODS, isCashPayment } from '@/utils/payment-method'
import type { PaymentMethod } from '@/types/payment.types'
import type { Product, ProductType } from '@/types/product.types'

/**
 * Carrito de la pantalla de venta: lógica de cliente pura, sin red.
 *
 * Todo el dinero son enteros en centavos (MXN). Toda mutación devuelve un
 * `CartResult`: `{ ok: true }` o `{ ok: false, reason }`, para que la UI
 * muestre un aviso amable en vez de fallar en silencio.
 */

/** Lo mínimo que el carrito necesita saber de un producto del catálogo. */
export type CartProductInput = Pick<Product, 'id' | 'name' | 'unitPriceMinor' | 'tipo' | 'stock' | 'image'>

/** Snapshot de lo que vio quien vende al agregar el producto. */
export interface CartLine {
  productId: string
  name: string
  unitPriceMinor: number
  quantity: number
  tipo: ProductType
  /** Existencia local al agregarlo: tope de `quantity` (una `unica` nunca pasa de 1). */
  stockAvailable: number
  image: string | null
}

export type CartRefusal =
  | 'out-of-stock'     // stock local 0 (o dato inválido)
  | 'already-in-cart'  // una `unica` que ya está en el carrito
  | 'max-stock'        // ya se llegó al stock local (o al máximo del contrato)
  | 'min-quantity'     // bajar de 1 (quitar es explícito con `remove`) o cantidad inválida
  | 'not-in-cart'      // el producto no está en el carrito
  | 'cart-full'        // más de 500 productos distintos (límite del contrato)

export type CartResult = { ok: true } | { ok: false; reason: CartRefusal }

/** Límites del contrato de POST /sales (§6). */
const MAX_LINE_QUANTITY = 100000
const MAX_LINES = 500
const MAX_MINOR_UNITS = 2147483647

const OK: CartResult = { ok: true }
const refuse = (reason: CartRefusal): CartResult => ({ ok: false, reason })

/** Tope real de una línea: stock local, sin pasar del máximo del contrato. */
function lineCap(line: CartLine): number {
  return line.tipo === 'unica' ? 1 : Math.min(line.stockAvailable, MAX_LINE_QUANTITY)
}

export const useCartStore = defineStore('cart', () => {
  const lines = ref<CartLine[]>([])
  /** Cómo se paga: Efectivo por defecto. */
  const paymentMethod = ref<PaymentMethod>(DEFAULT_PAYMENT_METHOD)
  /** Lo que la persona escribió en el campo de monto (centavos). Ver `amountMinor`. */
  const typedMinor = ref(0)
  /** ¿La persona ya tocó el monto? Mientras no, transferencia/tarjeta siguen al total. */
  const amountTouched = ref(false)
  /** El texto de monto capturado es ambiguo o no es un monto: el cobro se bloquea. */
  const amountInvalid = ref(false)

  function find(productId: string): CartLine | undefined {
    return lines.value.find((line) => line.productId === productId)
  }

  // ── Computados ─────────────────────────────────────────────────────────
  const isEmpty = computed(() => lines.value.length === 0)

  const itemCount = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0))

  /**
   * Total local (precio del catálogo × cantidad). El servidor recalcula el suyo.
   * Aritmética exacta con dinero.js (`utils/money`). Un carrito absurdo que ya
   * no cabe ni en enteros exactos no rompe la pantalla: queda en un tope
   * enorme que nunca se puede cobrar.
   */
  const totalMinor = computed(() => {
    try {
      return sumMinor(lines.value.map((line) => multiplyMinor(line.unitPriceMinor, line.quantity)))
    } catch {
      return Number.MAX_SAFE_INTEGER
    }
  })

  /**
   * El monto del cobro, un solo campo para los tres métodos:
   * - EFECTIVO: lo que dieron (puede superar el total; vacío = 0).
   * - TRANSFERENCIA / TARJETA: lo cobrado. Viene precargado con el total (y lo
   *   sigue mientras nadie lo toque) y nunca lo supera.
   */
  const amountMinor = computed(() => {
    if (isCashPayment(paymentMethod.value)) return typedMinor.value
    return amountTouched.value ? Math.min(typedMinor.value, totalMinor.value) : totalMinor.value
  })

  /** Cambio a devolver; nunca negativo y solo en efectivo. */
  const changeMinor = computed(() =>
    isCashPayment(paymentMethod.value) ? changeDueMinor(amountMinor.value, totalMinor.value) : 0)

  /** Cuánto falta para cubrir el total; 0 si ya alcanza. */
  const missingMinor = computed(() => shortfallMinor(amountMinor.value, totalMinor.value))

  /**
   * ¿El monto no alcanza el total? Es lo que habilita fiado/apartado, con
   * cualquier método (el abono usa el método elegido). Un carrito vacío o un
   * monto ambiguo no cuentan: ahí el problema no es que falte dinero.
   */
  const isPartial = computed(
    () => !isEmpty.value && !amountInvalid.value && totalMinor.value <= MAX_MINOR_UNITS && missingMinor.value > 0,
  )

  /**
   * Se puede cobrar con carrito no vacío y monto suficiente. Un total que
   * no cabe en el máximo del contrato nunca alcanza, así que queda fuera
   * solo. Un monto ambiguo (`amountInvalid`) también bloquea: no se cobra
   * con un monto que hubo que adivinar.
   */
  const canCharge = computed(
    () => !isEmpty.value
      && !amountInvalid.value
      && totalMinor.value <= MAX_MINOR_UNITS
      && amountMinor.value >= totalMinor.value,
  )

  /**
   * Huella del contenido que viaja al servidor: método + monto + `{productId,
   * quantity}` sin importar el orden (es lo que compara la idempotencia,
   * §1.6). El cobro la usa para saber si el carrito cambió y hace falta un id
   * de venta nuevo.
   */
  const signature = computed(() => {
    const items = lines.value
      .map((line) => `${line.productId}:${line.quantity}`)
      .sort()
      .join(',')
    return `${paymentMethod.value}|${amountMinor.value}|${items}`
  })

  // ── Acciones ───────────────────────────────────────────────────────────
  /**
   * Agrega un producto del catálogo.
   * - `cantidad`: suma 1 hasta el stock local (`max-stock` al llegar).
   * - `unica`: se agrega una sola vez; repetirla avisa `already-in-cart`.
   * - Sin existencia: `out-of-stock`.
   */
  function add(product: CartProductInput): CartResult {
    const existing = find(product.id)
    if (existing) {
      if (existing.tipo === 'unica') return refuse('already-in-cart')
      return increment(product.id)
    }

    if (!Number.isFinite(product.stock) || product.stock < 1) return refuse('out-of-stock')
    if (lines.value.length >= MAX_LINES) return refuse('cart-full')

    lines.value.push({
      productId: product.id,
      name: product.name,
      unitPriceMinor: product.unitPriceMinor,
      quantity: 1,
      tipo: product.tipo,
      stockAvailable: product.stock,
      image: product.image,
    })
    return OK
  }

  function increment(productId: string): CartResult {
    const line = find(productId)
    if (!line) return refuse('not-in-cart')
    if (line.quantity >= lineCap(line)) return refuse('max-stock')
    line.quantity += 1
    return OK
  }

  /**
   * Baja de uno en uno y en 1 se queda en 1 (`min-quantity`): quitar un
   * producto es una acción explícita (`remove`), no un tercer toque sobre "−".
   */
  function decrement(productId: string): CartResult {
    const line = find(productId)
    if (!line) return refuse('not-in-cart')
    if (line.quantity <= 1) return refuse('min-quantity')
    line.quantity -= 1
    return OK
  }

  /** Fija la cantidad (entero >= 1, tope: stock local y máximo del contrato). */
  function setQuantity(productId: string, quantity: number): CartResult {
    const line = find(productId)
    if (!line) return refuse('not-in-cart')
    if (!Number.isInteger(quantity) || quantity < 1) return refuse('min-quantity')
    if (quantity > lineCap(line)) return refuse('max-stock')
    line.quantity = quantity
    return OK
  }

  function remove(productId: string): CartResult {
    const index = lines.value.findIndex((line) => line.productId === productId)
    if (index < 0) return refuse('not-in-cart')
    lines.value.splice(index, 1)
    return OK
  }

  /** Monto en centavos: entero, nunca negativo, tope del contrato. */
  function setAmountMinor(minor: number): void {
    const whole = Number.isFinite(minor) ? Math.trunc(minor) : 0
    typedMinor.value = Math.min(MAX_MINOR_UNITS, Math.max(0, whole))
    amountTouched.value = true
    amountInvalid.value = false
  }

  /**
   * Monto desde lo que la persona escribió, con la convención de México:
   * coma = miles, punto = decimal ("1,000", "1,000.50", "100.5"). Si el texto
   * es ambiguo o no es un monto ("100,50", "abc") NO se adivina: el monto
   * queda en 0 y `amountInvalid` bloquea el cobro hasta que se corrija.
   */
  function setAmountFromDisplay(text: string): void {
    const minor = parseCashInput(text)
    if (minor === null) {
      typedMinor.value = 0
      amountTouched.value = true
      amountInvalid.value = true
      return
    }
    setAmountMinor(minor)
  }

  /**
   * Cambia el método. Al cambiar de verdad el monto se reinicia: efectivo
   * arranca vacío ("¿Cuánto te dan?") y transferencia/tarjeta vuelven a venir
   * con el total. Elegir el que ya está puesto no borra lo escrito.
   */
  function setPaymentMethod(method: PaymentMethod): void {
    if (!PAYMENT_METHODS.includes(method) || method === paymentMethod.value) return
    paymentMethod.value = method
    typedMinor.value = 0
    amountTouched.value = false
    amountInvalid.value = false
  }

  /** Venta nueva: vacía el carrito y vuelve a Efectivo con el monto vacío. */
  function clear(): void {
    lines.value = []
    paymentMethod.value = DEFAULT_PAYMENT_METHOD
    typedMinor.value = 0
    amountTouched.value = false
    amountInvalid.value = false
  }

  return {
    lines, paymentMethod, amountInvalid,
    isEmpty, itemCount, totalMinor, amountMinor, changeMinor, missingMinor, isPartial, canCharge, signature,
    add, increment, decrement, setQuantity, remove, setAmountMinor, setAmountFromDisplay, setPaymentMethod, clear,
  }
})
