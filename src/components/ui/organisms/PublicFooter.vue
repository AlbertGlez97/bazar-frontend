<template>
  <footer class="public-footer">
    <!-- Organismo: pie de las páginas públicas (inicio, entrar, registro). Marca, firma, los dos
         textos legales y el correo de contacto. Presentacional: los datos salen de src/legal.
         (El comentario va DENTRO del <footer>: así el componente tiene un solo nodo raíz y
         recibe bien la clase que le pase quien lo usa.) -->
    <div class="public-footer__inner container">
      <BrandLogo
        :size="28"
        variant="full"
      />
      <p class="public-footer__tagline">
        Para quien vende de tú a tú.
      </p>

      <nav
        class="public-footer__legal"
        :aria-label="LEGAL_NAV_LABEL"
      >
        <RouterLink
          v-for="link in LEGAL_LINKS"
          :key="link.to"
          :to="link.to"
          class="public-footer__link"
        >
          {{ link.label }}
        </RouterLink>
      </nav>

      <p class="public-footer__contact">
        Contacto:
        <a
          class="public-footer__link"
          :href="`mailto:${LEGAL_CONTACT_EMAIL}`"
        >{{ LEGAL_CONTACT_EMAIL }}</a>
      </p>

      <p class="public-footer__copy">
        &copy; {{ year }} {{ APP_NAME }}
      </p>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { APP_NAME } from '@/config/app'
import { LEGAL_CONTACT_EMAIL } from '@/legal/legal-config'
import { LEGAL_LINKS, LEGAL_NAV_LABEL } from '@/legal/legal-links'
import BrandLogo from '../atoms/BrandLogo.vue'

const year = new Date().getFullYear()
</script>

<style scoped>
.public-footer {
  width: 100%;
  padding: var(--spacing-xl) var(--spacing-md);
  background: var(--color-surface-alt);
  border-top: 1px solid var(--color-border);
}
.public-footer__inner { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-sm); text-align: center; }
.public-footer__tagline { margin: 0; color: var(--color-text); font-weight: 500; }
.public-footer__legal { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--spacing-xs) var(--spacing-md); }
.public-footer__contact { margin: 0; color: var(--color-text-muted); font-size: var(--font-size-sm); }
.public-footer__copy { margin: 0; color: var(--color-text-muted); font-size: var(--font-size-sm); }

/* Enlaces con zona táctil de 44 px */
.public-footer__link {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  color: var(--color-primary-hover);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.public-footer__link:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; border-radius: var(--radius-sm); }
</style>
