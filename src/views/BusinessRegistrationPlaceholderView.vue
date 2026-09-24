<template>
  <!-- Vista placeholder: el formulario real de registro de negocio
       (conectado a POST /business-registration) es la SIGUIENTE vista,
       fuera del alcance de esta landing. Solo existe para que el CTA
       "Registra tu negocio" tenga a dónde navegar. -->
  <section
    class="business-registration-placeholder"
    aria-label="Registro de negocio"
  >
    <h1>Registro de negocio</h1>
    <p>Muy pronto podrás registrar tu negocio desde aquí.</p>
  </section>
</template>

<style scoped>
.business-registration-placeholder {
  padding: var(--spacing-2xl) var(--spacing-md);
  text-align: center;
}
</style>
