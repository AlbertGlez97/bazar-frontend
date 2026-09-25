<template>
  <!-- Layout de autenticación: papel crema con el toldo de la marca arriba -->
  <div class="auth-layout">
    <!-- Toldo decorativo -->
    <div
      class="brand-awning auth-layout__awning"
      aria-hidden="true"
    />

    <!-- Header con logo enlazado a la landing -->
    <header class="auth-layout__header">
      <RouterLink
        to="/"
        class="auth-logo"
        :aria-label="APP_NAME"
      >
        <BrandLogo :size="40" />
      </RouterLink>
    </header>

    <!-- Tarjeta del formulario -->
    <main class="auth-layout__card">
      <!-- Vista hija (Login) -->
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { APP_NAME } from '@/config/app'
import BrandLogo from '@/components/ui/atoms/BrandLogo.vue'
</script>

<style scoped>
.auth-layout {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-lg);
  background: var(--color-bg);
  padding: 72px 16px 24px;
  overflow: hidden;
}

/* ── Toldo ─────────────────────────────────────────────────── */
.auth-layout__awning {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 0;
}

/* ── Header con logo ───────────────────────────────────────── */
.auth-layout__header {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 440px;
}

.auth-logo {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  border-radius: var(--radius-md);
}
.auth-logo:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 4px;
}

/* ── Tarjeta del formulario ────────────────────────────────── */
.auth-layout__card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 440px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 36px 32px;
  box-shadow: var(--shadow-lg);
}

/* ── Responsive ────────────────────────────────────────────── */
@media (max-width: 480px) {
  .auth-layout { padding-top: 64px; }
  .auth-layout__card {
    padding: 28px 20px;
    border-radius: var(--radius-lg);
  }
}
</style>
