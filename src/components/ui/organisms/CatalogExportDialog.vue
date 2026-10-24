<template>
  <!-- Organismo: diálogo "Generar catálogo" (Word). Presentacional: recibe las opciones y el
       resumen y emite cada cambio; NO baja productos ni genera nada (lo hace el contenedor).
       Cada ajuste trae su valor sugerido y una línea corta de por qué. -->
  <AppModal
    :model-value="modelValue"
    :title="VOICE.catalogExport.title"
    size="lg"
    hide-footer
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="catalog-export">
      <AppHint>{{ VOICE.catalogExport.intro }}</AppHint>

      <AppAlert
        v-if="offline"
        type="warning"
        :show="true"
      >
        {{ VOICE.catalogExport.offline }}
      </AppAlert>
      <AppAlert
        v-if="error"
        type="error"
        :show="true"
      >
        {{ error }}
      </AppAlert>

      <p
        v-if="loading"
        class="catalog-export__status"
        role="status"
      >
        {{ VOICE.catalogExport.loading }}
      </p>

      <template v-if="loaded">
        <AppInput
          :label="VOICE.catalogExport.businessName"
          :hint="VOICE.catalogExport.businessNameHint"
          :model-value="settings.businessName"
          :maxlength="BUSINESS_NAME_MAX"
          type="text"
          name="businessName"
          autocomplete="off"
          @update:model-value="emitSettings({ businessName: String($event) })"
        />

        <fieldset class="catalog-export__group">
          <legend>{{ VOICE.catalogExport.groups.what }}</legend>
          <ChoiceField
            :label="VOICE.catalogExport.filter.label"
            :hint="VOICE.catalogExport.filter.hint"
            :model-value="settings.filter.mode"
            :options="FILTER_OPTIONS"
            @update:model-value="onFilterMode"
          />

          <div
            v-if="settings.filter.mode === 'categories'"
            class="catalog-export__list"
          >
            <p class="catalog-export__list-title">
              {{ VOICE.catalogExport.filter.categoriesLabel }}
            </p>
            <AppHint v-if="categories.length === 0">
              {{ VOICE.catalogExport.filter.categoriesEmpty }}
            </AppHint>
            <AppCheckbox
              v-for="category in categories"
              :key="category"
              :model-value="selectedCategories.has(category)"
              @update:model-value="toggleCategory(category, $event)"
            >
              {{ category }}
            </AppCheckbox>
          </div>

          <div
            v-if="settings.filter.mode === 'manual'"
            class="catalog-export__list"
          >
            <AppInput
              v-model="search"
              type="search"
              :label="VOICE.catalogExport.filter.searchLabel"
              :placeholder="VOICE.catalogExport.filter.searchPlaceholder"
              autocomplete="off"
            />
            <p
              class="catalog-export__list-title"
              aria-live="polite"
            >
              {{ VOICE.catalogExport.filter.manualCount(selectedIds.size) }}
            </p>
            <AppHint v-if="matches.length === 0">
              {{ VOICE.catalogExport.filter.manualEmpty }}
            </AppHint>
            <div class="catalog-export__scroll">
              <AppCheckbox
                v-for="candidate in visibleMatches"
                :key="candidate.id"
                :model-value="selectedIds.has(candidate.id)"
                @update:model-value="toggleId(candidate.id, $event)"
              >
                {{ candidate.name }}<span
                  v-if="candidate.detail"
                  class="catalog-export__detail"
                > — {{ candidate.detail }}</span>
              </AppCheckbox>
            </div>
            <AppHint v-if="matches.length > visibleMatches.length">
              {{ VOICE.catalogExport.filter.manualMore(visibleMatches.length, matches.length) }}
            </AppHint>
          </div>

          <FilterSwitchRow
            :label="VOICE.catalogExport.group.label"
            :hint="VOICE.catalogExport.group.hint"
            :model-value="settings.groupVariants"
            @update:model-value="emitSettings({ groupVariants: $event })"
          />
        </fieldset>

        <fieldset class="catalog-export__group">
          <legend>{{ VOICE.catalogExport.groups.fields }}</legend>
          <FilterSwitchRow
            v-for="field in FIELD_ROWS"
            :key="field.key"
            :label="field.label"
            :hint="field.hint"
            :model-value="settings.fields[field.key]"
            @update:model-value="emitSettings({ fields: { [field.key]: $event } })"
          />
        </fieldset>

        <fieldset
          v-if="settings.fields.stock"
          class="catalog-export__group"
        >
          <legend>{{ VOICE.catalogExport.groups.stock }}</legend>
          <ChoiceField
            :label="VOICE.catalogExport.stockMode.label"
            :hint="VOICE.catalogExport.stockMode.hint"
            :model-value="settings.stockMode"
            :options="STOCK_OPTIONS"
            @update:model-value="emitSettings({ stockMode: $event as StockMode })"
          />
          <AppInput
            v-if="settings.stockMode === 'availability'"
            type="number"
            inputmode="numeric"
            autocomplete="off"
            min="0"
            :max="MAX_LOW_STOCK_THRESHOLD"
            step="1"
            :label="VOICE.catalogExport.stockMode.thresholdLabel"
            :hint="VOICE.catalogExport.stockMode.thresholdHint"
            :model-value="settings.lowStockThreshold"
            @update:model-value="onThreshold($event)"
          />
        </fieldset>

        <fieldset class="catalog-export__group">
          <legend>{{ VOICE.catalogExport.groups.design }}</legend>
          <ChoiceField
            :label="VOICE.catalogExport.design.columns"
            :hint="VOICE.catalogExport.design.columnsHint"
            :model-value="String(settings.columns)"
            :options="COLUMN_OPTIONS"
            @update:model-value="emitSettings({ columns: Number($event) as 1 | 2 | 3 })"
          />
          <FilterSwitchRow
            :label="VOICE.catalogExport.design.pageBreak"
            :hint="VOICE.catalogExport.design.pageBreakHint"
            :model-value="settings.pageBreakPerCategory"
            @update:model-value="emitSettings({ pageBreakPerCategory: $event })"
          />
        </fieldset>

        <fieldset class="catalog-export__group">
          <legend>{{ VOICE.catalogExport.groups.cover }}</legend>
          <FilterSwitchRow
            :label="VOICE.catalogExport.cover.showDate"
            :hint="VOICE.catalogExport.cover.showDateHint"
            :model-value="settings.showDate"
            @update:model-value="emitSettings({ showDate: $event })"
          />
          <FilterSwitchRow
            :label="VOICE.catalogExport.cover.toc"
            :hint="VOICE.catalogExport.cover.tocHint"
            :model-value="settings.tableOfContents"
            @update:model-value="emitSettings({ tableOfContents: $event })"
          />
          <AppAlert
            v-if="settings.tableOfContents"
            type="info"
            :show="true"
          >
            {{ VOICE.catalogExport.cover.tocWarning }}
          </AppAlert>
        </fieldset>

        <fieldset
          v-if="settings.fields.photo"
          class="catalog-export__group"
        >
          <legend>{{ VOICE.catalogExport.groups.photo }}</legend>
          <ChoiceField
            :label="VOICE.catalogExport.photoQuality.label"
            :hint="VOICE.catalogExport.photoQuality.hint"
            :model-value="settings.photoQuality"
            :options="QUALITY_OPTIONS"
            @update:model-value="emitSettings({ photoQuality: $event as PhotoQualityChoice })"
          />
        </fieldset>

        <p
          class="catalog-export__summary"
          aria-live="polite"
        >
          {{ summaryText }}
        </p>
      </template>

      <div
        v-if="busy"
        class="catalog-export__progress"
        role="status"
      >
        <AppProgress
          :value="progressPercent"
          show-label
        />
        <p class="catalog-export__status">
          {{ phase === 'photos' ? VOICE.catalogExport.photosProgress(progress.done, progress.total) : VOICE.catalogExport.documentProgress }}
        </p>
      </div>

      <div class="catalog-export__actions">
        <AppButton
          variant="ghost"
          size="sm"
          :disabled="busy"
          @click="$emit('restore')"
        >
          {{ VOICE.catalogExport.restore }}
        </AppButton>
        <AppButton
          v-if="!loaded && !loading"
          variant="secondary"
          @click="$emit('retry')"
        >
          {{ VOICE.catalogExport.retry }}
        </AppButton>
        <AppButton
          v-if="phase === 'photos'"
          variant="secondary"
          @click="$emit('cancel')"
        >
          {{ VOICE.catalogExport.cancel }}
        </AppButton>
        <AppButton
          variant="primary"
          :loading="busy"
          :disabled="!canGenerate"
          @click="$emit('generate')"
        >
          {{ VOICE.catalogExport.generate }}
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { VOICE } from '@/config/voice'
import type { CatalogExportSettings, CatalogSettingsPatch, PhotoQualityChoice, StockMode } from '@/types/catalog.types'
import { BUSINESS_NAME_MAX, MAX_LOW_STOCK_THRESHOLD } from '@/utils/catalog-export-settings'
import { normalizeText } from '@/utils/text-normalize'
import AppButton from '../atoms/AppButton.vue'
import AppCheckbox from '../atoms/AppCheckbox.vue'
import AppHint from '../atoms/AppHint.vue'
import AppProgress from '../atoms/AppProgress.vue'
import AppAlert from '../molecules/AppAlert.vue'
import AppInput from '../molecules/AppInput.vue'
import ChoiceField from '../molecules/ChoiceField.vue'
import FilterSwitchRow from '../molecules/FilterSwitchRow.vue'
import type { SegmentedOption } from '../molecules/SegmentedControl.vue'
import AppModal from './AppModal.vue'

export interface CatalogCandidate {
  id: string
  name: string
  detail: string
}

type Phase = 'idle' | 'loading' | 'photos' | 'document'

/** Cuántos productos se dibujan a la vez en la selección manual (el buscador afina el resto). */
const MAX_VISIBLE_CANDIDATES = 100

const props = defineProps<{
  modelValue: boolean
  settings: CatalogExportSettings
  /** Categorías elegibles en el filtro ("Otros" al final si aplica). */
  categories: string[]
  /** Productos para la selección manual. */
  candidates: CatalogCandidate[]
  summary: { products: number; merged: number; photos: number; categories: number }
  /** `true` cuando ya se bajaron los productos. */
  loaded: boolean
  phase: Phase
  progress: { done: number; total: number }
  offline: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** Cambio parcial de las opciones (los datos por producto llegan como `fields` parcial). */
  'update:settings': [partial: CatalogSettingsPatch]
  restore: []
  generate: []
  cancel: []
  retry: []
}>()

const FILTER_OPTIONS: SegmentedOption[] = [
  { value: 'all', label: VOICE.catalogExport.filter.all },
  { value: 'categories', label: VOICE.catalogExport.filter.categories },
  { value: 'in-stock', label: VOICE.catalogExport.filter.inStock },
  { value: 'manual', label: VOICE.catalogExport.filter.manual },
]
const STOCK_OPTIONS: SegmentedOption[] = [
  { value: 'exact', label: VOICE.catalogExport.stockMode.exact },
  { value: 'availability', label: VOICE.catalogExport.stockMode.availability },
]
const COLUMN_OPTIONS: SegmentedOption[] = [
  { value: '1', label: VOICE.catalogExport.design.one },
  { value: '2', label: VOICE.catalogExport.design.two },
  { value: '3', label: VOICE.catalogExport.design.three },
]
const QUALITY_OPTIONS: SegmentedOption[] = [
  { value: 'normal', label: VOICE.catalogExport.photoQuality.normal },
  { value: 'high', label: VOICE.catalogExport.photoQuality.high },
]
const FIELD_ROWS = [
  { key: 'photo', label: VOICE.catalogExport.fields.photo, hint: VOICE.catalogExport.fields.photoHint },
  { key: 'brand', label: VOICE.catalogExport.fields.brand, hint: VOICE.catalogExport.fields.brandHint },
  { key: 'presentation', label: VOICE.catalogExport.fields.presentation, hint: VOICE.catalogExport.fields.presentationHint },
  { key: 'description', label: VOICE.catalogExport.fields.description, hint: VOICE.catalogExport.fields.descriptionHint },
  { key: 'price', label: VOICE.catalogExport.fields.price, hint: VOICE.catalogExport.fields.priceHint },
  { key: 'stock', label: VOICE.catalogExport.fields.stock, hint: VOICE.catalogExport.fields.stockHint },
] as const

const loading = computed(() => props.phase === 'loading')
const busy = computed(() => props.phase === 'photos' || props.phase === 'document')
const canGenerate = computed(() => props.loaded && !props.offline && !busy.value && props.summary.products > 0)
const progressPercent = computed(() => (props.phase === 'document' || props.progress.total === 0 ? (props.phase === 'document' ? 100 : 0) : Math.round((props.progress.done / props.progress.total) * 100)))
const summaryText = computed(() =>
  props.summary.products === 0
    ? VOICE.catalogExport.summaryEmpty
    : VOICE.catalogExport.summary(props.summary.products, props.summary.merged, props.settings.fields.photo ? props.summary.photos : 0, props.summary.categories),
)

function emitSettings(partial: CatalogSettingsPatch) {
  emit('update:settings', partial)
}

// ── Filtro ──────────────────────────────────────────────────────────────────
const selectedCategories = computed(() => new Set(props.settings.filter.mode === 'categories' ? props.settings.filter.categories : []))
const selectedIds = computed(() => new Set(props.settings.filter.mode === 'manual' ? props.settings.filter.ids : []))

function onFilterMode(mode: string) {
  if (mode === 'categories') emitSettings({ filter: { mode, categories: [...selectedCategories.value] } })
  else if (mode === 'manual') emitSettings({ filter: { mode, ids: [...selectedIds.value] } })
  else if (mode === 'all' || mode === 'in-stock') emitSettings({ filter: { mode } })
}

function toggleCategory(name: string, on: boolean) {
  const next = new Set(selectedCategories.value)
  if (on) next.add(name)
  else next.delete(name)
  emitSettings({ filter: { mode: 'categories', categories: props.categories.filter((category) => next.has(category)) } })
}

const search = ref('')
const matches = computed(() => {
  const needle = normalizeText(search.value)
  return needle ? props.candidates.filter((candidate) => normalizeText(`${candidate.name} ${candidate.detail}`).includes(needle)) : props.candidates
})
const visibleMatches = computed(() => matches.value.slice(0, MAX_VISIBLE_CANDIDATES))

function toggleId(id: string, on: boolean) {
  const next = new Set(selectedIds.value)
  if (on) next.add(id)
  else next.delete(id)
  emitSettings({ filter: { mode: 'manual', ids: [...next] } })
}

function onThreshold(value: string | number) {
  const parsed = Number(value)
  if (String(value).trim() === '' || !Number.isInteger(parsed)) return
  emitSettings({ lowStockThreshold: parsed })
}
</script>

<style scoped>
.catalog-export {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.catalog-export__group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin: 0;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 0;
}
.catalog-export__group legend {
  padding: 0 var(--spacing-xs);
  font-weight: 600;
}
.catalog-export__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
.catalog-export__list-title {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
}
.catalog-export__scroll {
  display: flex;
  flex-direction: column;
  max-height: 14rem;
  overflow-y: auto;
}
.catalog-export__detail { color: var(--color-text-muted); }
.catalog-export__summary { margin: 0; font-weight: 600; }
.catalog-export__status { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
.catalog-export__progress { display: flex; flex-direction: column; gap: var(--spacing-xs); }
.catalog-export__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
</style>
