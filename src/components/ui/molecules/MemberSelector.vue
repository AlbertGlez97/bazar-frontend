<template>
  <!-- Molécula: selector rápido de persona (sin PIN) — tarjetas grandes
       pensadas para pantalla táctil de tablet, no un <select> pequeño.
       Solo renderiza y emite `select`; el fetch a GET /members y el guardado
       en el store viven en SelectContextView (regla del barrel @/components). -->
  <div
    class="member-selector"
    role="list"
  >
    <p
      v-if="!members.length && !loading"
      class="member-selector__empty"
    >
      No hay personas activas para elegir. Habla con un socio.
    </p>

    <button
      v-for="m in members"
      :key="m.id"
      type="button"
      class="member-selector__card"
      role="listitem"
      :disabled="loading"
      @click="emit('select', m)"
    >
      <AppAvatar
        :name="m.name"
        size="lg"
      />
      <span class="member-selector__name">{{ m.name }}</span>
      <AppBadge :color="m.role === 'socio' ? 'purple' : 'blue'">
        {{ m.role === 'socio' ? 'Socio' : 'Colaborador' }}
      </AppBadge>
    </button>
  </div>
</template>

<script setup lang="ts">
import AppAvatar from '@/components/ui/atoms/AppAvatar.vue'
import AppBadge from '@/components/ui/atoms/AppBadge.vue'
import type { Member } from '@/types/member.types'

withDefaults(defineProps<{
  members: Member[]
  /** Controlado por el padre mientras se confirma la selección */
  loading?: boolean
}>(), {
  loading: false,
})

const emit = defineEmits<{
  select: [member: Member]
}>()
</script>

<style scoped>
.member-selector {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: var(--spacing-md);
}
.member-selector__empty {
  color: var(--color-text-muted);
  text-align: center;
}
.member-selector__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  min-height: 8rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: inherit;
  transition: border-color var(--transition), transform var(--transition);
}
.member-selector__card:hover,
.member-selector__card:focus-visible {
  border-color: var(--color-primary);
  transform: translateY(-2px);
}
.member-selector__card:disabled {
  opacity: .6;
  cursor: not-allowed;
  pointer-events: none;
}
.member-selector__name {
  font-weight: 600;
  color: var(--color-text);
  text-align: center;
}
</style>
