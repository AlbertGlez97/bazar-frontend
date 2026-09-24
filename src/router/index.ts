import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
  type RouterHistory,
} from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'

const sessionDestination = () => ({ path: useAuthStore().isAuthenticated ? '/app' : '/login' })

const routes: RouteRecordRaw[] = [
  // Landing pública: cualquier visitante puede verla. Si ya hay sesión activa,
  // `redirectIfAuth` lo manda directo al panel (ver guard más abajo) en vez de
  // mostrarle la página de marketing.
  {
    path: '/',
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
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    meta: { redirectIfAuth: true },
    children: [{ path: '', name: 'Login', component: () => import('@/views/auth/LoginView.vue') }],
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

  router.beforeEach((to) => {
    const auth = useAuthStore()
    if (to.meta.requiresAuth && !auth.isAuthenticated) return { name: 'Login' }
    if (to.meta.redirectIfAuth && auth.isAuthenticated) return { name: 'AppHome' }

    const session = useSessionStore()
    if (to.meta.requiresContext && !session.isContextReady) return { name: 'SelectContext' }
    if (to.meta.redirectIfContextReady && session.isContextReady) return { name: 'AppHome' }
  })

  return router
}

const router = createAppRouter()

export default router
