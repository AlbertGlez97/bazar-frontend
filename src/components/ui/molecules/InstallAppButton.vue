<template>
  <!--
    InstallAppButton — CTA de instalación PWA. Visible solo si la app NO está instalada y:
    • Android/escritorio: Chrome ya disparó beforeinstallprompt (el evento lo guarda
      usePwaInstall desde el arranque de la app, aunque este botón se monte después).
    • iPhone/iPad: no hay evento; el botón abre una explicación corta.
    La explicación va teleportada a <body> y por encima del cajón del celular.
  -->
  <template v-if="!isInstalled">
    <button
      v-if="canPrompt || platform === 'ios'"
      type="button"
      class="install-btn"
      :class="{ 'install-btn--ghost': variant === 'ghost' }"
      @click="handleClick"
    >
      <span
        class="install-btn__icon"
        aria-hidden="true"
      >📱</span>
      <span>{{ label }}</span>
    </button>

    <Teleport to="body">
      <div
        v-if="iosModalOpen"
        class="install-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-modal-title"
        @click.self="iosModalOpen = false"
      >
        <div class="install-modal__content">
          <button
            type="button"
            class="install-modal__close"
            aria-label="Cerrar"
            @click="iosModalOpen = false"
          >
            <span aria-hidden="true">✕</span>
          </button>

          <h3
            id="install-modal-title"
            class="install-modal__title"
          >
            Instalar en tu iPhone o iPad
          </h3>

          <template v-if="iosBrowser === 'safari'">
            <p class="install-modal__sub">
              Apple no deja instalar con un solo toque. Haz esto en Safari:
            </p>
            <ol class="install-modal__steps">
              <li>
                <strong>1.</strong>
                Toca <strong>Compartir</strong>
                <span
                  class="install-modal__icon"
                  aria-hidden="true"
                >⬆</span>
                en la barra de Safari.
              </li>
              <li>
                <strong>2.</strong>
                Elige <strong>Añadir a pantalla de inicio</strong>.
              </li>
              <li>
                <strong>3.</strong>
                Toca <strong>Añadir</strong>.
              </li>
            </ol>
            <div class="install-modal__note">
              Después, abre La Marchanta desde el ícono nuevo.
            </div>
          </template>

          <template v-else>
            <p class="install-modal__sub">
              Chrome en iPhone no puede instalar la app.
            </p>
            <div class="install-modal__note">
              Abre esta página en Safari y sigue los pasos desde ahí.
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </template>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { usePwaInstall } from '@/composables/usePwaInstall'

interface Props {
  /** Texto del botón. Default: "Instalar app" */
  label?: string
  /** Variante visual. 'primary' (default) o 'ghost' */
  variant?: 'primary' | 'ghost'
}

withDefaults(defineProps<Props>(), {
  label: 'Instalar app',
  variant: 'primary',
})

const { canPrompt, platform, iosBrowser, isInstalled, promptInstall } = usePwaInstall()
const iosModalOpen = ref(false)

async function handleClick() {
  if (platform === 'ios') {
    iosModalOpen.value = true
    return
  }
  await promptInstall()
}
</script>

<style scoped>
.install-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0.75rem 1.25rem;
  min-height: var(--control-height);
  border: none;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 8px;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-md);
  transition: transform 0.15s, box-shadow 0.15s;
}
.install-btn:hover {
  transform: translateY(-1px);
  background: var(--color-primary-hover);
  box-shadow: var(--shadow-lg);
}
.install-btn--ghost {
  background: transparent;
  color: inherit;
  border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
  box-shadow: none;
}
.install-btn--ghost:hover {
  border-color: var(--color-accent);
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.install-btn__icon { font-size: 1.1rem; line-height: 1; }

/* ── Modal iOS ─────────────────────────────────────────────── */
.install-modal {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: var(--color-overlay);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
}
.install-modal__content {
  position: relative;
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: 16px;
  padding: 1.75rem;
  max-width: 27.5rem; /* 440px */
  width: 100%;
  box-shadow: var(--shadow-pop);
}
.install-modal__close {
  position: absolute;
  top: 12px; right: 14px;
  background: transparent;
  border: none;
  font-size: 1.2rem;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
}
.install-modal__close:hover { background: var(--color-surface-alt); }

.install-modal__title {
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0 0 var(--spacing-sm);
}
.install-modal__sub {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin: 0 0 1.125rem;
  line-height: 1.45;
}

.install-modal__steps {
  list-style: none;
  padding: 0;
  margin: 0 0 1.125rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.install-modal__steps li {
  padding: 0.75rem 0.875rem;
  background: var(--color-primary-soft);
  border-left: 3px solid var(--color-primary);
  border-radius: 6px;
  font-size: 0.9rem;
  line-height: 1.5;
}
.install-modal__icon {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: var(--color-surface);
  border-radius: 4px;
  font-weight: 700;
  margin: 0 var(--spacing-xs);
}

.install-modal__note {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  background: var(--color-accent-soft);
  border: 1px solid color-mix(in srgb, var(--color-accent) 60%, transparent);
  border-radius: 6px;
  padding: 0.625rem 0.75rem;
  line-height: 1.45;
}
</style>
