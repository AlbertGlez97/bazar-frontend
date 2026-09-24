<template>
  <!-- Organismo: encabezado principal de la landing — propuesta de valor + CTAs -->
  <section
    class="landing-hero"
    aria-label="Presentación"
  >
    <div class="landing-hero__inner container">
      <h1 class="landing-hero__title">
        El sistema de punto de venta hecho para tu bazar
      </h1>
      <p class="landing-hero__subtitle">
        Vende rápido, controla lo que se lleva fiado y sabe exactamente cuánto
        vendió cada colaborador — todo desde tu celular, incluso sin internet.
        Pensado para negocios pequeños que venden en bazares, tianguis y
        puestos, con o sin socios y ayudantes.
      </p>

      <div class="landing-hero__actions">
        <AppButton
          :tag="RouterLink"
          :to="{ name: 'Login' }"
          variant="secondary"
          size="lg"
        >
          Iniciar sesión
        </AppButton>
        <AppButton
          :tag="RouterLink"
          :to="{ name: 'BusinessRegistration' }"
          variant="primary"
          size="lg"
        >
          Registra tu negocio
        </AppButton>
      </div>
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
  background: linear-gradient(180deg, var(--color-primary-light) 0%, var(--color-bg) 100%);
  padding: var(--spacing-2xl) var(--spacing-md);
}

.landing-hero__inner {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
}

.landing-hero__title {
  font-size:     var(--font-size-2xl);
  font-weight:   800;
  color:         var(--color-text);
  max-width:     40rem;
  letter-spacing: -.5px;
}

.landing-hero__subtitle {
  font-size:  var(--font-size-md);
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

@media (min-width: 768px) {
  .landing-hero__title { font-size: 2.5rem; }
}
</style>
