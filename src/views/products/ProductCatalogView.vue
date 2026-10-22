<template>
  <!-- Vista: catálogo de productos. Ensambla el grid, el modal de crear/
       editar y el modal de confirmación de desactivación; delega toda la
       lógica de negocio real (llamadas HTTP) al store, no a los átomos. -->
  <div class="product-catalog-view">
    <div class="product-catalog-view__header">
      <h1 class="product-catalog-view__title">
        Tu catálogo
      </h1>
      <!-- Alta de productos es gestión: en Modo Venta no se ofrece -->
      <div
        v-if="isSocio && !isVenta"
        class="product-catalog-view__header-actions"
      >
        <!-- Ver la ficha de un producto con su QR -->
        <AppButton
          variant="secondary"
          @click="openScanner"
        >
          {{ VOICE.productSheet.scanQr }}
        </AppButton>
        <AppButton
          variant="primary"
          @click="openCreateModal"
        >
          + Nuevo producto
        </AppButton>
      </div>
    </div>

    <!-- Escáner en modo ficha fijo (sin agregar a ninguna venta) y la ficha encima -->
    <QrScannerModal
      v-model="scanOpen"
      mode="sheet"
      :notice="scanNotice.current.value"
      @scan="onScan"
    />
    <ProductSheet
      v-if="sheetScan.sheetProduct.value"
      :model-value="true"
      :product="sheetScan.sheetProduct.value"
      is-socio
      @update:model-value="sheetScan.closeSheet()"
      @edit="editFromSheet"
      @restock="restockFromSheet"
    />

    <!-- Quien no es socio ve el catálogo, pero no lo cambia (el servidor igual
         respondería 403): se le dice en vez de dejarle botones que fallan. -->
    <p
      v-if="!isSocio && !isVenta"
      class="product-catalog-view__note"
    >
      {{ VOICE.apiErrors.catalog.readOnly }}
    </p>

    <!-- El dispositivo o la persona guardados ya no valen (403 "Selection is not
         authorized…", p. ej. tras reiniciar la base): el aviso se queda hasta que
         se identifique el dispositivo otra vez o una acción salga bien. -->
    <AppAlert
      v-if="contextLost"
      type="warning"
      :show="true"
    >
      {{ VOICE.apiErrors.contextLost }}
      <AppButton
        variant="secondary"
        @click="reidentifyDevice"
      >
        {{ VOICE.apiErrors.catalog.reidentify }}
      </AppButton>
    </AppAlert>

    <!-- Imprimir códigos QR: elegir productos (de cualquier página) y sacar la hoja
         de etiquetas. Gestión, no venta. -->
    <ProductSelectionBar
      v-if="!isVenta"
      :active="selection.active"
      :count="selection.count"
      :selecting-all="selection.selectingAll"
      :progress="selection.progress"
      @enter="selection.enter()"
      @exit="selection.exit()"
      @clear="selection.clear()"
      @select-all="handleSelectAll"
      @print="isPrintDialogOpen = true"
    />

    <ProductCatalogGrid
      :products="store.items"
      :page="store.page"
      :total-pages="store.totalPages"
      :loading="store.loading"
      :mode="uiMode.currentMode"
      :show-actions="isSocio"
      :selection-mode="selection.active"
      :selected-ids="selectedIds"
      :view="catalogView.view"
      @toggle-select="selection.toggle($event)"
      @search="handleSearch"
      @update:page="handlePageChange"
      @update:view="catalogView.setView"
      @edit="openEditModal"
      @deactivate="openDeactivateConfirm"
      @reactivate="handleReactivate"
      @restock="openRestockModal"
      @duplicate="openDuplicate"
    >
      <!-- Filtros del catálogo: botón junto al buscador y chips debajo. Es
           gestión: en Modo Venta el mostrador no los ofrece. Cada filtro viaja
           como query al backend (el catálogo pagina del lado del servidor),
           nunca como `.filter()` sobre lo ya cargado. -->
      <template
        v-if="!isVenta"
        #filters
      >
        <ProductFiltersPanel
          :filters="filters"
          :show-inactive="isSocio"
          :brand-suggestions="suggestionsBrands"
          @update:filters="setFilters"
        />
      </template>
      <template
        v-if="!isVenta"
        #active-filters
      >
        <ActiveFilterChips
          :chips="chips"
          :label="VOICE.productFilters.activeLabel"
          :remove-label="VOICE.productFilters.removeChip"
          @remove="removeFilter"
        />
      </template>
    </ProductCatalogGrid>

    <ProductFormModal
      v-model="isFormModalOpen"
      :product="editingProduct"
      :draft="draft"
      :loading="isSubmitting"
      :brand-suggestions="suggestionsBrands"
      :presentation-suggestions="suggestionsPresentations"
      @submit="handleFormSubmit"
      @submit-and-duplicate="handleSubmitAndDuplicate"
      @duplicate="duplicateFromEdit"
      @restock="openRestockFromEdit"
    />

    <!-- Reponer existencia: suma lo comprado a un producto por cantidad. Es
         gestión y necesita internet (va directo al servidor, no a una cola). -->
    <ProductRestockModal
      v-model="isRestockModalOpen"
      :product="restockingProduct"
      :loading="isRestocking"
      @submit="handleRestockSubmit"
    />

    <LabelPrintDialog
      v-model="isPrintDialogOpen"
      :label-count="selection.count"
      :calibration="labelCalibration.calibration"
      :design="labelDesign.design"
      :busy="printBusy"
      :error="printError"
      @update:calibration="labelCalibration.set($event)"
      @update:design="labelDesign.set($event)"
      @reset="labelCalibration.reset()"
      @preview="previewLabels(selection.items)"
      @download="downloadLabels(selection.items)"
    />

    <AppModal
      v-model="isConfirmModalOpen"
      title="Desactivar producto"
      confirm-label="Sí, desactivar"
      @confirm="handleConfirmDeactivate"
    >
      ¿Seguro que quieres desactivar
      <strong>{{ productPendingDeactivation?.name }}</strong>? Después lo
      puedes reactivar desde el catálogo, con «Mostrar inactivos».
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ActiveFilterChips, AppAlert, AppButton, AppModal, LabelPrintDialog, ProductCatalogGrid, ProductFiltersPanel, ProductFormModal, ProductRestockModal, ProductSelectionBar, ProductSheet, QrScannerModal } from '@/components'
import { VOICE } from '@/config/voice'
import { useLabelPrinting } from '@/composables/useLabelPrinting'
import { useProductSheetScan } from '@/composables/useProductSheetScan'
import { useScanNotice } from '@/composables/useScanNotice'
import { useProductFilters } from '@/composables/useProductFilters'
import { useLabelCalibrationStore } from '@/stores/label-calibration.store'
import { useLabelDesignStore } from '@/stores/label-design.store'
import { useManageCatalogViewStore } from '@/stores/manageCatalogView.store'
import { useProductSelectionStore } from '@/stores/product-selection.store'
import { useProductsStore } from '@/stores/products.store'
import { useSessionStore } from '@/stores/session.store'
import { useToastStore } from '@/stores/toast.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import type { Product, ProductDraft, ProductFormSubmitPayload, RestockProductPayload } from '@/types/product.types'
import { describeFailure } from '@/utils/api-error'
import { duplicateDraft } from '@/utils/product-duplicate'
import { emptyProductFilters, toProductListParams } from '@/utils/product-filters'

const store = useProductsStore()
const session = useSessionStore()
const toast = useToastStore()
const uiMode = useUiModeStore()
const router = useRouter()
// Cuadrícula o lista: preferencia del dispositivo para Gestión, guardada en localStorage.
const catalogView = useManageCatalogViewStore()

// `true` cuando el servidor dice que el dispositivo/persona guardados ya no
// valen: se ofrece identificar el dispositivo otra vez. Nada se borra solo.
const contextLost = ref(false)

/** Avisa por qué falló una acción, con el motivo real y el código HTTP. */
function reportFailure(action: string, error: unknown) {
  const { described, message } = describeFailure(action, error)
  if (described.kind === 'context-lost') contextLost.value = true
  toast.error(message)
}

/** El dispositivo o la persona guardados ya no valen: se borran y se vuelve a identificar. */
function reidentifyDevice() {
  session.clearDevice()
  session.clearMember()
  contextLost.value = false
  router.push({ name: 'SelectContext' })
}

// El modo lo decide el store (y la persona); el grid solo lo presenta.
const isVenta = computed(() => uiMode.currentMode === 'venta')

// Los colaboradores no pueden crear/editar/(des)activar productos (el
// backend lo rechazaría con 403 de todas formas), así que se ocultan esas
// acciones directamente en vez de mostrarlas y dejar que fallen.
const isSocio = computed(() => session.member?.role === 'socio')

// ── Imprimir códigos QR (selección múltiple) ─────────────────────────────
// Imprimir etiquetas es de solo lectura: socios y colaboradores por igual. Es
// gestión: en Modo Venta no se ofrece. La selección vive en su store (no se pierde
// al paginar o buscar) y se descarta al salir de la pantalla.
const selection = useProductSelectionStore()
const labelCalibration = useLabelCalibrationStore()
const labelDesign = useLabelDesignStore()
const { busy: printBusy, error: printError, preview: previewLabels, download: downloadLabels } = useLabelPrinting()
const isPrintDialogOpen = ref(false)
const selectedIds = computed(() => selection.items.map((item) => item.id))

async function handleSelectAll() {
  try {
    const added = await selection.selectAllMatching(store.search)
    if (added > 0) toast.success(VOICE.labels.selectAllDone(added))
    else toast.info(VOICE.labels.selectAllNothing)
  } catch (error) {
    reportFailure(VOICE.labels.selectAllError, error)
  }
}

watch(isVenta, (venta) => {
  if (venta) selection.exit()
})
onBeforeUnmount(() => selection.exit())

const isFormModalOpen = ref(false)
const editingProduct = ref<Product | null>(null)
// Borrador de "Crear otro igual" (un alta que arranca con lo copiado de otro producto).
const draft = ref<ProductDraft | null>(null)
const isSubmitting = ref(false)

const isConfirmModalOpen = ref(false)
const productPendingDeactivation = ref<Product | null>(null)

// ── Filtros del catálogo (panel "Filtros") ───────────────────────────────
// La URL es la fuente de verdad (?pocaExistencia=1&tipo=unica…): los filtros
// sobreviven a recargar y la tarjeta "Poca existencia" de Inicio solo navega con
// su query. "Mostrar inactivos" es de socios (el servidor lo ignora para el resto).
const { filters: urlFilters, filtersKey: urlFiltersKey, chips, setFilters, removeFilter } =
  useProductFilters({ allowInactive: isSocio })

// En Modo Venta no hay filtros: lo inactivo, lo agotado o lo que no tiene costo
// no es asunto del mostrador, así que no se aplican aunque la URL los traiga. Al
// volver a Gestión reaparecen, porque siguen en la URL.
const filters = computed(() => (isVenta.value ? emptyProductFilters() : urlFilters.value))
const appliedKey = computed(() => (isVenta.value ? '{}' : urlFiltersKey.value))

// Marcas y presentaciones ya usadas: solo las pide un socio (el servidor las niega al
// resto) y solo se le dan a quien puede abrir el formulario. El store sobrevive al
// cierre de sesión, así que un colaborador nunca recibe las de un socio anterior.
const suggestionsBrands = computed(() => (isSocio.value ? store.brandSuggestions : []))
const suggestionsPresentations = computed(() => (isSocio.value ? store.presentationSuggestions : []))

onMounted(() => {
  if (isSocio.value) void store.loadSuggestions()
  // El store sobrevive al cierre de sesión: `toProductListParams` manda todos
  // los filtros de forma explícita (también los apagados), así un colaborador
  // que entra después de un socio no hereda los de este.
  store.fetchProducts(toProductListParams(filters.value))
    .catch((error) => reportFailure(VOICE.apiErrors.catalog.load, error))
})

// Cambiar un filtro invalida la paginación actual: se vuelve a la página 1.
// Pasar a Modo Venta con filtros puestos los apaga (y recarga) por la misma vía.
watch(appliedKey, () => {
  store.fetchProducts({ page: 1, ...toProductListParams(filters.value) })
    .catch((error) => reportFailure(VOICE.apiErrors.catalog.load, error))
})

function handleSearch(term: string) {
  store.fetchProducts({ page: 1, search: term }).catch((error) => reportFailure(VOICE.apiErrors.catalog.search, error))
}

function handlePageChange(page: number) {
  store.fetchProducts({ page }).catch((error) => reportFailure(VOICE.apiErrors.catalog.page, error))
}

function openCreateModal() {
  editingProduct.value = null
  draft.value = null
  isFormModalOpen.value = true
}

function openEditModal(product: Product) {
  editingProduct.value = product
  draft.value = null
  isFormModalOpen.value = true
}

// ── Escanear QR (ficha) ──────────────────────────────────────────────────
const scanOpen = ref(false)
const scanNotice = useScanNotice()
const sheetScan = useProductSheetScan('sheet')

function openScanner() {
  scanNotice.clear()
  sheetScan.reset()
  scanOpen.value = true
}

async function onScan(text: string) {
  if (sheetScan.sheetProduct.value) return
  try {
    const found = await store.findByScannedText(text)
    if (!found) scanNotice.unknown()
    else sheetScan.showSheet(found)
  } catch (error) {
    // Sin conexión u otro fallo: el aviso rojo de siempre y el motivo real en un toast.
    scanNotice.unknown()
    reportFailure(VOICE.productSheet.loadFailed, error)
  }
}

/** Desde la ficha: se cierra el escáner y se abre la edición de ese producto. */
function editFromSheet(product: Product) {
  sheetScan.closeSheet()
  scanOpen.value = false
  openEditModal(product)
}

function restockFromSheet(product: Product) {
  sheetScan.closeSheet()
  scanOpen.value = false
  openRestockModal(product)
}

// ── Crear otro igual ─────────────────────────────────────────────────────
/** Abre el alta precargada con lo copiado del producto (sin presentación ni existencia). */
function openDuplicate(product: Product) {
  editingProduct.value = null
  draft.value = duplicateDraft(product)
  isFormModalOpen.value = true
}

/** Desde el modal de edición: la misma ventana pasa a ser el alta; copia lo GUARDADO, no lo que se haya tecleado. */
function duplicateFromEdit() {
  if (editingProduct.value) openDuplicate(editingProduct.value)
}

// ── Reponer existencia ───────────────────────────────────────────────────
const isRestockModalOpen = ref(false)
const restockingProduct = ref<Product | null>(null)
const isRestocking = ref(false)

function openRestockModal(product: Product) {
  restockingProduct.value = product
  isRestockModalOpen.value = true
}

/** Desde el modal de edición: se cierra la edición y se abre la reposición (no se apilan dos modales). */
function openRestockFromEdit() {
  if (!editingProduct.value) return
  isFormModalOpen.value = false
  openRestockModal(editingProduct.value)
}

async function handleRestockSubmit(payload: RestockProductPayload) {
  const product = restockingProduct.value
  // Sin doble clic: mientras una petición va en camino, otra no sale (reponer
  // no es idempotente: repetirla sumaría las piezas dos veces).
  if (!product || isRestocking.value) return
  isRestocking.value = true
  try {
    const { product: updated } = await store.restockProduct(product.id, payload)
    contextLost.value = false
    toast.success(VOICE.productRestock.done(updated.name, updated.stock))
    isRestockModalOpen.value = false
  } catch (error) {
    // El modal se queda abierto con lo capturado para corregir o reintentar.
    reportFailure(VOICE.productRestock.failed, error)
  } finally {
    isRestocking.value = false
  }
}

/** "Guardar y crear otro igual": lo mismo que guardar, pero el alta siguiente queda abierta. */
function handleSubmitAndDuplicate(payload: ProductFormSubmitPayload) {
  return handleFormSubmit(payload, true)
}

async function handleFormSubmit(payload: ProductFormSubmitPayload, andDuplicate = false) {
  const { imageFile, copyImageFrom, ...rest } = payload as ProductFormSubmitPayload & { copyImageFrom?: string }

  // Edición sin campos cambiados: PATCH /products/:id responde 400 "At least
  // one editable field is required" a un body vacío. Decisión: no se envía la
  // petición y, si tampoco hay imagen nueva, el modal se cierra en silencio
  // (sin error ni un "actualizado" que no ocurrió). Una imagen nueva sí cuenta
  // como cambio: se sube por su endpoint aparte, sin el PATCH.
  const isEdit = !!editingProduct.value
  if (isEdit && Object.keys(rest).length === 0 && !imageFile) {
    isFormModalOpen.value = false
    return
  }

  isSubmitting.value = true
  try {
    let product: Product
    if (editingProduct.value) {
      product = Object.keys(rest).length === 0
        ? editingProduct.value
        : await store.updateProduct(editingProduct.value.id, rest)
    } else {
      product = await store.createProduct(rest as Parameters<typeof store.createProduct>[0])
    }

    // La subida de imagen es una segunda llamada, separada de crear/editar
    // (son endpoints distintos según el contrato). Si el producto ya se
    // creó/editó bien pero la imagen falla, solo se avisa del error de
    // imagen — no se revierte nada, el producto ya existe.
    if (imageFile) {
      try {
        product = await store.uploadProductImage(product.id, imageFile)
      } catch (error) {
        // El producto ya existe: solo se avisa de la foto. Un error que no se
        // sabe leer conserva el texto de siempre; uno conocido agrega el motivo.
        const { described, message } = describeFailure(VOICE.apiErrors.catalog.image, error)
        if (described.kind === 'context-lost') contextLost.value = true
        toast.error(described.kind === 'unknown' && described.status === null ? VOICE.apiErrors.catalog.image : message)
      }
    } else if (copyImageFrom) {
      // "Crear otro igual": la foto del original se baja y se sube como archivo nuevo (la
      // ruta nunca se comparte). Si falla, el producto ya existe: solo se avisa.
      try {
        product = await store.copyProductImage(product.id, copyImageFrom, product.name)
      } catch {
        toast.error(VOICE.productDuplicate.photoFailed)
      }
    }

    contextLost.value = false
    // Una marca o presentación nueva ya cuenta como sugerencia para el siguiente producto.
    void store.loadSuggestions()
    if (andDuplicate) {
      // El siguiente alta arranca del producto recién guardado (con su foto, que se vuelve a copiar).
      toast.success(VOICE.productDuplicate.done(product.name))
      editingProduct.value = null
      draft.value = duplicateDraft(product)
      return
    }
    toast.success(editingProduct.value ? 'Listo, producto actualizado.' : 'Listo, ya quedó en tu catálogo.')
    isFormModalOpen.value = false
  } catch (error) {
    reportFailure(VOICE.apiErrors.catalog.save, error)
  } finally {
    isSubmitting.value = false
  }
}

function openDeactivateConfirm(product: Product) {
  productPendingDeactivation.value = product
  isConfirmModalOpen.value = true
}

async function handleConfirmDeactivate() {
  if (!productPendingDeactivation.value) return
  try {
    await store.deactivateProduct(productPendingDeactivation.value.id)
    contextLost.value = false
    toast.success('Producto desactivado. Lo encuentras en «Mostrar inactivos».')
  } catch (error) {
    reportFailure(VOICE.apiErrors.catalog.deactivate, error)
  } finally {
    isConfirmModalOpen.value = false
    productPendingDeactivation.value = null
  }
}

async function handleReactivate(product: Product) {
  try {
    await store.reactivateProduct(product.id)
    contextLost.value = false
    toast.success('Listo, producto reactivado.')
  } catch (error) {
    reportFailure(VOICE.apiErrors.catalog.reactivate, error)
  }
}
</script>

<style scoped>
.product-catalog-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
.product-catalog-view__note {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
.product-catalog-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.product-catalog-view__header-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); justify-content: flex-end; }
.product-catalog-view__title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}
</style>
