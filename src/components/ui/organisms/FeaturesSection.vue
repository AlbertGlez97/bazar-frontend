<template>
  <!-- Organismo: sección de beneficios — agrupa las FeatureCard -->
  <section
    class="features-section"
    aria-label="Lo que hace por tu negocio"
  >
    <div class="features-section__inner container">
      <h2 class="features-section__title">
        Lo que hace por tu negocio
      </h2>
      <p class="features-section__subtitle">
        Nada de funciones de adorno: esto es lo que ya puedes llevar aquí.
      </p>

      <div class="features-section__grid">
        <FeatureCard
          v-for="feature in features"
          :key="feature.title"
          :icon="feature.icon"
          :title="feature.title"
          :description="feature.description"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// Organismo: contenido de marketing estático. Solo se afirma lo que existe en
// la API hoy (catálogo, ventas, comisiones, deudas, incidencias; ver
// doc/api-contract-for-frontend.md). No se prometen funciones que no existan:
// nada de "sin internet", "reportes" ni notificaciones.
import FeatureCard from '@/components/ui/molecules/FeatureCard.vue'

const features = [
  {
    icon: '📦',
    title: 'Tu catálogo, ordenado',
    description:
      'Guarda cada producto con su precio, existencia, categoría, proveedor y foto. Lo buscas en cuanto lo necesitas.',
  },
  {
    icon: '🧾',
    title: 'Ventas en un momento',
    description:
      'Anota varios productos en una misma venta. El total y el cambio los calcula el sistema, no tú.',
  },
  {
    icon: '👥',
    title: 'Quién vendió qué',
    description:
      'Socios y colaboradores comparten la tablet, y cada venta queda a nombre de quien atendió.',
  },
  {
    icon: '🤝',
    title: 'Comisiones sin calculadora',
    description:
      'Cada semana sabes cuánto le toca a cada colaborador, según lo que vendió.',
  },
  {
    icon: '📒',
    title: 'Fiado y apartados',
    description:
      'Apunta quién debe qué y cuánto va abonando, sin depender de una libreta.',
  },
  {
    icon: '🚩',
    title: 'Sin sorpresas con el inventario',
    description:
      'Si dos ventas se pelean la última pieza, queda una incidencia para que un socio la revise.',
  },
]
</script>

<style scoped>
.features-section { padding: var(--spacing-2xl) var(--spacing-md); }

.features-section__inner { text-align: center; }

.features-section__title {
  font-size:   var(--font-size-xl);
  font-weight: 800;
  color:       var(--color-text);
}

.features-section__subtitle {
  margin-top: var(--spacing-sm);
  color:      var(--color-text-muted);
}

.features-section__grid {
  margin-top: var(--spacing-xl);
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-lg);
  text-align: left;
}

@media (min-width: 640px) {
  .features-section__grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .features-section__grid { grid-template-columns: repeat(3, 1fr); }
}
</style>
