// Configuración del enrutador — incluye guard de autenticación
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

// ── Definición de rutas ──────────────────────────────────────────────────────
const routes: RouteRecordRaw[] = [

  // ── Landing Page pública ─────────────────────────────────────────────────
  {
    path: '/',
    name: 'Landing',
    component: () => import('@/views/LandingView.vue'),
    // Si ya está autenticado, redirige al dashboard
    meta: { redirectIfAuth: true },
  },

  // ── Rutas públicas (layout de auth) ─────────────────────────────────────
  {
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    meta: { redirectIfAuth: true },
    children: [
      {
        path: '',
        name: 'Login',
        component: () => import('@/views/auth/LoginView.vue'),
      },
    ],
  },
  {
    path: '/register',
    component: () => import('@/layouts/AuthLayout.vue'),
    meta: { redirectIfAuth: true },
    children: [
      {
        path: '',
        name: 'Register',
        component: () => import('@/views/auth/RegisterView.vue'),
      },
    ],
  },
  {
    path: '/recuperar',
    component: () => import('@/layouts/AuthLayout.vue'),
    meta: { redirectIfAuth: true },
    children: [
      {
        path: '',
        name: 'RecoverAccount',
        component: () => import('@/views/auth/RecoverAccountView.vue'),
      },
    ],
  },

  // ── Rutas privadas (layout principal con sidebar) ────────────────────────
  {
    path: '/dashboard',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/DashboardView.vue'),
      },
    ],
  },
  {
    path: '/budget',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'BudgetList',
        component: () => import('@/views/budget/BudgetListView.vue'),
      },
      // Detalle de un presupuesto concreto por ID
      {
        path: ':id',
        name: 'BudgetDetail',
        component: () => import('@/views/budget/BudgetDetailView.vue'),
      },
      // Gestión de compras a meses sin intereses
      {
        path: 'msi',
        name: 'Msi',
        component: () => import('@/views/budget/MsiView.vue'),
      },
    ],
  },
  {
    path: '/debts',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Debts',
        component: () => import('@/views/debts/DebtsView.vue'),
      },
      // Detalle de una deuda concreta por ID
      {
        path: ':id',
        name: 'DebtDetail',
        component: () => import('@/views/debts/DebtDetailView.vue'),
      },
    ],
  },
  {
    path: '/savings',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Savings',
        component: () => import('@/views/savings/SavingsView.vue'),
      },
    ],
  },
  {
    path: '/guia',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'GuideHome',
        component: () => import('@/views/guide/GuideView.vue'),
      },
      {
        path: ':slug',
        name: 'GuideArticle',
        component: () => import('@/views/guide/GuideView.vue'),
      },
    ],
  },

  // ── Ruta comodín ─────────────────────────────────────────────────────────
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

// ── Instancia del router ─────────────────────────────────────────────────────
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

// ── Guard global ─────────────────────────────────────────────────────────────
router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()

  // Ruta privada sin sesión → login
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return next({ name: 'Login' })
  }

  // Ruta pública con sesión activa → dashboard
  if (to.meta.redirectIfAuth && auth.isAuthenticated) {
    return next({ name: 'Dashboard' })
  }

  next()
})

export default router
