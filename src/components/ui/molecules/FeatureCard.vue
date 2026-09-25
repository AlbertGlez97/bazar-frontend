<template>
  <!-- Molécula: tarjeta de beneficio — usada en FeaturesSection ("por qué elegirnos") -->
  <article class="feature-card">
    <span
      class="feature-card__icon"
      aria-hidden="true"
    >{{ icon }}</span>
    <h3 class="feature-card__title">
      {{ title }}
    </h3>
    <p class="feature-card__description">
      {{ description }}
    </p>
  </article>
</template>

<script setup lang="ts">
// Puramente presentacional: recibe todo por props, sin estado ni lógica de negocio.
defineProps<{
  /** Emoji o carácter corto usado como ícono decorativo */
  icon: string
  /** Título corto del beneficio */
  title: string
  /** Explicación breve del beneficio */
  description: string
}>()
</script>

<style scoped>
.feature-card {
  background:    var(--color-surface);
  border:        1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding:       var(--spacing-lg);
  box-shadow:    var(--shadow-sm);
  display:       flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  height: 100%;
}

.feature-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background: var(--color-accent-soft);
  font-size: 1.5rem;
  line-height: 1;
}

.feature-card__title {
  font-size:   var(--font-size-lg);
  font-weight: 800;
  color:       var(--color-text);
}

.feature-card__description {
  font-size: var(--font-size-sm);
  color:     var(--color-text-muted);
  line-height: 1.5;
}
</style>
