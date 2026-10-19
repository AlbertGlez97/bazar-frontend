<template>
  <!-- Átomo: contador "usados/máximo" de un campo de texto. Se ve "12/40"; el lector de
       pantalla lee la frase completa al llegar al campo (aria-describedby), sin ser una
       región viva: no habla en cada letra. Cerca del límite cambia de color Y de peso. -->
  <span
    class="app-char-counter"
    :class="{ 'app-char-counter--near': near, 'app-char-counter--full': full }"
  >
    <span aria-hidden="true">{{ current }}/{{ max }}</span>
    <span class="app-char-counter__sr">{{ current }} de {{ max }} caracteres</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** Caracteres escritos. */
  current: number
  /** Máximo permitido. */
  max: number
}>()

const full = computed(() => props.current >= props.max)
const near = computed(() => !full.value && props.current >= props.max * 0.9)
</script>

<style scoped>
.app-char-counter {
  font-size: var(--font-size-xs, 0.75rem);
  color: var(--color-text-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.app-char-counter--near { color: var(--color-warning); font-weight: 600; }
.app-char-counter--full { color: var(--color-danger); font-weight: 700; }
.app-char-counter__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
