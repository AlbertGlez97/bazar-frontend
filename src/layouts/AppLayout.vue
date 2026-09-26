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
        <!-- Logo: vuelve al inicio de la app. Colapsado solo muestra el isotipo,
             por eso el nombre accesible es siempre APP_NAME -->
        <RouterLink
          to="/app"
          class="sidebar__brand"
          :aria-label="APP_NAME"
        >
          <BrandLogo
            :variant="sidebarCollapsed ? 'mark' : 'full'"
            tone="inverse"
            :size="32"
          />
        </RouterLink>
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

      <!-- Selector de modo (Venta / Gestión). Colapsado pasa a íconos apilados
           de 44x44: sigue siendo usable y conserva sus nombres accesibles. -->
      <div class="sidebar__mode">
        <UiModeSwitch
          :model-value="uiMode.currentMode"
          :compact="sidebarCollapsed"
          tone="inverse"
          @update:model-value="uiMode.setMode"
        />
      </div>

      <!-- Navegación -->
      <nav class="sidebar__nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="sidebar__link"
          :active-class="item.exact ? undefined : 'sidebar__link--active'"
          exact-active-class="sidebar__link--active"
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
        <!-- Engrane: abre la pantalla de ajustes (cambiar contraseña y, para
             socios, equipo y dispositivos). Es un enlace real con nombre
             accesible; el ícono es decorativo. Colapsado (el estado normal en un
             celular) el pie se apila y el engrane sigue a la mano. -->
        <RouterLink
          to="/app/ajustes"
          class="sidebar__settings"
          :class="{ 'sidebar__settings--active': isSettingsRoute }"
          aria-label="Ajustes"
          title="Ajustes"
        >
          <span aria-hidden="true">⚙️</span>
        </RouterLink>
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
        <div class="app-header__heading">
          <h2 class="app-header__title">
            {{ currentRouteTitle }}
          </h2>
          <!-- Indicador del modo activo: texto + color, nunca solo color -->
          <AppBadge
            :color="uiMode.isVenta ? 'amber' : 'gray'"
            :filled="uiMode.isVenta"
            class="app-header__mode"
          >
            {{ uiMode.isVenta ? 'Modo Venta' : 'Modo Gestión' }}
          </AppBadge>
          <!-- Cola de ventas offline: calmada, y sin nada que mostrar cuando no hay pendientes -->
          <SyncStatusIndicator
            :pending-count="salesQueue.pendingCount"
            :needs-review-count="salesQueue.needsReviewCount"
            :is-syncing="salesQueue.isSyncing"
            :records="salesQueue.needsReviewRecords"
            @dismiss="dismissReview"
          />
        </div>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import { useSessionStore } from '@/stores/session.store'
import { useSalesQueueStore } from '@/stores/sales-queue.store'
import { AppBadge, AppButton, AppAvatar, InstallAppButton, UiModeSwitch, SyncStatusIndicator } from '@/components'
import BrandLogo from '@/components/ui/atoms/BrandLogo.vue'
import { APP_NAME } from '@/config/app'
import { getNavItems } from './nav-items'

const authStore = useAuthStore()
// El modo se inicializa al crearse el store (antes de que la vista hija
// renderice): sugerencia del dispositivo la primera vez, preferencia guardada después.
const uiMode    = useUiModeStore()
const session   = useSessionStore()
const salesQueue = useSalesQueueStore()
const router    = useRouter()
const route     = useRoute()

// Colapso del sidebar. En un celular (menos de 768 px) arranca colapsado: la
// barra de 240 px se comería el contenido; se puede expandir cuando se necesite
// (y ahí se superpone en vez de empujar la pantalla, ver el CSS).
const PHONE_QUERY = '(max-width: 767px)'
const startsOnPhone = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia(PHONE_QUERY).matches
const sidebarCollapsed = ref(startsOnPhone)
function toggleSidebar() { sidebarCollapsed.value = !sidebarCollapsed.value }

// Navegación principal, derivada del modo (ver ./nav-items.ts: ahí se agregan
// ítems nuevos). "Vender" siempre está; su lugar cambia con el modo.
// `exact`: '/app' es prefijo de todas las rutas operativas y, por cómo
// vue-router resuelve el hijo con path '', quedaría resaltado en cualquiera
// de ellas; "Inicio" solo se marca activo en la ruta exacta.
const navItems = computed(() =>
  getNavItems(uiMode.currentMode, { isSocio: session.member?.role === 'socio' }),
)

// La cola de ventas offline se sincroniza mientras el shell autenticado está
// montado: al abrir la app, al volver la conexión y cada tanto mientras haya
// pendientes. Si algo falla al arrancar, el shell sigue funcionando.
onMounted(async () => {
  try {
    await salesQueue.start()
  } catch {
    // Sin cola local (por ejemplo IndexedDB no disponible) las ventas siguen en línea.
  }
})
onUnmounted(() => salesQueue.stop())

async function dismissReview(id: string) {
  try {
    await salesQueue.dismissReview(id)
  } catch {
    // Si no se pudo descartar, el registro sigue en la lista y se puede intentar de nuevo.
  }
}

// Título dinámico según la ruta actual
const routeTitles: Record<string, string> = {
  AppHome: 'Inicio',
  ProductCatalog: 'Productos',
  Sale: 'Vender',
  Reports: 'Reportes',
  Settings: 'Ajustes',
  ChangePassword: 'Cambiar mi contraseña',
  Team: 'Mi equipo',
}
const currentRouteTitle = computed(
  () => routeTitles[route.name as string] ?? APP_NAME
)

// El engrane queda marcado en la pantalla de ajustes y en cada una de sus
// subpantallas. Se decide por la ruta y no por el estado activo del enlace:
// `/app/ajustes/contrasena` es hermana de `/app/ajustes` en el router, no hija.
const isSettingsRoute = computed(
  () => typeof route.path === 'string' && route.path.startsWith('/app/ajustes'),
)

// Fecha actual formateada
// Primera letra en mayúscula ("jueves" -> "Jueves"); el resto queda como lo
// escribe es-MX ("24 de septiembre de 2026"), sin capitalizar el "de".
const formattedDate = computed(() => {
  const text = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  return text.charAt(0).toUpperCase() + text.slice(1)
})

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

/* Ancho que ocupa la barra: lo leen las vistas que fijan barras propias al borde
   de la pantalla (la barra de cobro de la venta en celular). */
.app-layout { --app-sidebar-offset: var(--sidebar-width); }
.app-layout--collapsed { --app-sidebar-offset: var(--sidebar-width-collapsed); }

/* Colapsado no cabe el isotipo y el botón en una fila: se apilan */
.app-layout--collapsed .sidebar__header {
  flex-direction: column;
  justify-content: center;
  gap: var(--spacing-xs);
  height: auto;
  min-height: var(--header-height);
  padding: var(--spacing-sm);
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
  border-bottom:  1px solid color-mix(in srgb, var(--color-sidebar-text) 14%, transparent);
  height:         var(--header-height);
}

.sidebar__brand {
  color:         inherit;
  text-decoration: none;
  border-radius: var(--radius-sm);
}
.sidebar__brand:focus-visible {
  outline:        2px solid var(--color-sidebar-active);
  outline-offset: 2px;
}

/* AppButton hereda las clases del sidebar para colores del sidebar */
.sidebar__toggle {
  color:   var(--color-sidebar-text) !important;
  opacity: .7;
  font-size: var(--font-size-md);
  background: transparent !important;
}
.sidebar__toggle:hover { opacity: 1; }

/* Selector de modo, bajo el logo */
.sidebar__mode {
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid color-mix(in srgb, var(--color-sidebar-text) 14%, transparent);
}
.app-layout--collapsed .sidebar__mode { padding: var(--spacing-sm) 0; }

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
.sidebar__link:hover       { background: color-mix(in srgb, var(--color-sidebar-text) 10%, transparent); opacity: 1; }
.sidebar__link--active     { background: color-mix(in srgb, var(--color-sidebar-active) 18%, transparent); color: var(--color-surface); opacity: 1; border-right: 3px solid var(--color-sidebar-active); }

.sidebar__link-icon  { font-size: 18px; flex-shrink: 0; }
.sidebar__link-label { font-size: var(--font-size-sm); font-weight: 500; }

/* Botón de instalar PWA — solo si el browser lo soporta */
.sidebar__install {
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid color-mix(in srgb, var(--color-sidebar-text) 10%, transparent);
}
.sidebar__install :deep(.install-btn) { width: 100%; justify-content: center; font-size: 0.85rem; padding: 10px 12px; }

/* Footer con usuario */
.sidebar__footer {
  display:     flex;
  align-items: center;
  gap:         var(--spacing-sm);
  padding:     var(--spacing-md);
  border-top:  1px solid color-mix(in srgb, var(--color-sidebar-text) 14%, transparent);
}

.sidebar__user {
  flex: 1;
  overflow: hidden;
}
.sidebar__user-name  { display: block; font-size: var(--font-size-sm); font-weight: 600; color: var(--color-surface); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.sidebar__logout {
  color:   var(--color-sidebar-text) !important;
  opacity: .7;
  font-size: 18px;
  flex-shrink: 0;
  background: transparent !important;
}
.sidebar__logout:hover { opacity: 1; }

/* Engrane de ajustes: objetivo táctil de 44x44 (guía de marca) */
.sidebar__settings {
  display:         flex;
  align-items:     center;
  justify-content: center;
  min-width:       44px;
  min-height:      44px;
  flex-shrink:     0;
  font-size:       18px;
  color:           var(--color-sidebar-text);
  text-decoration: none;
  opacity:         .7;
  border-radius:   var(--radius-sm);
  transition:      background var(--transition), opacity var(--transition);
}
.sidebar__settings:hover,
.sidebar__settings--active { opacity: 1; }
.sidebar__settings--active { background: color-mix(in srgb, var(--color-sidebar-active) 18%, transparent); }
.sidebar__settings:focus-visible {
  outline:        2px solid var(--color-sidebar-active);
  outline-offset: 2px;
}

/* Colapsado no caben avatar, engrane y salida en una fila de 64 px: se apilan */
.app-layout--collapsed .sidebar__footer {
  flex-direction: column;
  padding: var(--spacing-sm) 0;
}

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

.app-header__heading {
  display:     flex;
  align-items: center;
  flex-wrap:   wrap;
  gap:         var(--spacing-sm);
}

/* El indicador se lee de un vistazo: 14 px en vez de los 12 px del badge */
.app-header .app-header__mode { font-size: var(--font-size-sm); padding: 0.25rem 0.75rem; }

.app-header__title {
  font-size:   var(--font-size-lg);
  font-weight: 800;
  color:       var(--color-text);
}

.app-header__date {
  font-size: var(--font-size-sm);
  color:     var(--color-text-muted);
}

.app-content {
  flex:    1;
  padding: var(--spacing-xl);
}

/* ── Celular (< 768 px) ──────────────────────────────────────────
   La barra lateral nunca empuja el contenido: en reposo es la tira de 64 px y,
   si se expande, se superpone. La cabecera puede crecer y la fecha se omite. */
@media (max-width: 767px) {
  .app-layout,
  .app-layout--collapsed {
    grid-template-columns: var(--sidebar-width-collapsed) minmax(0, 1fr);
    --app-sidebar-offset: var(--sidebar-width-collapsed);
  }
  .app-layout:not(.app-layout--collapsed) .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: var(--sidebar-width);
    z-index: 60;
    box-shadow: var(--shadow-lg);
  }
  .app-main { grid-column: 2; min-width: 0; }
  .app-header {
    height: auto;
    min-height: var(--header-height);
    padding: var(--spacing-sm) var(--spacing-md);
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }
  .app-header__date { display: none; }
  .app-content { padding: var(--spacing-md) var(--spacing-sm); }
}
</style>
