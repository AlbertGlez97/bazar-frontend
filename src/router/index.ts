import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

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
    path: '/app',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [{ path: '', name: 'AppHome', component: () => import('@/views/AppHomeView.vue') }],
  },
  { path: '/:pathMatch(.*)*', redirect: sessionDestination },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) return { name: 'Login' }
  if (to.meta.redirectIfAuth && auth.isAuthenticated) return { name: 'AppHome' }
})

export default router
