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
      <AppButton
        v-if="isSocio && !isVenta"
        variant="primary"
        @click="openCreateModal"
      >
        + Nuevo producto
      </AppButton>
    </div>

    <ProductCatalogGrid
      :products="store.items"
      :page="store.page"
      :total-pages="store.totalPages"
      :loading="store.loading"
      :mode="uiMode.currentMode"
      :show-actions="isSocio"
      :show-inactive-toggle="isSocio"
      :include-inactive="store.includeInactive"
      @search="handleSearch"
      @update:include-inactive="handleIncludeInactive"
      @update:page="handlePageChange"
      @edit="openEditModal"
      @deactivate="openDeactivateConfirm"
      @reactivate="handleReactivate"
    />

    <ProductFormModal
      v-model="isFormModalOpen"
      :product="editingProduct"
      :loading="isSubmitting"
      @submit="handleFormSubmit"
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
import { computed, onMounted, ref, watch } from 'vue'
import { AppButton, AppModal, ProductCatalogGrid, ProductFormModal } from '@/components'
import { useProductsStore } from '@/stores/products.store'
import { useSessionStore } from '@/stores/session.store'
import { useToastStore } from '@/stores/toast.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import type { Product, ProductFormSubmitPayload } from '@/types/product.types'

const store = useProductsStore()
const session = useSessionStore()
const toast = useToastStore()
const uiMode = useUiModeStore()

// El modo lo decide el store (y la persona); el grid solo lo presenta.
const isVenta = computed(() => uiMode.currentMode === 'venta')

// Los colaboradores no pueden crear/editar/(des)activar productos (el
// backend lo rechazaría con 403 de todas formas), así que se ocultan esas
// acciones directamente en vez de mostrarlas y dejar que fallen.
const isSocio = computed(() => session.member?.role === 'socio')

const isFormModalOpen = ref(false)
const editingProduct = ref<Product | null>(null)
const isSubmitting = ref(false)

const isConfirmModalOpen = ref(false)
const productPendingDeactivation = ref<Product | null>(null)

onMounted(() => {
  // El store sobrevive al cierre de sesión: un colaborador que entra después
  // de un socio no debe heredar "Mostrar inactivos" (no tendría cómo apagarlo).
  // En Modo Venta tampoco: lo inactivo es cosa de gestión y nunca se ofrece
  // para vender, así que se pide el catálogo solo con productos activos.
  const includeInactive = isSocio.value && !isVenta.value && store.includeInactive
  store.fetchProducts({ includeInactive }).catch(() => toast.error('No pudimos cargar tu catálogo. Intenta de nuevo.'))
})

// Cambiar a Modo Venta con "Mostrar inactivos" encendido: se apaga el filtro y
// se recarga para que los inactivos desaparezcan. Volver a gestión no necesita
// recargar (el listado ya es de activos y el interruptor queda apagado).
watch(isVenta, (venta) => {
  if (venta && store.includeInactive) handleIncludeInactive(false)
})

// Cambiar el filtro invalida la paginación actual: se vuelve a la página 1.
function handleIncludeInactive(value: boolean) {
  store.fetchProducts({ page: 1, includeInactive: value }).catch(() => toast.error('No pudimos cargar tu catálogo. Intenta de nuevo.'))
}

function handleSearch(term: string) {
  store.fetchProducts({ page: 1, search: term }).catch(() => toast.error('No pudimos buscar. Intenta de nuevo.'))
}

function handlePageChange(page: number) {
  store.fetchProducts({ page }).catch(() => toast.error('No pudimos cambiar de página. Intenta de nuevo.'))
}

function openCreateModal() {
  editingProduct.value = null
  isFormModalOpen.value = true
}

function openEditModal(product: Product) {
  editingProduct.value = product
  isFormModalOpen.value = true
}

async function handleFormSubmit(payload: ProductFormSubmitPayload) {
  const { imageFile, ...rest } = payload

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
        await store.uploadProductImage(product.id, imageFile)
      } catch {
        toast.error('El producto quedó guardado, pero la foto no se pudo subir. Edítalo y vuelve a intentarlo.')
      }
    }

    toast.success(editingProduct.value ? 'Listo, producto actualizado.' : 'Listo, ya quedó en tu catálogo.')
    isFormModalOpen.value = false
  } catch {
    toast.error('No pudimos guardar el producto. Intenta de nuevo.')
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
    toast.success('Producto desactivado. Lo encuentras en «Mostrar inactivos».')
  } catch {
    toast.error('No pudimos desactivar el producto. Intenta de nuevo.')
  } finally {
    isConfirmModalOpen.value = false
    productPendingDeactivation.value = null
  }
}

async function handleReactivate(product: Product) {
  try {
    await store.reactivateProduct(product.id)
    toast.success('Listo, producto reactivado.')
  } catch {
    toast.error('No pudimos reactivar el producto. Intenta de nuevo.')
  }
}
</script>

<style scoped>
.product-catalog-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
.product-catalog-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.product-catalog-view__title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}
</style>
