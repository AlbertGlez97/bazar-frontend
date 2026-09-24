<template>
  <!-- Organismo: sección "por qué elegirnos" — agrupa las FeatureCard -->
  <section
    class="features-section"
    aria-label="Por qué elegirnos"
  >
    <div class="features-section__inner container">
      <h2 class="features-section__title">
        Hecho para cómo realmente vendes
      </h2>
      <p class="features-section__subtitle">
        Nada de funciones de escaparate: esto es lo que ya usan negocios como
        el tuyo.
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
// Organismo: contenido de marketing estático basado en funcionalidad real
// del backend (venta rápida, offline-first, auditoría, fiado, comisiones,
// reportes). No se inventan features que no existan todavía.
import FeatureCard from '@/components/ui/molecules/FeatureCard.vue'

const features = [
  {
    icon: '⚡',
    title: 'Venta rápida, multiartículo',
    description:
      'Registra varios productos en una sola venta en segundos, ideal para el ritmo de un puesto de bazar.',
  },
  {
    icon: '📶',
    title: 'Funciona sin internet',
    description:
      'Offline-first: sigue vendiendo aunque se caiga la señal y todo se sincroniza solo cuando vuelve la conexión.',
  },
  {
    icon: '🕵️',
    title: 'Control de quién vendió qué',
    description:
      'Cada venta queda registrada con el colaborador que la hizo, con auditoría completa para evitar sorpresas.',
  },
  {
    icon: '📒',
    title: 'Fiado y apartados con seguimiento',
    description:
      'Lleva el control de las ventas a crédito y sus abonos, sin depender de una libreta.',
  },
  {
    icon: '🤝',
    title: 'Comisiones automáticas',
    description:
      'Calcula automáticamente lo que le corresponde a cada socio o colaborador según lo que vendió.',
  },
  {
    icon: '📊',
    title: 'Reportes de ventas',
    description:
      'Consulta cuánto vendiste, cuándo y quién lo vendió, sin hacer cuentas a mano al final del día.',
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
