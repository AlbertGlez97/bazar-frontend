<template>
  <!-- Organismo: llamada final a la acción -->
  <section
    class="landing-cta"
    aria-labelledby="landing-cta-title"
  >
    <div class="landing-cta__inner container">
      <h2
        id="landing-cta-title"
        class="landing-cta__title"
      >
        ¿Le entramos?
      </h2>
      <p class="landing-cta__text">
        Registra tu negocio y cuéntanos cómo vendes.
      </p>
      <AppButton
        :tag="RouterLink"
        :to="{ name: 'BusinessRegistration' }"
        variant="primary"
        size="lg"
      >
        Registra tu negocio
      </AppButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/atoms/AppButton.vue'
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.landing-cta {
  padding: var(--spacing-2xl) var(--spacing-md);
  background: var(--color-accent-soft);
}

.landing-cta__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  text-align: center;
}

.landing-cta__title {
  font-size: var(--font-size-2xl);
  font-weight: 800;
}

.landing-cta__text { color: var(--color-text-muted); }
</style>
