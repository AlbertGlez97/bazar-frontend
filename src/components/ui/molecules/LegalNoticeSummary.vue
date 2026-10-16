<template>
  <!-- Molécula: resumen corto del aviso de privacidad para el formulario de registro, con
       enlaces al texto completo. Abre en otra pestaña para no perder lo que se escribió.
       Solo informa: la casilla de aceptación se integra después en el formulario. -->
  <p class="legal-notice-summary">
    Usamos tus datos para revisar tu solicitud, crear tu cuenta y darte el servicio.
    No los vendemos. Lee el
    <RouterLink
      to="/privacidad"
      target="_blank"
      rel="noopener noreferrer"
    >
      Aviso de Privacidad
    </RouterLink>
    y los
    <RouterLink
      to="/terminos"
      target="_blank"
      rel="noopener noreferrer"
    >
      Términos y Condiciones
    </RouterLink>.
  </p>
</template>

<style scoped>
.legal-notice-summary { margin: 0; font-size: var(--font-size-sm); line-height: 1.55; color: var(--color-text-muted); }
.legal-notice-summary a {
  color: var(--color-primary-hover);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.legal-notice-summary a:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; border-radius: var(--radius-sm); }
</style>
