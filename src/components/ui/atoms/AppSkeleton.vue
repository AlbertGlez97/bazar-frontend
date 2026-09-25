<template>
  <!-- Átomo: placeholder animado para estados de carga — evita layout shift -->
  <div
    class="app-skeleton"
    :class="[
      `app-skeleton--${variant}`,
      { 'app-skeleton--rounded': rounded },
    ]"
    :style="{
      width: width ? (typeof width === 'number' ? width + 'px' : width) : undefined,
      height: height ? (typeof height === 'number' ? height + 'px' : height) : undefined,
    }"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
// variant text→ancho 100%, circle→cuadrado con border-radius 50%
withDefaults(defineProps<{
  variant?: 'text' | 'rect' | 'circle'
  width?:   string | number
  height?:  string | number
  rounded?: boolean
}>(), {
  variant: 'rect',
  width:   undefined,
  height:  undefined,
  rounded: false,
})
</script>

<style scoped>
.app-skeleton {
  background: linear-gradient(
    90deg,
    var(--color-border) 25%,
    var(--color-surface-alt) 50%,
    var(--color-border) 75%
  );
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.6s ease infinite;
  border-radius: var(--radius-sm);
}

/* Variantes */
.app-skeleton--text   { width: 100%; height: 14px; border-radius: 4px; }
.app-skeleton--rect   { border-radius: var(--radius-sm); }
.app-skeleton--circle { border-radius: 50%; }
.app-skeleton--rounded { border-radius: var(--radius-md); }

@keyframes skeleton-shimmer {
  0%   { background-position: 100% 50%; }
  100% { background-position:   0% 50%; }
}
</style>
