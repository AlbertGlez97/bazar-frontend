<template>
  <!-- Organismo: encabezado principal de la landing — propuesta de valor + CTAs -->
  <section
    class="landing-hero"
    aria-label="Presentación"
  >
    <div class="landing-hero__inner container">
      <p class="landing-hero__eyebrow">
        Para changarros, bazares y tianguis
      </p>
      <h1 class="landing-hero__title">
        Tú atiendes a tu clientela.
        <span class="landing-hero__accent">Nosotros llevamos las cuentas.</span>
      </h1>
      <p class="landing-hero__subtitle">
        Catálogo, ventas, comisiones y deudas en un solo lugar, sin libretas ni
        cuentas a mano. Se abre desde el navegador de tu celular o tu tablet.
      </p>

      <div class="landing-hero__actions">
        <AppButton
          :tag="RouterLink"
          :to="{ name: 'BusinessRegistration' }"
          variant="primary"
          size="lg"
        >
          Registra tu negocio
        </AppButton>
        <AppButton
          :tag="RouterLink"
          :to="{ name: 'Login' }"
          variant="secondary"
          size="lg"
        >
          Ya tengo cuenta
        </AppButton>
      </div>

      <p class="landing-hero__note">
        Revisamos cada solicitud a mano. Si todo va bien, te mandamos tu
        usuario y contraseña por correo.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
// Organismo: solo composición de contenido estático + navegación por rutas
// con nombre (evita hardcodear paths si el router cambia). AppButton acepta
// un componente como `tag` (ver AppButton.vue), así que le pasamos RouterLink
// para que el botón navegue sin anidar <a> dentro de <button>.
import AppButton from '@/components/ui/atoms/AppButton.vue'
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.landing-hero {
  background: linear-gradient(180deg, var(--color-accent-soft) 0%, var(--color-bg) 100%);
  padding: var(--spacing-2xl) var(--spacing-md);
}

.landing-hero__inner {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
}

.landing-hero__eyebrow {
  display: inline-block;
  padding: 4px 14px;
  border: 1.5px solid var(--color-rosa);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.landing-hero__title {
  font-size:     2rem;
  font-weight:   800;
  color:         var(--color-text);
  max-width:     44rem;
  letter-spacing: -.02em;
  text-wrap: balance;
}

/* El remate de la frase lleva el subrayado ondulado de la marca (rosa) */
.landing-hero__accent {
  display: inline-block;
  color: var(--color-primary-hover);
  text-decoration: underline wavy var(--color-rosa);
  text-decoration-thickness: 2px;
  text-underline-offset: 8px;
}

.landing-hero__subtitle {
  font-size:  1.0625rem;
  color:      var(--color-text-muted);
  max-width:  38rem;
  line-height: 1.6;
}

.landing-hero__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-md);
}

.landing-hero__note {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  max-width: 30rem;
}

@media (min-width: 768px) {
  .landing-hero { padding: 4.5rem var(--spacing-md); }
  .landing-hero__title { font-size: 3rem; }
}
</style>
