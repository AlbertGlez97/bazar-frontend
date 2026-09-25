<template>
  <!-- Organismo: cómo empezar — refleja el flujo real de alta (solicitud → revisión manual → credenciales por correo) -->
  <section
    class="how-section"
    aria-labelledby="how-title"
  >
    <div class="how-section__inner container">
      <h2
        id="how-title"
        class="how-section__title"
      >
        Así empiezas
      </h2>

      <ol class="how-section__steps">
        <li
          v-for="(step, index) in steps"
          :key="step.title"
          class="how-section__step"
        >
          <span
            class="how-section__number"
            aria-hidden="true"
          >{{ index + 1 }}</span>
          <div>
            <h3 class="how-section__step-title">
              {{ step.title }}
            </h3>
            <p class="how-section__step-text">
              {{ step.text }}
            </p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>

<script setup lang="ts">
// Organismo: el alta es una solicitud que un humano revisa; las credenciales
// llegan por correo solo si se aprueba (ver RegisterBusinessView).
const steps = [
  {
    title: 'Cuéntanos de tu negocio',
    text: 'Llena el formulario de registro con tus datos. Te toma un par de minutos.',
  },
  {
    title: 'Lo revisamos',
    text: 'Vemos tu solicitud a mano. Si todo va bien, te mandamos tu usuario y contraseña por correo.',
  },
  {
    title: 'Entra y arma tu catálogo',
    text: 'Con tu usuario, entras y empiezas a cargar tus productos.',
  },
]
</script>

<style scoped>
.how-section { padding: var(--spacing-2xl) var(--spacing-md); }

.how-section__inner { max-width: 44rem; }

.how-section__title {
  text-align: center;
  font-size: var(--font-size-xl);
  font-weight: 800;
}

.how-section__steps {
  margin-top: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.how-section__step {
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-start;
}

.how-section__number {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-family: var(--font-display);
  font-weight: 800;
  font-size: var(--font-size-lg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.how-section__step-title {
  font-size: var(--font-size-lg);
  font-weight: 800;
}

.how-section__step-text {
  margin-top: 2px;
  color: var(--color-text-muted);
}
</style>
