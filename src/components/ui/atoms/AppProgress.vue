<template>
  <!-- Átomo: barra de progreso lineal con porcentaje y colores semánticos -->
  <div
    class="app-progress"
    :class="{ 'app-progress--with-label': showLabel }"
  >
    <div
      class="app-progress__track"
      :style="{ height: trackHeight }"
    >
      <div
        class="app-progress__bar"
        :class="`app-progress__bar--${color}`"
        :style="{ width: clampedValue + '%' }"
        :aria-valuenow="clampedValue"
        aria-valuemin="0"
        aria-valuemax="100"
        role="progressbar"
      />
    </div>
    <span
      v-if="showLabel"
      class="app-progress__label"
    >{{ clampedValue }}%</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  value:      number                     // 0-100
  color?:     'primary' | 'success' | 'warning' | 'danger'
  showLabel?: boolean
  /** Altura de la barra. Number → px. String → lo que venga ('0.5rem', '8px', ...). Default '0.375rem' (6px). */
  height?:    number | string
}>(), {
  color:     'primary',
  showLabel: false,
  height:    undefined,
})

// Limita el valor al rango 0-100
const clampedValue = computed(() => Math.min(100, Math.max(0, Math.round(props.value))))

// Resuelve la altura del track — antes este prop estaba declarado pero no aplicado (bug)
const trackHeight = computed(() => {
  if (props.height == null)               return '0.375rem'   // default: 6px
  if (typeof props.height === 'number')   return `${props.height}px`
  return props.height
})
</script>

<style scoped>
.app-progress {
  display:     flex;
  align-items: center;
  gap:         0.5rem;
}
.app-progress__track {
  flex:          1;
  background:    var(--color-border);
  border-radius: var(--radius-full, 9999px);
  overflow:      hidden;
  /* height viene del :style inline — default 0.375rem (6px) */
}
.app-progress__bar {
  height:        100%;
  border-radius: inherit;
  transition:    width .4s ease;
}
.app-progress__bar--primary { background: var(--color-primary); }
.app-progress__bar--success { background: var(--color-success); }
.app-progress__bar--warning { background: var(--color-accent); }
.app-progress__bar--danger  { background: var(--color-danger);  }

.app-progress__label {
  font-size:   0.8125rem;         /* 13px — más legible en mobile */
  font-weight: 600;
  color:       var(--color-text-muted);
  flex-shrink: 0;
  min-width:   2.5ch;
  text-align:  right;
}
</style>
