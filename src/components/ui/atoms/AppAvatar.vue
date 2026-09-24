<template>
  <!-- Átomo: avatar con iniciales generadas desde el nombre -->
  <div
    class="app-avatar"
    :class="`app-avatar--${size}`"
    :style="{ background: avatarColor }"
    :title="name"
    aria-hidden="true"
  >
    {{ initials }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  name:  string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}>(), { size: 'md' })

// Genera hasta 2 iniciales a partir del nombre
const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
})

// Color determinístico basado en el nombre — mismo nombre = mismo color
const PALETTE = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#d97706', '#059669', '#0891b2', '#4f46e5',
]
const avatarColor = computed(() => {
  let hash = 0
  for (const ch of props.name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff
  return PALETTE[Math.abs(hash) % PALETTE.length]
})
</script>

<style scoped>
.app-avatar {
  display:         inline-flex;
  align-items:     center;
  justify-content: center;
  border-radius:   var(--radius-full, 9999px);
  color:           #fff;
  font-weight:     600;
  flex-shrink:     0;
  user-select:     none;
}
.app-avatar--xs { width: 22px; height: 22px; font-size: 0.6rem; }
.app-avatar--sm { width: 28px; height: 28px; font-size: 0.68rem; }
.app-avatar--md { width: 36px; height: 36px; font-size: 0.8rem; }
.app-avatar--lg { width: 48px; height: 48px; font-size: 1rem;   }
.app-avatar--xl { width: 64px; height: 64px; font-size: 1.25rem; }
</style>
