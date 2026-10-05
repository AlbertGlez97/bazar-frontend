<template>
  <!-- Molécula: pestañas de navegación entre pantallas hermanas (p. ej.
       Finanzas > Aportaciones | Gastos). Presentacional: recibe las pestañas y
       cuál está activa; cada pestaña es un enlace real, así que funciona con
       teclado y con el historial del navegador. -->
  <nav
    class="tab-nav"
    :aria-label="label"
  >
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="tab-nav__tab"
      :class="{ 'tab-nav__tab--active': tab.to === active }"
      :aria-current="tab.to === active ? 'page' : undefined"
    >
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  /** Nombre accesible de la navegación. */
  label: string
  tabs: readonly { to: string; label: string }[]
  /** `to` de la pestaña activa. */
  active: string
}>()
</script>

<style scoped>
.tab-nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  border-bottom: 1px solid var(--color-border);
}
.tab-nav__tab {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0 var(--spacing-md);
  font-weight: 700;
  color: var(--color-text-muted);
  text-decoration: none;
  border-bottom: 3px solid transparent;
  margin-bottom: -1px;
}
.tab-nav__tab:hover { color: var(--color-text); }
.tab-nav__tab--active {
  color: var(--color-primary-hover);
  border-bottom-color: var(--color-primary);
}
.tab-nav__tab:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
