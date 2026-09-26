<template>
  <!-- Molécula: lista del equipo. Solo renderiza: el rol y el estado se leen en
       texto (nunca solo por color) y la persona que tiene la sesión abierta lleva
       "Tú". Sin ids ni datos internos. -->
  <div class="team-list">
    <p
      v-if="!members.length"
      class="team-list__empty"
    >
      {{ VOICE.team.empty }}
    </p>

    <ul
      v-else
      class="team-list__list"
      aria-label="Personas del equipo"
    >
      <li
        v-for="member in members"
        :key="member.id"
        class="team-list__item"
        :class="{ 'team-list__item--inactive': !member.active }"
      >
        <AppAvatar
          :name="member.name"
          size="md"
        />
        <span class="team-list__name">{{ member.name }}</span>
        <span
          v-if="member.id === currentMemberId"
          class="team-list__you"
        >Tú</span>
        <AppBadge
          class="team-list__role"
          :color="member.role === 'socio' ? 'amber' : 'gray'"
          :filled="member.role === 'socio'"
        >
          {{ member.role === 'socio' ? 'Socio' : 'Colaborador' }}
        </AppBadge>
        <AppBadge
          v-if="!member.active"
          class="team-list__status"
          color="gray"
        >
          Inactivo
        </AppBadge>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import AppAvatar from '@/components/ui/atoms/AppAvatar.vue'
import AppBadge from '@/components/ui/atoms/AppBadge.vue'
import { VOICE } from '@/config/voice'
import type { Member } from '@/types/member.types'

withDefaults(defineProps<{
  members: Member[]
  /** Persona que tiene la sesión abierta en este dispositivo */
  currentMemberId?: string | null
}>(), {
  currentMemberId: null,
})
</script>

<style scoped>
.team-list__empty { color: var(--color-text-muted); }

.team-list__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  list-style: none;
  margin: 0;
  padding: 0;
}

.team-list__item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  min-height: 56px;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.team-list__item--inactive { background: transparent; }
.team-list__item--inactive .team-list__name { color: var(--color-text-muted); }

.team-list__name { flex: 1; min-width: 8rem; font-weight: 600; }
.team-list__you {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-weight: 600;
}
</style>
