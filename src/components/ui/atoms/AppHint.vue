<template>
  <!-- Átomo: línea de ayuda corta, tenue, bajo un campo o un ajuste -->
  <p class="app-hint">
    <slot />
  </p>
</template>

<style scoped>
.app-hint {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: 1.4;
  color: var(--color-text-muted);
}
</style>
