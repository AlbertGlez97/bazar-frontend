<template>
  <!-- Organismo: sección de contacto — encabezado + ContactForm -->
  <section
    class="contact-section"
    aria-label="Contacto"
  >
    <div class="contact-section__inner container">
      <h2 class="contact-section__title">
        ¿Tienes dudas antes de empezar?
      </h2>
      <p class="contact-section__subtitle">
        Escríbenos y te ayudamos a ver si el sistema encaja con tu negocio.
      </p>

      <ContactForm class="contact-section__form" />
    </div>
  </section>
</template>

<script setup lang="ts">
// Organismo: solo composición — la lógica de validación/envío vive en la
// molécula ContactForm.
import ContactForm from '@/components/ui/molecules/ContactForm.vue'
</script>

<style scoped>
.contact-section { padding: var(--spacing-2xl) var(--spacing-md); background: var(--color-surface); }

.contact-section__inner { max-width: 32rem; margin: 0 auto; text-align: center; }

.contact-section__title {
  font-size:   var(--font-size-xl);
  font-weight: 800;
  color:       var(--color-text);
}

.contact-section__subtitle {
  margin-top: var(--spacing-sm);
  color:      var(--color-text-muted);
}

.contact-section__form {
  margin-top: var(--spacing-xl);
  text-align: left;
}
</style>
