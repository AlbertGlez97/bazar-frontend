<template>
  <!-- Vista: catálogo de productos. Ensambla el grid, el modal de crear/
       editar y el modal de confirmación de desactivación; delega toda la
       lógica de negocio real (llamadas HTTP) al store, no a los átomos. -->
  <div class="product-catalog-view">
    <div class="product-catalog-view__header">
      <h1 class="product-catalog-view__title">
        Catálogo de productos
      </h1>
      <AppButton
        v-if="isSocio"
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
      :show-actions="isSocio"
      @search="handleSearch"
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
      <strong>{{ productPendingDeactivation?.name }}</strong>? Podrás
      reactivarlo después desde el catálogo.
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AppButton, AppModal, ProductCatalogGrid, ProductFormModal } from '@/components'
import { useProductsStore } from '@/stores/products.store'
import { useSessionStore } from '@/stores/session.store'
import { useToastStore } from '@/stores/toast.store'
import type { Product, ProductFormSubmitPayload } from '@/types/product.types'

const store = useProductsStore()
const session = useSessionStore()
const toast = useToastStore()

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
  store.fetchProducts().catch(() => toast.error('No se pudo cargar el catálogo de productos'))
})

function handleSearch(term: string) {
  store.fetchProducts({ page: 1, search: term }).catch(() => toast.error('No se pudo buscar productos'))
}

function handlePageChange(page: number) {
  store.fetchProducts({ page }).catch(() => toast.error('No se pudo cambiar de página'))
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
  isSubmitting.value = true
  try {
    let product: Product
    if (editingProduct.value) {
      product = await store.updateProduct(editingProduct.value.id, rest)
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
        toast.error('El producto se guardó, pero la imagen no pudo subirse. Intenta subirla de nuevo editando el producto.')
      }
    }

    toast.success(editingProduct.value ? 'Producto actualizado' : 'Producto creado')
    isFormModalOpen.value = false
  } catch {
    toast.error('No se pudo guardar el producto')
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
    toast.success('Producto desactivado')
  } catch {
    toast.error('No se pudo desactivar el producto')
  } finally {
    isConfirmModalOpen.value = false
    productPendingDeactivation.value = null
  }
}

async function handleReactivate(product: Product) {
  try {
    await store.reactivateProduct(product.id)
    toast.success('Producto reactivado')
  } catch {
    toast.error('No se pudo reactivar el producto')
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
