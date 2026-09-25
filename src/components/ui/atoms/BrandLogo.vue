<template>
  <span
    class="brand-logo"
    :class="[`brand-logo--${tone}`, { 'brand-logo--mark-only': variant === 'mark' }]"
    :style="{ '--logo-size': `${size}px` }"
  >
    <!-- Átomo: logotipo de La Marchanta. Isotipo = toldo de mercado (franjas
         maíz y crema con festón) sobre una losa de terracota, con una M. El
         nombre va en la tipografía de marca (--font-display). El isotipo es
         decorativo (aria-hidden): quien lo use dentro de un enlace debe darle
         aria-label con el nombre. Reglas de uso: doc/brand-guidelines.md -->
    <svg
      class="brand-logo__mark"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath :id="clipId">
          <rect
            width="64"
            height="64"
            rx="14"
          />
        </clipPath>
      </defs>
      <rect
        class="brand-logo__tile"
        width="64"
        height="64"
        rx="14"
      />
      <g :clip-path="`url(#${clipId})`">
        <!-- Toldo: 4 franjas con festón semicircular -->
        <template
          v-for="i in 4"
          :key="i"
        >
          <rect
            :class="i % 2 ? 'brand-logo__stripe-a' : 'brand-logo__stripe-b'"
            :x="(i - 1) * 16"
            y="0"
            width="16"
            height="18"
          />
          <circle
            :class="i % 2 ? 'brand-logo__stripe-a' : 'brand-logo__stripe-b'"
            :cx="(i - 1) * 16 + 8"
            cy="18"
            r="8"
          />
        </template>
      </g>
      <path
        class="brand-logo__m"
        d="M16 53V38l16 10 16-10v15"
      />
    </svg>
    <span
      v-if="variant === 'full'"
      class="brand-logo__name"
    >{{ APP_NAME }}</span>
  </span>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { APP_NAME } from '@/config/app'

withDefaults(defineProps<{
  /** `full` = isotipo + nombre; `mark` = solo isotipo (sidebar colapsado, iconos) */
  variant?: 'full' | 'mark'
  /** `default` sobre fondos claros; `inverse` sobre fondos oscuros (sidebar) */
  tone?: 'default' | 'inverse'
  /** Alto del isotipo en px; el nombre escala con él */
  size?: number
}>(), {
  variant: 'full',
  tone: 'default',
  size: 36,
})

// Un id por instancia: varias copias del logo en la misma página no chocan.
const clipId = `brand-logo-clip-${useId()}`
</script>

<style scoped>
.brand-logo {
  --logo-size: 36px;
  display: inline-flex;
  align-items: center;
  gap: calc(var(--logo-size) * .3);
  line-height: 1;
}

.brand-logo__mark {
  width: var(--logo-size);
  height: var(--logo-size);
  flex-shrink: 0;
  display: block;
}
.brand-logo__tile     { fill: var(--color-primary); }
.brand-logo__stripe-a { fill: var(--color-accent); }
.brand-logo__stripe-b { fill: var(--color-surface); }
.brand-logo__m {
  fill: none;
  stroke: var(--color-surface);
  stroke-width: 7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.brand-logo__name {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: calc(var(--logo-size) * .62);
  letter-spacing: -.025em;
  color: var(--color-text);
  white-space: nowrap;
}

/* Sobre fondo oscuro el nombre se invierte; el isotipo ya trae su propio color. */
.brand-logo--inverse .brand-logo__name { color: var(--color-surface); }
</style>
