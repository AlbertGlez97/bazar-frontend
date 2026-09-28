<template>
  <!-- Vista: "Códigos QR" (solo socios, Modo Gestión, D2). Contenedor: busca
       productos, arma la lista de impresión (copias por producto) en estado
       LOCAL (transitorio, no un store) y genera la hoja de etiquetas
       reutilizando LabelPrintDialog/useLabelPrinting tal cual, sin tocar la
       selección por casillas del catálogo (interacción aparte). -->
  <section
    class="codigos-qr-view"
    aria-labelledby="codigos-qr-title"
  >
    <header class="codigos-qr-view__header">
      <h1
        id="codigos-qr-title"
        class="codigos-qr-view__title"
      >
        {{ VOICE.codigosQr.title }}
      </h1>
      <p class="codigos-qr-view__lead">
        {{ VOICE.codigosQr.lead }}
      </p>
    </header>

    <ProductSearchPicker
      :results="searchResults"
      :loading="searchLoading"
      :error-message="searchError"
      @search="onSearch"
      @add="addToList"
    />

    <LabelPrintList
      :rows="printListRows"
      @increment="increment"
      @decrement="decrement"
      @remove="removeRow"
    />

    <div class="codigos-qr-view__actions">
      <AppButton
        variant="primary"
        size="lg"
        type="button"
        :disabled="totalLabels === 0"
        @click="isPrintDialogOpen = true"
      >
        {{ VOICE.labels.print }}
      </AppButton>
    </div>

    <LabelPrintDialog
      v-model="isPrintDialogOpen"
      :label-count="totalLabels"
      :calibration="labelCalibration.calibration"
      :busy="printBusy"
      :error="printError"
      @update:calibration="labelCalibration.set($event)"
      @reset="labelCalibration.reset()"
      @preview="previewLabels(labelInputs)"
      @download="downloadLabels(labelInputs)"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AppButton, LabelPrintDialog, LabelPrintList, ProductSearchPicker } from '@/components'
import { VOICE, isNetworkError } from '@/config/voice'
import ProductsService from '@/services/products.service'
import { useLabelPrinting } from '@/composables/useLabelPrinting'
import { useLabelCalibrationStore } from '@/stores/label-calibration.store'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import type { LabelInput } from '@/utils/label-sheet-plan'
import type { Product } from '@/types/product.types'

const router = useRouter()
const session = useSessionStore()
const uiMode = useUiModeStore()

// ── Permisos vivos ────────────────────────────────────────────────────────
// El guard del router ya impide entrar; aquí se vigila lo que cambia con la
// vista abierta (otro modo, otra persona en el mismo dispositivo) — mismo
// patrón que ReportsView.
watch(
  [() => uiMode.currentMode, () => session.member?.role],
  ([mode, role]) => {
    if (mode !== 'gestion' || role !== 'socio') router.replace({ name: 'AppHome' })
  },
)

// ── Buscador ──────────────────────────────────────────────────────────────
// Solo se consulta con texto: es un buscador, no un catálogo completo (nunca
// una lista larga para tildar). Cada consulta lleva un número: si llega una
// respuesta vieja después de una más nueva, se descarta.
const searchResults = ref<Product[]>([])
const searchLoading = ref(false)
const searchError = ref('')
let searchToken = 0

async function onSearch(term: string) {
  const trimmed = term.trim()
  if (!trimmed) {
    searchToken += 1 // invalida cualquier búsqueda en camino
    searchResults.value = []
    searchError.value = ''
    searchLoading.value = false
    return
  }
  const token = ++searchToken
  searchLoading.value = true
  searchError.value = ''
  try {
    const { items } = await ProductsService.listProducts({ search: trimmed, limit: 10, page: 1, includeInactive: false })
    if (token !== searchToken) return
    searchResults.value = items
  } catch (cause) {
    if (token !== searchToken) return
    searchResults.value = []
    searchError.value = isNetworkError(cause) ? VOICE.networkError : VOICE.apiErrors.catalog.search
  } finally {
    if (token === searchToken) searchLoading.value = false
  }
}

// ── Lista de impresión ──────────────────────────────────────────────────────
// Estado LOCAL (Map: conserva el orden de inserción, no un store — el mismo
// criterio ya usado para la selección vieja del catálogo, transitorio a
// propósito). Agregar un producto ya en la lista incrementa `copies` en vez
// de duplicar la fila.
const printList = reactive(new Map<string, { id: string; name: string; copies: number }>())
const printListRows = computed(() => Array.from(printList.values()))

function addToList(product: Product) {
  const existing = printList.get(product.id)
  if (existing) existing.copies += 1
  else printList.set(product.id, { id: product.id, name: product.name, copies: 1 })
}
function increment(id: string) {
  const row = printList.get(id)
  if (row) row.copies += 1
}
function decrement(id: string) {
  const row = printList.get(id)
  if (!row) return
  if (row.copies <= 1) printList.delete(id)
  else row.copies -= 1
}
function removeRow(id: string) {
  printList.delete(id)
}

const totalLabels = computed(() => printListRows.value.reduce((sum, row) => sum + row.copies, 0))

// ── Generar PDF ──────────────────────────────────────────────────────────
// LabelInput no tiene campo de copias: N copias de un producto son su
// {id, name} repetido N veces, en el orden en que se agregó a la lista.
const labelInputs = computed<LabelInput[]>(() =>
  printListRows.value.flatMap((row) => Array.from({ length: row.copies }, () => ({ id: row.id, name: row.name }))),
)

const labelCalibration = useLabelCalibrationStore()
const { busy: printBusy, error: printError, preview: previewLabels, download: downloadLabels } = useLabelPrinting()
const isPrintDialogOpen = ref(false)
</script>

<style scoped>
.codigos-qr-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 48rem;
  min-width: 0;
}

.codigos-qr-view__header { display: flex; flex-direction: column; gap: var(--spacing-xs); }
.codigos-qr-view__title { margin: 0; font-size: var(--font-size-xl); color: var(--color-text); }
.codigos-qr-view__lead { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }

.codigos-qr-view__actions { display: flex; }
</style>
