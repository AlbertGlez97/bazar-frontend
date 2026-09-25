<template>
  <!-- Layout de autenticación con el mismo fondo oscuro "Developer Blue" del layout -->
  <div class="auth-layout">
    <!-- Fondo decorativo — mismo grid + blobs del layout -->
    <div
      class="auth-layout__grid"
      aria-hidden="true"
    />
    <div
      class="auth-layout__blob auth-layout__blob--1"
      aria-hidden="true"
    />
    <div
      class="auth-layout__blob auth-layout__blob--2"
      aria-hidden="true"
    />

    <!-- Header con logo enlazado a la landing -->
    <header class="auth-layout__header">
      <RouterLink
        to="/"
        class="auth-logo"
      >
        <span
          class="auth-logo__badge"
          aria-hidden="true"
        >{{ appInitial }}</span>
        <span class="auth-logo__name">{{ APP_NAME }}</span>
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

// El badge del logo muestra la inicial del nombre de la app
const appInitial = APP_NAME.charAt(0)
</script>

<style scoped>
/* ── Tokens del mismo sistema del layout ────────────────── */
.auth-layout {
  --al-bg:         #080d17;
  --al-surface:    #0e1623;
  --al-border:     #1c2a3e;
  --al-text:       #f0f4ff;
  --al-muted:      #8899b4;
  --al-blue:       #2563eb;
  --al-blue-light: #3b82f6;
  --al-blue-glow:  rgba(37, 99, 235, .25);
  --al-green:      #10b981;

  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  background: var(--al-bg);
  padding: 24px 16px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* ── Fondo decorativo ──────────────────────────────────────── */
.auth-layout__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(37, 99, 235, .06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37, 99, 235, .06) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
  pointer-events: none;
  z-index: 0;
}

.auth-layout__blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  pointer-events: none;
  z-index: 0;
}
.auth-layout__blob--1 {
  width: 500px; height: 500px;
  background: radial-gradient(circle, rgba(37, 99, 235, .18), transparent 70%);
  top: -150px; right: -100px;
}
.auth-layout__blob--2 {
  width: 350px; height: 350px;
  background: radial-gradient(circle, rgba(16, 185, 129, .12), transparent 70%);
  bottom: -80px; left: -60px;
}

/* ── Header con logo ───────────────────────────────────────── */
.auth-layout__header {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 440px;
}

/* Logo — idéntico al del layout Page */
.auth-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}
.auth-logo:focus-visible {
  outline: 2px solid var(--al-blue-light);
  outline-offset: 4px;
  border-radius: 9px;
}
.auth-logo__badge {
  width: 34px; height: 34px;
  border-radius: 9px;
  background: var(--al-blue);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  box-shadow: 0 0 16px var(--al-blue-glow);
  flex-shrink: 0;
}
.auth-logo__name {
  font-size: 18px;
  font-weight: 700;
  color: var(--al-text);
  letter-spacing: -.3px;
}

/* ── Tarjeta del formulario ────────────────────────────────── */
.auth-layout__card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 440px;
  background: var(--al-surface);
  border: 1px solid var(--al-border);
  border-radius: 20px;
  padding: 36px 32px;
  box-shadow:
    0 30px 60px rgba(0, 0, 0, .5),
    0 0 0 1px rgba(255, 255, 255, .03),
    inset 0 1px 0 rgba(255, 255, 255, .05);

  /* Sobrescribe las variables CSS del sistema claro para que
     los campos de Login/Register hereden el tema oscuro */
  --color-bg:           #080d17;
  --color-surface:      #141e2e;
  --color-border:       #1c2a3e;
  --color-text:         #f0f4ff;
  --color-text-muted:   #8899b4;
  --color-text-light:   #5a6a80;
  --color-primary:      #2563eb;
  --color-primary-dark: #1d4ed8;
  --color-primary-light: rgba(37, 99, 235, .2);
  --color-danger:       #f87171;
  --color-danger-light: rgba(248, 113, 113, .12);
  --color-success:      #10b981;
  --color-success-light: rgba(16, 185, 129, .12);
  --color-warning:      #f59e0b;
  --radius-md:          10px;
  --radius-lg:          16px;
  --transition:         .2s ease;
}

/* ── Responsive ────────────────────────────────────────────── */
@media (max-width: 480px) {
  .auth-layout__card {
    padding: 28px 20px;
    border-radius: 16px;
  }
}
</style>
