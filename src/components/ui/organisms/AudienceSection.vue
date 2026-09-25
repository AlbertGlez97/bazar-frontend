<template>
  <!-- Organismo: para quién es — changarros, bazares y tianguis -->
  <section
    class="audience-section"
    aria-labelledby="audience-title"
  >
    <div class="audience-section__inner container">
      <h2
        id="audience-title"
        class="audience-section__title"
      >
        Hecha para quien vende de tú a tú
      </h2>

      <ul class="audience-section__list">
        <li
          v-for="item in audiences"
          :key="item.name"
          class="audience-section__item"
        >
          <h3 class="audience-section__name">
            {{ item.name }}
          </h3>
          <p class="audience-section__text">
            {{ item.text }}
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
// Organismo: contenido estático. Cada texto describe algo que la API hace hoy
// (socios y colaboradores, comisiones, deudas); no promete funciones nuevas.
const audiences = [
  {
    name: 'Changarros',
    text: 'Tú y quizá un ayudante. Deja la libreta y ten productos, ventas y fiados en un solo lugar.',
  },
  {
    name: 'Bazares',
    text: 'Varias personas vendiendo en el mismo local. Sabrás quién vendió qué y cuánto le toca a cada quien.',
  },
  {
    name: 'Tianguis',
    text: 'Un puesto con producto que se mueve rápido. Anota la venta y sigue atendiendo.',
  },
]
</script>

<style scoped>
.audience-section {
  padding: var(--spacing-2xl) var(--spacing-md);
  background: var(--color-surface-alt);
}

.audience-section__inner { text-align: center; }

.audience-section__title {
  font-size: var(--font-size-xl);
  font-weight: 800;
}

.audience-section__list {
  margin-top: var(--spacing-xl);
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-lg);
  text-align: left;
}

.audience-section__item {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-top: 4px solid var(--color-accent);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
}

.audience-section__name {
  font-size: var(--font-size-lg);
  font-weight: 800;
  color: var(--color-primary-hover);
}

.audience-section__text {
  margin-top: var(--spacing-sm);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

@media (min-width: 768px) {
  .audience-section__list { grid-template-columns: repeat(3, 1fr); }
}
</style>
