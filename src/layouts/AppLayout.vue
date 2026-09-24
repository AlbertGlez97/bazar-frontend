<template>
  <!-- Layout principal con sidebar lateral y área de contenido -->
  <div
    class="app-layout"
    :class="{ 'app-layout--collapsed': sidebarCollapsed }"
  >
    <!-- ── Sidebar ──────────────────────────────────────────────── -->
    <aside class="sidebar">
      <!-- Cabecera del sidebar -->
      <div class="sidebar__header">
        <span
          v-if="!sidebarCollapsed"
          class="sidebar__logo"
        >💰 FinanzasApp</span>
        <span
          v-else
          class="sidebar__logo-icon"
        >💰</span>
        <!-- Botón colapsar/expandir (AppButton ghost) -->
        <AppButton
          variant="ghost"
          size="sm"
          icon-only
          class="sidebar__toggle"
          :title="sidebarCollapsed ? 'Expandir' : 'Colapsar'"
          @click="toggleSidebar"
        >
          {{ sidebarCollapsed ? '→' : '←' }}
        </AppButton>
      </div>

      <!-- Navegación -->
      <nav class="sidebar__nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="sidebar__link"
          active-class="sidebar__link--active"
        >
          <span class="sidebar__link-icon">{{ item.icon }}</span>
          <span
            v-if="!sidebarCollapsed"
            class="sidebar__link-label"
          >{{ item.label }}</span>
        </RouterLink>
      </nav>

      <!-- Install PWA (solo se renderiza si el browser es instalable o iOS) -->
      <div
        v-if="!sidebarCollapsed"
        class="sidebar__install"
      >
        <InstallAppButton
          label="📱 Instalar app"
          variant="ghost"
        />
      </div>

      <!-- Pie del sidebar: usuario + avatar + logout -->
      <div class="sidebar__footer">
        <!-- Avatar (átomo AppAvatar) -->
        <AppAvatar
          :name="authStore.username ?? 'U'"
          size="sm"
          class="sidebar__avatar"
        />
        <div
          v-if="!sidebarCollapsed"
          class="sidebar__user"
        >
          <span class="sidebar__user-name">{{ authStore.username ?? 'Usuario' }}</span>
        </div>
        <!-- Botón logout (AppButton ghost) -->
        <AppButton
          variant="ghost"
          size="sm"
          icon-only
          class="sidebar__logout"
          title="Cerrar sesión"
          @click="handleLogout"
        >
          🚪
        </AppButton>
      </div>
    </aside>

    <!-- ── Contenido principal ─────────────────────────────────── -->
    <main class="app-main">
      <!-- Encabezado superior -->
      <header class="app-header">
        <h2 class="app-header__title">
          {{ currentRouteTitle }}
        </h2>
        <span class="app-header__date">{{ formattedDate }}</span>
      </header>

      <!-- Vista hija actual -->
      <div class="app-content">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { AppButton, AppAvatar, InstallAppButton } from '@/components'

const authStore = useAuthStore()
const router    = useRouter()
const route     = useRoute()

// Colapso del sidebar
const sidebarCollapsed = ref(false)
function toggleSidebar() { sidebarCollapsed.value = !sidebarCollapsed.value }

// Navegación principal
const navItems = [
  { to: '/app', label: 'Inicio', icon: '🏠' },
]

// Título dinámico según la ruta actual
const routeTitles: Record<string, string> = {
  AppHome: 'Inicio',
}
const currentRouteTitle = computed(
  () => routeTitles[route.name as string] ?? 'FinanzasApp'
)

// Fecha actual formateada
const formattedDate = computed(() =>
  new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
)

// Cierra sesión y redirige al login
function handleLogout() {
  authStore.logout()
  router.push({ name: 'Login' })
}
</script>

<style scoped>
/* ── Grid principal ──────────────────────────────────────────── */
.app-layout {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  min-height: 100vh;
  transition: grid-template-columns var(--transition);
}

.app-layout--collapsed {
  grid-template-columns: var(--sidebar-width-collapsed) 1fr;
}

/* ── Sidebar ─────────────────────────────────────────────────── */
.sidebar {
  background:  var(--color-sidebar-bg);
  color:       var(--color-sidebar-text);
  display:     flex;
  flex-direction: column;
  position:    sticky;
  top:         0;
  height:      100vh;
  overflow:    hidden;
}

.sidebar__header {
  display:        flex;
  align-items:    center;
  justify-content: space-between;
  padding:        var(--spacing-md);
  border-bottom:  1px solid rgba(255,255,255,.08);
  height:         var(--header-height);
}

.sidebar__logo      { font-weight: 700; font-size: var(--font-size-sm); white-space: nowrap; }
.sidebar__logo-icon { font-size: 20px; }

/* AppButton hereda las clases del sidebar para colores del sidebar */
.sidebar__toggle {
  color:   var(--color-sidebar-text) !important;
  opacity: .7;
  font-size: var(--font-size-md);
  background: transparent !important;
}
.sidebar__toggle:hover { opacity: 1; }

/* Navegación */
.sidebar__nav {
  flex: 1;
  padding: var(--spacing-sm) 0;
  overflow-y: auto;
}

.sidebar__link {
  display:        flex;
  align-items:    center;
  gap:            var(--spacing-sm);
  padding:        10px var(--spacing-md);
  color:          var(--color-sidebar-text);
  opacity:        .8;
  transition:     background var(--transition), opacity var(--transition);
  white-space:    nowrap;
}
.sidebar__link:hover       { background: rgba(255,255,255,.06); opacity: 1; }
.sidebar__link--active     { background: rgba(37,99,235,.25); color: #fff; opacity: 1; border-right: 3px solid var(--color-sidebar-active); }

.sidebar__link-icon  { font-size: 18px; flex-shrink: 0; }
.sidebar__link-label { font-size: var(--font-size-sm); font-weight: 500; }

/* Botón de instalar PWA — solo si el browser lo soporta */
.sidebar__install {
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid rgba(255,255,255,.06);
}
.sidebar__install :deep(.install-btn) { width: 100%; justify-content: center; font-size: 0.85rem; padding: 10px 12px; }

/* Footer con usuario */
.sidebar__footer {
  display:     flex;
  align-items: center;
  gap:         var(--spacing-sm);
  padding:     var(--spacing-md);
  border-top:  1px solid rgba(255,255,255,.08);
}

.sidebar__user {
  flex: 1;
  overflow: hidden;
}
.sidebar__user-name  { display: block; font-size: var(--font-size-sm); font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.sidebar__logout {
  color:   var(--color-sidebar-text) !important;
  opacity: .7;
  font-size: 18px;
  flex-shrink: 0;
  background: transparent !important;
}
.sidebar__logout:hover { opacity: 1; }

/* Avatar en sidebar footer */
.sidebar__avatar { flex-shrink: 0; }

/* ── Área de contenido ───────────────────────────────────────── */
.app-main {
  display:        flex;
  flex-direction: column;
  min-height:     100vh;
  overflow:       auto;
}

.app-header {
  display:        flex;
  align-items:    center;
  justify-content: space-between;
  height:         var(--header-height);
  padding:        0 var(--spacing-xl);
  background:     var(--color-surface);
  border-bottom:  1px solid var(--color-border);
  position:       sticky;
  top:            0;
  z-index:        10;
}

.app-header__title {
  font-size:   var(--font-size-lg);
  font-weight: 700;
  color:       var(--color-text);
}

.app-header__date {
  font-size: var(--font-size-sm);
  color:     var(--color-text-muted);
  text-transform: capitalize;
}

.app-content {
  flex:    1;
  padding: var(--spacing-xl);
}
</style>
