<template>
  <!-- Molécula: barra superior del celular y la tablet vertical (menos de 900 px,
       donde ya no hay barra lateral). Título de la pantalla y botones con TEXTO:
       "Ayuda" siempre; "Menú" a la izquierda para quien administra y "Mi cuenta"
       (cambiar contraseña, cerrar sesión) para quien solo vende.
       Presentacional: avisa lo que se toca, no navega. -->
  <header class="app-top-bar">
    <button
      v-if="showMenu"
      ref="menuEl"
      type="button"
      class="app-top-bar__menu"
      aria-label="Menú"
      aria-haspopup="dialog"
      :aria-expanded="menuOpen ? 'true' : 'false'"
      @click="emit('menu')"
    >
      <Menu
        :size="24"
        aria-hidden="true"
      />
    </button>

    <h2 class="app-top-bar__title">
      {{ title }}
    </h2>

    <button
      v-if="showHelp"
      ref="helpEl"
      type="button"
      class="app-top-bar__help"
      aria-haspopup="dialog"
      :aria-expanded="helpOpen ? 'true' : 'false'"
      @click="emit('help')"
    >
      <CircleHelp
        :size="20"
        aria-hidden="true"
      />
      <span>Ayuda</span>
    </button>

    <AccountMenu
      v-if="showAccount"
      :online="online"
      @change-password="emit('change-password')"
      @logout="emit('logout')"
    />
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CircleHelp, Menu } from '@lucide/vue'
import AccountMenu from './AccountMenu.vue'

withDefaults(defineProps<{
  title: string
  /** Socio: botón de menú a la izquierda que abre el cajón de navegación. */
  showMenu?: boolean
  menuOpen?: boolean
  /** La propia pantalla de ayuda no lo muestra. */
  showHelp?: boolean
  helpOpen?: boolean
  /** Colaborador: sin menú, "Mi cuenta" a la vista. */
  showAccount?: boolean
  /** Hay conexión (para el aviso de "Cambiar contraseña"). */
  online?: boolean
}>(), { showMenu: false, menuOpen: false, showHelp: true, helpOpen: false, showAccount: false, online: true })

const emit = defineEmits<{ menu: []; help: []; 'change-password': []; logout: [] }>()

const menuEl = ref<HTMLButtonElement | null>(null)
const helpEl = ref<HTMLButtonElement | null>(null)
// Quien lo usa necesita los botones para devolver el foco al cerrar un cajón.
defineExpose({ menuEl, helpEl })
</script>

<style scoped>
.app-top-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: 3.5rem;
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

.app-top-bar__title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: var(--font-size-lg);
  font-weight: 800;
  line-height: 1.2;
  color: var(--color-text);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.app-top-bar__menu,
.app-top-bar__help {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: 0 var(--spacing-sm);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--color-text);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  touch-action: manipulation;
  transition: background var(--motion-fast) var(--motion-ease);
}
.app-top-bar__help { color: var(--color-primary); }
.app-top-bar__menu:hover,
.app-top-bar__help:hover,
.app-top-bar__menu[aria-expanded='true'],
.app-top-bar__help[aria-expanded='true'] { background: var(--color-surface-alt); }
.app-top-bar__menu:focus-visible,
.app-top-bar__help:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
</style>
