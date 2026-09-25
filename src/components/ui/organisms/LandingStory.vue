<template>
  <!-- Organismo: por qué "La Marchanta" — el origen del nombre, en la voz de la marca -->
  <section
    class="landing-story"
    aria-labelledby="landing-story-title"
  >
    <div class="landing-story__inner container">
      <h2
        id="landing-story-title"
        class="landing-story__title"
      >
        ¿Por qué nos llamamos así?
      </h2>
      <p class="landing-story__text">
        En el mercado, quien vende le dice <em>marchanta</em> a quien le compra:
        <q>¿qué le damos, marchanta?</q> Nos gusta ese trato: cercano, de
        confianza y sin vueltas. Así quisimos hacer esta app, para que tú te
        dediques a lo tuyo, que es atender.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
// Organismo: contenido estático, sin lógica.
</script>

<style scoped>
.landing-story {
  padding: var(--spacing-2xl) var(--spacing-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.landing-story__inner { max-width: 44rem; text-align: center; }

.landing-story__title {
  font-size: var(--font-size-xl);
  font-weight: 800;
}

.landing-story__text {
  margin-top: var(--spacing-md);
  font-size: 1.0625rem;
  line-height: 1.7;
}

.landing-story__text em { font-style: italic; font-weight: 700; }
.landing-story__text q { font-weight: 600; }
</style>
