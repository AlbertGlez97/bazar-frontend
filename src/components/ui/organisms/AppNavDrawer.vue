<template>
  <!-- Organismo: el menú del socio en el celular (menos de 900 px, sin barra
       lateral). Cajón por la izquierda con: cambio Venta/Gestión, los ítems del
       modo, Ajustes, el nombre de la cuenta y "Cerrar sesión". Lo difícil del
       diálogo (foco atrapado, Escape, clic fuera, devolver el foco) lo da
       AppDrawer. Presentacional: recibe el modo y los ítems, no lee stores. -->
  <AppDrawer
    :model-value="modelValue"
    title="Menú"
    close-label="Cerrar menú"
    side="left"
    :return-focus="returnFocus"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="app-nav-drawer">
      <UiModeSwitch
        :model-value="mode"
        @update:model-value="onMode"
      />

      <nav
        class="app-nav-drawer__nav"
        aria-label="Navegación principal"
      >
        <RouterLink
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          class="app-nav-drawer__link"
          :active-class="item.exact ? undefined : 'app-nav-drawer__link--active'"
          exact-active-class="app-nav-drawer__link--active"
          @click="close"
        >
          <span
            class="app-nav-drawer__icon"
            aria-hidden="true"
          >{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
        <RouterLink
          to="/app/ajustes"
          class="app-nav-drawer__link"
          active-class="app-nav-drawer__link--active"
          @click="close"
        >
          <span
            class="app-nav-drawer__icon"
            aria-hidden="true"
          >⚙️</span>
          <span>Ajustes</span>
        </RouterLink>
      </nav>
    </div>

    <template #footer>
      <div class="app-nav-drawer__account">
        <AppAvatar
          :name="accountName"
          size="sm"
        />
        <span class="app-nav-drawer__name">{{ accountName }}</span>
      </div>
      <button
        type="button"
        class="app-nav-drawer__logout"
        data-action="logout"
        @click="onLogout"
      >
        Cerrar sesión
      </button>
    </template>
  </AppDrawer>
</template>

<script setup lang="ts">
import type { UiMode } from '@/types/ui-mode.types'
import AppAvatar from '../atoms/AppAvatar.vue'
import AppDrawer from './AppDrawer.vue'
import UiModeSwitch from './UiModeSwitch.vue'

export interface NavDrawerItem {
  to: string
  label: string
  icon: string
  /** `true` = solo activo en la ruta exacta (Inicio). */
  exact: boolean
}

defineProps<{
  modelValue: boolean
  items: NavDrawerItem[]
  mode: UiMode
  accountName: string
  /** Botón que lo abrió, para devolverle el foco al cerrar. */
  returnFocus?: HTMLElement | null
}>()

const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  'update:mode': [mode: UiMode]
  logout: []
}>()

function close() { emit('update:modelValue', false) }

function onMode(mode: UiMode) {
  emit('update:mode', mode)
  close()
}

function onLogout() {
  close()
  emit('logout')
}
</script>

<style scoped>
.app-nav-drawer { display: flex; flex-direction: column; gap: var(--spacing-md); }

.app-nav-drawer__nav { display: flex; flex-direction: column; gap: var(--spacing-xs); }
.app-nav-drawer__link {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  min-height: 3rem;
  padding: 0 var(--spacing-md);
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
  border-radius: var(--radius-md);
  border: 2px solid transparent;
}
.app-nav-drawer__link:hover { background: var(--color-surface-alt); }
.app-nav-drawer__link:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.app-nav-drawer__link--active { font-weight: 800; background: var(--color-surface-alt); border-color: var(--color-border-strong); }
.app-nav-drawer__icon { font-size: 1.25rem; line-height: 1; }

.app-nav-drawer__account { display: flex; align-items: center; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm); min-width: 0; }
.app-nav-drawer__name { min-width: 0; overflow: hidden; font-weight: 700; color: var(--color-text); text-overflow: ellipsis; white-space: nowrap; }
.app-nav-drawer__logout {
  width: 100%;
  min-height: 3rem;
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--color-danger);
  background: transparent;
  border: 2px solid color-mix(in srgb, var(--color-danger) 45%, transparent);
  border-radius: var(--radius-md);
  cursor: pointer;
  touch-action: manipulation;
}
.app-nav-drawer__logout:hover { background: var(--color-danger-soft); }
.app-nav-drawer__logout:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
</style>
