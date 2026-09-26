<template>
  <!-- Vista: ajustes. Contenedor: decide qué entradas ve la persona según su rol
       (los socios ven además equipo y dispositivos) y las lista como enlaces
       grandes. Ocultar una entrada no basta: cada ruta de socios lo exige también
       en el guard del router, y el backend responde 403 de todas formas. -->
  <section
    class="settings-view"
    aria-labelledby="settings-title"
  >
    <header class="settings-view__header">
      <h1
        id="settings-title"
        class="settings-view__title"
      >
        {{ VOICE.settings.title }}
      </h1>
      <p class="settings-view__lead">
        {{ VOICE.settings.lead }}
      </p>
    </header>

    <nav
      :aria-label="VOICE.settings.title"
      class="settings-view__nav"
    >
      <ul class="settings-view__list">
        <li
          v-for="item in items"
          :key="item.to"
        >
          <RouterLink
            :to="item.to"
            class="settings-view__link"
          >
            <span
              class="settings-view__icon"
              aria-hidden="true"
            >{{ item.icon }}</span>
            <span class="settings-view__text">
              <span class="settings-view__label">{{ item.label }}</span>
              <span class="settings-view__hint">{{ item.hint }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </nav>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { VOICE } from '@/config/voice'
import { getSettingsItems } from '@/layouts/settings-items'
import { useSessionStore } from '@/stores/session.store'

const session = useSessionStore()

// El rol sale de la persona elegida en este dispositivo (la misma fuente que ya
// usan el menú lateral y el guard de Reportes): si cambia con la vista abierta,
// las entradas de socios aparecen o desaparecen en el momento.
const items = computed(() => getSettingsItems({ isSocio: session.member?.role === 'socio' }))
</script>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 40rem;
}
.settings-view__title { font-size: var(--font-size-xl); margin: 0; }
.settings-view__lead { color: var(--color-text-muted); margin: var(--spacing-xs) 0 0; }

.settings-view__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  list-style: none;
  margin: 0;
  padding: 0;
}

/* Cada entrada es un objetivo táctil de al menos 56 px */
.settings-view__link {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  min-height: 56px;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  text-decoration: none;
  transition: border-color var(--transition), box-shadow var(--transition);
}
.settings-view__link:hover { border-color: var(--color-primary); }
.settings-view__link:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.settings-view__icon { font-size: 24px; flex-shrink: 0; }
.settings-view__text { display: flex; flex-direction: column; gap: 2px; }
.settings-view__label { font-weight: 700; }
.settings-view__hint { color: var(--color-text-muted); font-size: var(--font-size-sm); }
</style>
