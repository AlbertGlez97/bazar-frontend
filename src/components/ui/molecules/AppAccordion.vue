<template>
  <!-- Molécula: acordeón accesible. Un panel abierto a la vez; el disparador es un
       botón real dentro de un encabezado y el panel una región etiquetada por él. -->
  <div
    ref="root"
    class="app-accordion"
  >
    <div
      v-for="item in items"
      :key="item.id"
      class="app-accordion__item"
      :class="{ 'app-accordion__item--open': current === item.id }"
    >
      <component
        :is="`h${headingLevel}`"
        class="app-accordion__heading"
      >
        <button
          :id="`${prefix}-trigger-${item.id}`"
          type="button"
          class="app-accordion__trigger"
          :data-item-id="item.id"
          :aria-expanded="current === item.id ? 'true' : 'false'"
          :aria-controls="`${prefix}-panel-${item.id}`"
          @click="toggle(item.id)"
          @keydown="onKeydown"
        >
          <span class="app-accordion__title">
            <slot
              name="title"
              :item="item"
              :open="current === item.id"
            >{{ item.title }}</slot>
          </span>
          <ChevronDown
            class="app-accordion__chevron"
            :size="18"
            aria-hidden="true"
          />
        </button>
      </component>
      <!-- grid 0fr -> 1fr: se anima la fila, nunca la altura -->
      <div
        :id="`${prefix}-panel-${item.id}`"
        class="app-accordion__panel"
        role="region"
        :aria-labelledby="`${prefix}-trigger-${item.id}`"
        :inert="current === item.id ? undefined : true"
      >
        <div class="app-accordion__panel-inner">
          <div class="app-accordion__content">
            <slot
              name="panel"
              :item="item"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends AccordionItem">
import { computed, ref, useId } from 'vue'
import { ChevronDown } from '@lucide/vue'

export interface AccordionItem {
  id: string
  title: string
}

const props = withDefaults(defineProps<{
  items: readonly T[]
  /** Controlled open item (`null` = all closed). Leave it out to let the accordion manage itself. */
  modelValue?: string | null
  /** Initial open item when uncontrolled. */
  defaultOpen?: string | null
  /** Prefix of the generated ids (`<prefix>-trigger-<id>`, `<prefix>-panel-<id>`). */
  idPrefix?: string
  headingLevel?: 2 | 3 | 4
}>(), {
  modelValue: undefined,
  defaultOpen: null,
  idPrefix: undefined,
  headingLevel: 3,
})

const emit = defineEmits<{ 'update:modelValue': [id: string | null] }>()

defineSlots<{
  title?(props: { item: T; open: boolean }): unknown
  panel?(props: { item: T }): unknown
}>()

const generated = useId()
const prefix = computed(() => props.idPrefix ?? `accordion-${generated}`)
const root = ref<HTMLElement | null>(null)
const inner = ref<string | null>(props.defaultOpen)
const current = computed(() => (props.modelValue !== undefined ? props.modelValue : inner.value))

function toggle(id: string) {
  const next = current.value === id ? null : id
  if (props.modelValue === undefined) inner.value = next
  emit('update:modelValue', next)
}

/** Arrow keys, Home and End move between triggers; Enter and Space are native button activation. */
function onKeydown(event: KeyboardEvent) {
  const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(event.key)) return
  const buttons = [...(root.value?.querySelectorAll<HTMLButtonElement>('.app-accordion__trigger') ?? [])]
  if (buttons.length === 0) return
  const index = buttons.indexOf(event.currentTarget as HTMLButtonElement)
  let next = index
  if (event.key === 'ArrowDown') next = (index + 1) % buttons.length
  else if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length
  else if (event.key === 'Home') next = 0
  else next = buttons.length - 1
  event.preventDefault()
  buttons[next]?.focus()
}
</script>

<style scoped>
.app-accordion { display: flex; flex-direction: column; min-width: 0; border-top: 1px solid var(--color-border); }
.app-accordion__item { border-bottom: 1px solid var(--color-border); min-width: 0; }
.app-accordion__heading { font-size: inherit; font-family: inherit; letter-spacing: normal; line-height: inherit; }

.app-accordion__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  width: 100%;
  min-height: 44px;
  padding: var(--spacing-sm) var(--spacing-xs);
  text-align: left;
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--color-text);
  border-radius: var(--radius-sm);
  transition: background var(--motion-fast) var(--motion-ease), color var(--motion-fast) var(--motion-ease);
}
.app-accordion__trigger:hover { background: color-mix(in srgb, var(--color-primary) 7%, transparent); }
.app-accordion__trigger:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: -3px; }
.app-accordion__title { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs) var(--spacing-sm); min-width: 0; overflow-wrap: anywhere; }
.app-accordion__chevron { flex-shrink: 0; color: var(--color-text-muted); transition: transform var(--motion-base) var(--motion-ease); }
.app-accordion__item--open .app-accordion__chevron { transform: rotate(180deg); }

.app-accordion__panel {
  display: grid;
  grid-template-rows: 0fr;
  visibility: hidden;
  opacity: 0;
  transition:
    grid-template-rows var(--motion-base) var(--motion-ease),
    opacity var(--motion-base) var(--motion-ease),
    visibility 0s linear var(--motion-base);
}
.app-accordion__item--open > .app-accordion__panel {
  grid-template-rows: 1fr;
  visibility: visible;
  opacity: 1;
  transition-delay: 0s;
}
.app-accordion__panel-inner { min-height: 0; overflow: hidden; }
.app-accordion__content { padding: var(--spacing-xs) var(--spacing-xs) var(--spacing-md); min-width: 0; }

@media (prefers-reduced-motion: reduce) {
  .app-accordion__trigger,
  .app-accordion__chevron,
  .app-accordion__panel { transition: none; }
}
</style>
