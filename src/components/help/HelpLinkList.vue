<template>
  <!-- Lista de enlaces con chevron: categorías, temas y sugerencias comparten esta forma. -->
  <ul class="help-link-list">
    <li
      v-for="item in items"
      :key="item.key"
    >
      <HelpLink
        :to="item.to"
        class="help-link-list__link"
      >
        <component
          :is="item.icon"
          v-if="item.icon"
          class="help-link-list__icon"
          :size="20"
          aria-hidden="true"
        />
        <span class="help-link-list__text">
          <span class="help-link-list__title">{{ item.title }}</span>
          <span
            v-if="item.description"
            class="help-link-list__description"
          >{{ item.description }}</span>
        </span>
        <ChevronRight
          class="help-link-list__chevron"
          :size="18"
          aria-hidden="true"
        />
      </HelpLink>
    </li>
  </ul>
</template>

<script setup lang="ts">
import HelpLink from './HelpLink.vue'
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { ChevronRight } from '@lucide/vue'

export interface HelpLinkItem {
  key: string
  title: string
  description?: string
  to: RouteLocationRaw
  icon?: Component
}

defineProps<{ items: readonly HelpLinkItem[] }>()
</script>

<style scoped>
.help-link-list { display: flex; flex-direction: column; border-top: 1px solid var(--color-border); }
.help-link-list li { border-bottom: 1px solid var(--color-border); }
.help-link-list__link {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: 56px;
  padding: var(--spacing-sm) var(--spacing-xs);
  border-radius: var(--radius-sm);
  transition: background var(--motion-fast) var(--motion-ease);
}
.help-link-list__link:hover { background: color-mix(in srgb, var(--color-primary) 7%, transparent); }
.help-link-list__icon { flex-shrink: 0; color: var(--color-primary); }
.help-link-list__text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.help-link-list__title { font-weight: 700; overflow-wrap: anywhere; }
.help-link-list__description { color: var(--color-text-muted); font-size: var(--font-size-sm); overflow-wrap: anywhere; }
.help-link-list__chevron { flex-shrink: 0; color: var(--color-text-muted); }
</style>
