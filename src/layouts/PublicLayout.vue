<template>
  <!-- Layout público: landing, registro de negocio y selección de contexto.
       Toldo + logo arriba, pie con la firma de la marca abajo. -->
  <div class="public-layout">
    <div
      class="brand-awning"
      aria-hidden="true"
    />

    <header class="public-layout__header">
      <div class="public-layout__header-inner container">
        <RouterLink
          to="/"
          class="public-layout__logo"
          :aria-label="APP_NAME"
        >
          <BrandLogo :size="36" />
        </RouterLink>

        <!-- Con sesión activa el enlace a "Entrar" sobra -->
        <RouterLink
          v-if="!authStore.isAuthenticated"
          :to="{ name: 'Login' }"
          class="public-layout__login"
        >
          Entrar
        </RouterLink>
      </div>
    </header>

    <main class="public-layout__main">
      <RouterView />
    </main>

    <footer class="public-layout__footer">
      <div class="public-layout__footer-inner container">
        <BrandLogo
          :size="28"
          variant="full"
        />
        <p class="public-layout__tagline">
          Para quien vende de tú a tú.
        </p>
        <p class="public-layout__copy">
          &copy; {{ year }} {{ APP_NAME }}
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store'
import BrandLogo from '@/components/ui/atoms/BrandLogo.vue'
import { APP_NAME } from '@/config/app'

const authStore = useAuthStore()
const year = new Date().getFullYear()
</script>

<style scoped>
.public-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.public-layout__header { padding: var(--spacing-md); }
.public-layout__header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.public-layout__logo {
  display: inline-flex;
  border-radius: var(--radius-md);
}

.public-layout__login {
  font-weight: 600;
  color: var(--color-primary-hover);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-full);
  border: 2px solid var(--color-primary);
  transition: background var(--transition), color var(--transition);
}
.public-layout__login:hover {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.public-layout__main { flex: 1; }

.public-layout__footer {
  background: var(--color-surface-alt);
  border-top: 1px solid var(--color-border);
  padding: var(--spacing-xl) var(--spacing-md);
}
.public-layout__footer-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  text-align: center;
}
.public-layout__tagline { color: var(--color-text); font-weight: 500; }
.public-layout__copy { color: var(--color-text-muted); font-size: var(--font-size-sm); }
</style>
