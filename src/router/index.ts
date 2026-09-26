import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
  type RouterHistory,
} from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'

const sessionDestination = () => ({ path: useAuthStore().isAuthenticated ? '/app' : '/login' })

const routes: RouteRecordRaw[] = [
  // Landing pública: cualquier visitante puede verla. Si ya hay sesión activa,
  // `redirectIfAuth` lo manda directo al panel (ver guard más abajo) en vez de
  // mostrarle la página de marketing.
  // Layout público (toldo, logo y pie de marca) compartido por la landing, el
  // registro de negocio y la selección de contexto. Los paths absolutos de los
  // hijos conservan las URLs de siempre.
  {
    path: '/',
    component: () => import('@/layouts/PublicLayout.vue'),
    children: [
      {
        path: '',
        name: 'Landing',
        component: () => import('@/views/LandingView.vue'),
        meta: { redirectIfAuth: true },
      },
      {
        // Formulario real de registro de negocio: crea una solicitud pendiente
        // de aprobación manual, sin autenticar ni abrir sesión.
        path: '/registro-negocio',
        name: 'BusinessRegistration',
        component: () => import('@/views/business/RegisterBusinessView.vue'),
      },
      {
        // Pantalla intermedia obligatoria tras el login: identificar el
        // dispositivo (una sola vez por tablet) y elegir quién atiende (en cada
        // sesión). Requiere sesión válida, pero NO deviceId/memberId todavía —
        // si ya los tiene, `redirectIfContextReady` la salta directo a /app.
        path: '/seleccionar-contexto',
        name: 'SelectContext',
        component: () => import('@/views/SelectContextView.vue'),
        meta: { requiresAuth: true, redirectIfContextReady: true },
      },
    ],
  },
  {
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    meta: { redirectIfAuth: true },
    children: [{ path: '', name: 'Login', component: () => import('@/views/auth/LoginView.vue') }],
  },
  {
    path: '/app',
    component: () => import('@/layouts/AppLayout.vue'),
    // requiresContext: además del JWT, exige deviceId y memberId ya
    // elegidos (ver session.store) — toda ruta operativa futura debe
    // agregar esta misma meta.
    meta: { requiresAuth: true, requiresContext: true },
    children: [
      { path: '', name: 'AppHome', component: () => import('@/views/AppHomeView.vue') },
      {
        // Catálogo de productos: lectura para cualquier Member; acciones de
        // gestión (crear/editar/(des)activar) se ocultan en la vista misma
        // si quien mira no es socio (el backend las rechazaría con 403 de
        // todas formas).
        path: 'productos',
        name: 'ProductCatalog',
        component: () => import('@/views/products/ProductCatalogView.vue'),
      },
      {
        // Pantalla de venta (catálogo + carrito + cobro, con cola offline).
        // Alcanzable en CUALQUIER modo de interfaz: quien vende no debe toparse
        // con redirecciones ni callejones sin salida por estar en Modo Gestión.
        path: 'venta',
        name: 'Sale',
        component: () => import('@/views/sales/SaleView.vue'),
      },
      {
        // Reportes de ventas con descarga en PDF y Excel. Solo socios y solo en
        // Modo Gestión: lo hace cumplir el guard de abajo (no basta con ocultar el
        // ítem del menú) y la vista lo vuelve a comprobar si el modo o el rol cambian.
        path: 'reportes',
        name: 'Reports',
        component: () => import('@/views/reports/ReportsView.vue'),
        meta: { requiresSocio: true, requiresGestion: true },
      },
      {
        // Ajustes (engrane del pie de la barra lateral). Para cualquier persona
        // con el contexto listo, en cualquier modo; las entradas de socios
        // (equipo, dispositivos) declaran `requiresSocio` en su propia ruta.
        path: 'ajustes',
        name: 'Settings',
        component: () => import('@/views/settings/SettingsView.vue'),
      },
      {
        // Cambiar mi contraseña: cualquier persona autenticada (socio o colaborador).
        path: 'ajustes/contrasena',
        name: 'ChangePassword',
        component: () => import('@/views/settings/ChangePasswordView.vue'),
      },
      {
        // Mi equipo: solo socios, en cualquier modo. Lo hace cumplir el guard de
        // abajo (no basta con ocultar la entrada) y la vista lo vuelve a comprobar
        // si el rol cambia con ella abierta; el backend igual responde 403.
        path: 'ajustes/equipo',
        name: 'Team',
        component: () => import('@/views/settings/TeamView.vue'),
        meta: { requiresSocio: true },
      },
      {
        // Dispositivos: solo socios, igual que "Mi equipo" (guard + vista + backend).
        path: 'ajustes/dispositivos',
        name: 'DevicesAdmin',
        component: () => import('@/views/settings/DevicesView.vue'),
        meta: { requiresSocio: true },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: sessionDestination },
]

// Factory: every call builds an independent router (own history, own guards).
// The app uses the singleton exported below. Tests must build one per test:
// a shared instance keeps its current route between tests, and vue-router
// skips the guards on a duplicated navigation (pushing the location the
// router is already at), which silently hid an expired session.
export function createAppRouter(history: RouterHistory = createWebHistory()) {
  const router = createRouter({
    history,
    routes,
    scrollBehavior: () => ({ top: 0 }),
  })

  router.beforeEach(async (to) => {
    const auth = useAuthStore()
    if (to.meta.requiresAuth && !auth.isAuthenticated) return { name: 'Login' }
    if (to.meta.redirectIfAuth && auth.isAuthenticated) return { name: 'AppHome' }

    // Seguridad: el rol que leen los guards y los menús es el de la persona de
    // la sesión, y para una cuenta ligada a un miembro esa persona la dicta el
    // servidor (GET /auth/me), no lo que haya en sessionStorage. Se resuelve
    // ANTES de cualquier decisión por contexto o rol; una sola vez por carga.
    if (to.meta.requiresAuth) {
      await auth.ensureBinding()
      // Un 401 al consultar cierra la sesión: se vuelve a comprobar.
      if (!auth.isAuthenticated) return { name: 'Login' }
    }

    const session = useSessionStore()
    // Cuenta ligada a un miembro que no puede entrar: la pantalla de selección
    // le explica por qué; ninguna ruta operativa se le abre.
    if (to.meta.requiresContext && auth.bindingStatus === 'inactive') return { name: 'SelectContext' }
    if (to.meta.requiresContext && !session.isContextReady) return { name: 'SelectContext' }
    if (to.meta.redirectIfContextReady && session.isContextReady) return { name: 'AppHome' }

    // Rutas de gestión: quien no cumple vuelve al inicio, sin callejones ni errores.
    if (to.meta.requiresSocio && session.member?.role !== 'socio') return { name: 'AppHome' }
    if (to.meta.requiresGestion && useUiModeStore().currentMode !== 'gestion') return { name: 'AppHome' }
  })

  return router
}

const router = createAppRouter()

export default router
