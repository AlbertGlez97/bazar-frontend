<template>
  <!--
    Componente raíz — muestra un splash de carga mientras se valida la sesión,
    luego cede el control al RouterView. El layout lo gestionan AppLayout y
    AuthLayout según la ruta activa.
  -->
  <div v-if="checking" class="app-splash">
    <div class="splash-logo">FinanzasApp</div>
    <div class="spinner"></div>
  </div>
  <RouterView v-else />

  <!--
    Modal de restauración E2EE — aparece cuando hay sesión válida pero la DEK
    no está en RAM (caso típico: recarga de página).
    El usuario ingresa su contraseña para unwrappear la DEK del localStorage.
  -->
  <KeyRestoreModal v-if="needsKeyRestore" />

  <!-- Toast global — disponible en toda la app vía useToastStore() -->
  <AppToast />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useCryptoStore } from '@/stores/crypto.store'
import { AppToast } from '@/components'
import KeyRestoreModal from '@/components/ui/organisms/KeyRestoreModal.vue'

const auth        = useAuthStore()
const cryptoStore = useCryptoStore()
const router      = useRouter()
const checking    = ref(true)

/**
 * Mostrar el modal de restauración cuando:
 *   1. El usuario tiene sesión JWT válida (isAuthenticated)
 *   2. La DEK NO está en RAM (isReady = false) — caso: recarga de página
 *   3. Hay datos E2EE en localStorage (canRestore = true)
 */
const needsKeyRestore = computed(() =>
  auth.isAuthenticated &&
  !cryptoStore.isReady &&
  !checking.value &&
  !!auth.user &&
  cryptoStore.canRestore(auth.user.id)
)

onMounted(async () => {
  // ── 1. Verificar sesión con el backend si hay token guardado ──────────────
  // Escenarios posibles:
  //   a) Token válido   → fetchMe restaura user.value   → isAuthenticated = true
  //   b) Token expirado → fetchMe llama logout()        → token + user = null
  //   c) Sin token      → saltamos fetchMe, continuamos directo
  if (auth.token) {
    await auth.fetchMe()
  }

  // ── 2. Una vez resuelto el estado, corregir la ruta si es necesario ───────
  // El guard beforeEach corrió ANTES de que fetchMe terminara, así que puede
  // haber dejado al usuario en la ruta equivocada. Lo corregimos aquí.
  const route = router.currentRoute.value

  if (auth.isAuthenticated && route.meta.redirectIfAuth) {
    // Sesión válida pero estaba en página pública (/, /login, /register) → dashboard
    await router.replace({ name: 'Dashboard' })
  } else if (!auth.isAuthenticated && route.meta.requiresAuth) {
    // Sin sesión pero estaba en ruta privada → login
    await router.replace({ name: 'Login' })
  }

  // ── 3. Mostrar la aplicación ──────────────────────────────────────────────
  checking.value = false
})
</script>

<style>
/* Pantalla de carga inicial — visible solo durante la validación de sesión */
.app-splash {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  background: var(--color-bg, #080d17);
}
.splash-logo {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--color-primary, #2563eb);
  letter-spacing: -0.02em;
}
</style>
