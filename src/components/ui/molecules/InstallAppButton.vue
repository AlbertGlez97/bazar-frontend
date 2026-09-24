<template>
  <!--
    InstallAppButton — CTA de instalación PWA.
    • Android/desktop: dispara prompt nativo vía beforeinstallprompt.
    • iOS: muestra instrucciones (Apple NO permite prompt programático).
    • App ya instalada: no renderiza nada.
  -->
  <template v-if="!isInstalled">
    <!-- Botón principal -->
    <button
      v-if="canPrompt || platform === 'ios'"
      class="install-btn"
      :class="{ 'install-btn--ghost': variant === 'ghost' }"
      @click="handleClick"
    >
      <span class="install-btn__icon">📱</span>
      <span>{{ label }}</span>
    </button>

    <!-- Modal iOS — instrucciones manuales -->
    <div v-if="iosModalOpen" class="install-modal" role="dialog" @click.self="iosModalOpen = false">
      <div class="install-modal__content">
        <button class="install-modal__close" @click="iosModalOpen = false" aria-label="Cerrar">✕</button>

        <h3 class="install-modal__title">Instalar en tu iPhone/iPad</h3>
        <p class="install-modal__sub">
          Apple no permite instalación automática. Sigue estos 3 pasos en Safari:
        </p>

        <ol class="install-modal__steps">
          <li>
            <strong>1.</strong>
            Toca el botón <strong>Compartir</strong>
            <span class="install-modal__icon">⬆</span>
            en la barra inferior de Safari.
          </li>
          <li>
            <strong>2.</strong>
            Desplázate y toca
            <strong>"Agregar a pantalla de inicio"</strong>
            <span class="install-modal__icon">➕</span>
          </li>
          <li>
            <strong>3.</strong>
            Toca <strong>"Agregar"</strong> en la esquina superior derecha.
          </li>
        </ol>

        <div class="install-modal__note">
          💡 Después de instalar, abre la app desde el icono en tu pantalla de inicio —
          funcionará como una app nativa con splash screen y sin barra del navegador.
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { usePwaInstall } from '@/composables/usePwaInstall'

interface Props {
  /** Texto del botón. Default: "Instalar en tu celular" */
  label?:   string
  /** Variante visual. 'primary' (default) o 'ghost' */
  variant?: 'primary' | 'ghost'
}

withDefaults(defineProps<Props>(), {
  label:   'Instalar en tu celular',
  variant: 'primary',
})

const { canPrompt, platform, isInstalled, promptInstall } = usePwaInstall()
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
  gap: 8px;
  padding: 12px 20px;
  border: none;
  background: var(--color-primary, #2563eb);
  color: white;
  border-radius: 8px;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 16px rgba(37, 99, 235, 0.3);
  transition: transform 0.15s, box-shadow 0.15s;
}
.install-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 22px rgba(37, 99, 235, 0.4);
}
.install-btn--ghost {
  background: transparent;
  color: var(--color-text, #f0f4ff);
  border: 1px solid var(--color-border, #1c2a3e);
  box-shadow: none;
}
.install-btn--ghost:hover {
  border-color: var(--color-primary, #2563eb);
  background: rgba(37, 99, 235, 0.08);
}
.install-btn__icon { font-size: 1.1rem; line-height: 1; }

/* ── Modal iOS ─────────────────────────────────────────────── */
.install-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(8, 13, 23, 0.82);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.install-modal__content {
  position: relative;
  background: var(--color-surface, #fff);
  color: var(--color-text, #0f172a);
  border-radius: 16px;
  padding: 28px;
  max-width: 440px;
  width: 100%;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.4);
}
.install-modal__close {
  position: absolute;
  top: 12px; right: 14px;
  background: transparent;
  border: none;
  font-size: 1.2rem;
  color: var(--color-text-muted, #64748b);
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
}
.install-modal__close:hover { background: rgba(0,0,0,0.05); }

.install-modal__title {
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0 0 8px;
}
.install-modal__sub {
  font-size: 0.9rem;
  color: var(--color-text-muted, #64748b);
  margin: 0 0 18px;
  line-height: 1.45;
}

.install-modal__steps {
  list-style: none;
  padding: 0;
  margin: 0 0 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.install-modal__steps li {
  padding: 12px 14px;
  background: rgba(37, 99, 235, 0.06);
  border-left: 3px solid var(--color-primary, #2563eb);
  border-radius: 6px;
  font-size: 0.9rem;
  line-height: 1.5;
}
.install-modal__icon {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(37, 99, 235, 0.15);
  border-radius: 4px;
  font-weight: 700;
  margin: 0 4px;
}

.install-modal__note {
  font-size: 0.82rem;
  color: var(--color-text-muted, #64748b);
  background: rgba(234, 179, 8, 0.08);
  border: 1px solid rgba(234, 179, 8, 0.25);
  border-radius: 6px;
  padding: 10px 12px;
  line-height: 1.45;
}
</style>
