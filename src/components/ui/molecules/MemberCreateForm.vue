<template>
  <!-- Molécula: formulario para agregar a una persona al equipo (solo socios).
       No hace fetch (regla del barrel @/components): valida en el cliente y
       emite `submit`; la vista llama a POST /members y devuelve aquí lo que el
       servidor señaló. La comisión solo existe para un colaborador: para un socio
       el campo no se muestra y el servidor rechazaría el dato. -->
  <form
    class="member-create-form"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <AppInput
      v-model="form.nombre"
      label="Nombre"
      name="nombre"
      size="lg"
      autocomplete="off"
      :disabled="loading"
      :error="errors.nombre || serverErrors.nombre || undefined"
    />

    <AppInput
      v-model="form.apellidos"
      label="Apellidos"
      name="apellidos"
      size="lg"
      autocomplete="off"
      :disabled="loading"
      :error="errors.apellidos || serverErrors.apellidos || undefined"
    />

    <AppInput
      v-model="form.correo"
      label="Correo"
      name="correo"
      type="email"
      inputmode="email"
      size="lg"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      :disabled="loading"
      :error="errors.correo || serverErrors.correo || undefined"
    />

    <AppSelect
      v-model="form.role"
      label="Rol"
      size="lg"
      :disabled="loading"
    >
      <option value="colaborador">
        Colaborador
      </option>
      <option value="socio">
        Socio
      </option>
    </AppSelect>

    <template v-if="form.role === 'colaborador'">
      <AppInput
        v-model="form.commission"
        label="Comisión (%)"
        name="commission"
        inputmode="decimal"
        size="lg"
        autocomplete="off"
        placeholder="Ej. 10 o 12.5"
        aria-describedby="member-create-commission-hint"
        :disabled="loading"
        :error="errors.commission || serverErrors.commission || undefined"
      />
      <p
        id="member-create-commission-hint"
        class="member-create-form__hint"
      >
        Déjalo vacío para usar la comisión general del negocio.
      </p>
    </template>

    <AppAlert
      v-if="error"
      type="error"
      :dismissible="false"
    >
      {{ error }}
    </AppAlert>

    <div class="member-create-form__actions">
      <AppButton
        type="button"
        variant="secondary"
        size="lg"
        :disabled="loading"
        @click="emit('cancel')"
      >
        Cancelar
      </AppButton>
      <AppButton
        type="submit"
        variant="primary"
        size="lg"
        :loading="loading"
        :disabled="loading"
      >
        Agregar persona
      </AppButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import AppInput from '@/components/ui/atoms/AppInput.vue'
import AppSelect from '@/components/ui/atoms/AppSelect.vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import AppAlert from '@/components/ui/molecules/AppAlert.vue'
import { VOICE, type CreateMemberField } from '@/config/voice'
import { percentTextToBps } from '@/utils/commission'
import type { CreateMemberPayload, MemberRole } from '@/types/member.types'

const props = withDefaults(defineProps<{
  /** Controlado por la vista mientras espera la respuesta de POST /members */
  loading?: boolean
  /** Lo que el servidor señaló campo por campo (400) */
  serverErrors?: Partial<Record<CreateMemberField, string>>
  /** Error general (403, 409, 502, red…) */
  error?: string | null
}>(), {
  loading: false,
  serverErrors: () => ({}),
  error: null,
})

const emit = defineEmits<{
  /** Solo cuando la validación de cliente pasa */
  submit: [payload: CreateMemberPayload]
  cancel: []
}>()

// Límites del contrato: nombre y apellidos 1..100; correo un solo domicilio de
// hasta 254 caracteres.
const MAX_NAME = 100
const MAX_EMAIL = 254
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const form = reactive<{ nombre: string; apellidos: string; correo: string; role: MemberRole; commission: string }>({
  nombre: '', apellidos: '', correo: '', role: 'colaborador', commission: '',
})
const errors = reactive({ nombre: '', apellidos: '', correo: '', commission: '' })

// Un socio no tiene comisión: el campo desaparece y lo escrito se descarta, para
// que ni se vea ni se envíe (ni estorbe la validación).
watch(() => form.role, (role) => {
  if (role === 'socio') {
    form.commission = ''
    errors.commission = ''
  }
})

function validate(): boolean {
  const nombre = form.nombre.trim()
  errors.nombre = !nombre ? VOICE.team.badName
    : nombre.length > MAX_NAME ? `El nombre es demasiado largo (máximo ${MAX_NAME} caracteres).` : ''

  const apellidos = form.apellidos.trim()
  errors.apellidos = !apellidos ? VOICE.team.badLastName
    : apellidos.length > MAX_NAME ? `Los apellidos son demasiado largos (máximo ${MAX_NAME} caracteres).` : ''

  const correo = form.correo.trim()
  errors.correo = !correo ? 'Escribe el correo.'
    : !EMAIL_RE.test(correo) || correo.length > MAX_EMAIL ? VOICE.team.badEmail : ''

  const commission = form.commission.trim()
  errors.commission = form.role === 'colaborador' && commission && percentTextToBps(commission) === null
    ? VOICE.team.badCommission : ''

  return !errors.nombre && !errors.apellidos && !errors.correo && !errors.commission
}

function handleSubmit() {
  if (props.loading) return
  if (!validate()) return

  const payload: CreateMemberPayload = {
    nombre: form.nombre.trim(),
    apellidos: form.apellidos.trim(),
    correo: form.correo.trim(),
    role: form.role,
  }
  // Solo un colaborador con comisión elegida la manda; sin ella se usa la general.
  const commission = form.commission.trim()
  if (form.role === 'colaborador' && commission) payload.commissionRateBps = percentTextToBps(commission) as number
  emit('submit', payload)
}
</script>

<style scoped>
.member-create-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.member-create-form__hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: calc(var(--spacing-sm) * -1) 0 0;
}
.member-create-form__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
</style>
