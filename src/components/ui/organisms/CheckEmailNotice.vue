<template>
  <!-- Organismo: pantalla "Revisa tu correo" tras enviar el registro. Solo muestra y emite
       eventos: la cuenta regresiva y la llamada de reenvío viven en la vista. -->
  <section
    class="check-email"
    aria-labelledby="check-email-title"
  >
    <h1
      id="check-email-title"
      class="check-email__title"
    >
      Revisa tu correo
    </h1>
    <p class="check-email__lead">
      Te mandamos un enlace a <strong class="check-email__address">{{ correo }}</strong>.
      Ábrelo y toca <strong>Confirmar mi correo</strong> para terminar.
    </p>
    <ul class="check-email__tips">
      <li>Hasta que confirmes, nadie revisa tu solicitud.</li>
      <li>Si no lo ves, revisa también la carpeta de correo no deseado.</li>
      <li>El enlace vence en 48 horas.</li>
    </ul>

    <!-- Siempre en el DOM para que los lectores de pantalla anuncien el cambio -->
    <p
      class="check-email__status"
      role="status"
      aria-live="polite"
    >
      {{ message }}
    </p>

    <div class="check-email__actions">
      <AppButton
        type="button"
        variant="primary"
        size="lg"
        block
        :loading="resending"
        :disabled="resending || secondsLeft > 0"
        @click="$emit('resend')"
      >
        {{ secondsLeft > 0 ? `Reenviar correo en ${secondsLeft} s` : 'Reenviar correo' }}
      </AppButton>
      <AppButton
        type="button"
        variant="ghost"
        size="lg"
        block
        :disabled="resending"
        @click="$emit('change-email')"
      >
        Corregir mi correo
      </AppButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/atoms/AppButton.vue'

defineProps<{
  correo: string
  /** Segundos que faltan para poder reenviar (0 = ya se puede) */
  secondsLeft: number
  resending: boolean
  /** Resultado del último reenvío, para anunciarlo */
  message: string
}>()

defineEmits<{
  resend: []
  'change-email': []
}>()
</script>

<style scoped>
.check-email { display: flex; flex-direction: column; gap: var(--spacing-md); }
.check-email__title { margin: 0; font-size: var(--font-size-2xl); font-weight: 800; color: var(--color-text); text-align: center; }
.check-email__lead { margin: 0; color: var(--color-text); line-height: 1.55; overflow-wrap: anywhere; }
.check-email__tips { margin: 0; padding-left: var(--spacing-lg); color: var(--color-text-muted); line-height: 1.6; }
.check-email__status { margin: 0; min-height: 1.5em; color: var(--color-text); font-weight: 600; }
.check-email__actions { display: flex; flex-direction: column; gap: var(--spacing-sm); }
</style>
