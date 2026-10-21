<template>
  <!-- Organismo: lista del equipo. Solo renderiza: el rol y el estado se leen en
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

        <!-- Cuenta personal de un socio activo: solo si la vista trae la información. -->
        <div
          v-if="accountOf(member)"
          class="team-list__account"
        >
          <p
            v-if="accountOf(member)!.hasPersonalAccount"
            class="team-list__account-text"
          >
            Con cuenta personal
          </p>
          <template v-else>
            <p class="team-list__account-text">
              Sin cuenta personal
            </p>
            <p
              v-if="inviteStatusText(accountOf(member)!)"
              class="team-list__account-text"
              data-test="invite-status"
            >
              {{ inviteStatusText(accountOf(member)!) }}
            </p>
            <AppButton
              type="button"
              size="sm"
              variant="secondary"
              data-test="invite"
              :aria-label="`${accountOf(member)!.invitation ? 'Reenviar invitación' : 'Invitar'} a ${member.name}`"
              :disabled="busy || !resendState(accountOf(member)!, now).allowed"
              @click="$emit('invite', member.id)"
            >
              {{ accountOf(member)!.invitation ? 'Reenviar invitación' : 'Invitar' }}
            </AppButton>
            <p
              v-if="resendState(accountOf(member)!, now).hint"
              class="team-list__account-text"
              data-test="invite-hint"
            >
              {{ resendState(accountOf(member)!, now).hint }}
            </p>
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import AppAvatar from '@/components/ui/atoms/AppAvatar.vue'
import AppBadge from '@/components/ui/atoms/AppBadge.vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import { VOICE } from '@/config/voice'
import { inviteStatusText, resendState } from '@/utils/account-invitations'
import type { InvitationStatus } from '@/types/account-invitation.types'
import type { Member } from '@/types/member.types'

const props = withDefaults(defineProps<{
  members: Member[]
  /** Persona que tiene la sesión abierta en este dispositivo */
  currentMemberId?: string | null
  /** Quién ya tiene cuenta personal y quién tiene invitación (solo socios la reciben). */
  invitations?: InvitationStatus[] | null
  /** Hora de referencia para el reenvío; se pasa para que la lista no consulte el reloj. */
  now?: Date
  /** Hay un envío en curso: se bloquean los botones. */
  busy?: boolean
}>(), {
  currentMemberId: null,
  invitations: null,
  now: () => new Date(),
  busy: false,
})

defineEmits<{ invite: [memberId: string] }>()

/** Solo los socios activos tienen cuenta personal que mostrar. */
function accountOf(member: Member): InvitationStatus | null {
  if (!props.invitations || member.role !== 'socio' || !member.active) return null
  return props.invitations.find((i) => i.memberId === member.id) ?? null
}
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
  min-height: 3.5rem;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.team-list__item--inactive { background: transparent; }
.team-list__item--inactive .team-list__name { color: var(--color-text-muted); }

.team-list__account {
  flex-basis: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}
.team-list__account-text { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }

.team-list__name { flex: 1; min-width: 8rem; font-weight: 600; }
.team-list__you {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-weight: 600;
}
</style>
