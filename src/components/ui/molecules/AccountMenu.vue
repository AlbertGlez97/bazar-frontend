<template>
  <!-- Molécula: "Mi cuenta" de la barra superior del colaborador en celular.
       Un panel pequeño (AppDropdownPanel: hoja desde abajo, cierra con clic
       fuera y Escape, foco atrapado) con "Cambiar contraseña" y "Cerrar sesión".
       Presentacional: avisa lo que se toca; quien lo usa navega o cierra la sesión.
       Sin conexión, cambiar la contraseña necesita internet: lo dice en una
       frase corta en vez de llevar a una pantalla que no podría guardar. -->
  <AppDropdownPanel
    v-model="open"
    class="account-menu"
    title="Mi cuenta"
    close-label="Cerrar"
    align="end"
  >
    <template #trigger="{ attrs }">
      <button
        type="button"
        class="account-menu__trigger"
        v-bind="(attrs as Record<string, unknown>)"
      >
        <CircleUser
          :size="20"
          aria-hidden="true"
        />
        <span>Mi cuenta</span>
      </button>
    </template>

    <div class="account-menu__list">
      <button
        type="button"
        class="account-menu__item"
        data-action="change-password"
        @click="onChangePassword"
      >
        <span aria-hidden="true">🔑</span>
        <span>Cambiar contraseña</span>
      </button>
      <nav
        class="account-menu__legal"
        :aria-label="LEGAL_NAV_LABEL"
      >
        <RouterLink
          v-for="link in LEGAL_LINKS"
          :key="link.to"
          :to="link.to"
          class="account-menu__legal-link"
          @click="open = false"
        >
          {{ link.label }}
        </RouterLink>
      </nav>
      <div class="account-menu__install">
        <InstallAppButton variant="ghost" />
      </div>
      <p
        v-if="offlineNotice"
        class="account-menu__notice"
        role="status"
        v-text="OFFLINE_NOTICE"
      />
      <button
        type="button"
        class="account-menu__item account-menu__item--danger"
        data-action="logout"
        @click="onLogout"
      >
        <span aria-hidden="true">🚪</span>
        <span>Cerrar sesión</span>
      </button>
    </div>
  </AppDropdownPanel>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { CircleUser } from '@lucide/vue'
import { LEGAL_LINKS, LEGAL_NAV_LABEL } from '@/legal/legal-links'
import AppDropdownPanel from './AppDropdownPanel.vue'
import InstallAppButton from './InstallAppButton.vue'

const props = withDefaults(defineProps<{
  /** Hay conexión: sin ella "Cambiar contraseña" avisa en vez de navegar. */
  online?: boolean
}>(), { online: true })

const emit = defineEmits<{ 'change-password': []; logout: [] }>()

const OFFLINE_NOTICE = 'Necesitas internet para cambiar tu contraseña.'

const open = ref(false)
const offlineNotice = ref(false)

// El aviso no se queda pegado: cada vez que se abre el panel empieza limpio.
watch(open, (isOpen) => { if (isOpen) offlineNotice.value = false })

function onChangePassword() {
  if (!props.online) {
    offlineNotice.value = true
    return
  }
  open.value = false
  emit('change-password')
}

function onLogout() {
  open.value = false
  emit('logout')
}
</script>

<style scoped>
.account-menu__trigger {
  display: inline-flex;
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
}
.account-menu__trigger:hover,
.account-menu__trigger[aria-expanded='true'] { background: var(--color-surface-alt); }
.account-menu__trigger:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }

.account-menu__legal { display: flex; flex-direction: column; gap: var(--spacing-xs); }
.account-menu__legal-link {
  display: flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0 var(--spacing-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-muted);
  text-decoration: underline;
  text-underline-offset: 0.2em;
  border-radius: var(--radius-md);
}
.account-menu__legal-link:hover { background: var(--color-surface-alt); }
.account-menu__legal-link:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }

/* Sin botón no ocupa lugar */
.account-menu__install:not(:has(.install-btn)) { display: none; }
.account-menu__install :deep(.install-btn) { width: 100%; min-height: 3rem; justify-content: flex-start; padding: 0 var(--spacing-md); border-color: transparent; color: var(--color-text); font-size: var(--font-size-md); font-weight: 600; }

.account-menu__list { display: flex; flex-direction: column; gap: var(--spacing-xs); }
.account-menu__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  width: 100%;
  min-height: 3rem;
  padding: 0 var(--spacing-md);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: 600;
  text-align: left;
  color: var(--color-text);
  background: transparent;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  touch-action: manipulation;
}
.account-menu__item:hover { background: var(--color-surface-alt); }
.account-menu__item:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.account-menu__item--danger { color: var(--color-danger); }
.account-menu__notice {
  margin: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-info);
  background: var(--color-info-soft);
  border-radius: var(--radius-md);
}
</style>
