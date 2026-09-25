<template>
  <!-- Molécula: formulario de registro de negocio, validado con VeeValidate +
       Zod (src/validation/business-registration.schema.ts). A diferencia de un
       formulario simulado, este SÍ dispara una llamada real — pero esa llamada
       vive en la vista (RegisterBusinessView), no aquí: las moléculas de ui/ no
       acceden a stores ni hacen fetch (ver reglas del barrel @/components). -->
  <form
    ref="formEl"
    class="business-registration-form"
    novalidate
    :aria-busy="loading"
    @submit.prevent="onSubmit"
  >
    <AppInput
      v-model="nombreNegocio"
      v-bind="nombreNegocioAttrs"
      name="nombreNegocio"
      label="Nombre del negocio"
      placeholder="Ej. Abarrotes Los Pinos"
      autocomplete="organization"
      :disabled="loading"
      :error="errors.nombreNegocio"
    />

    <div class="business-registration-form__row">
      <AppInput
        v-model="nombre"
        v-bind="nombreAttrs"
        name="nombre"
        label="Tu nombre"
        placeholder="Ej. Ana"
        autocomplete="given-name"
        :disabled="loading"
        :error="errors.nombre"
      />
      <AppInput
        v-model="apellidos"
        v-bind="apellidosAttrs"
        name="apellidos"
        label="Tus apellidos"
        placeholder="Ej. Pérez Soto"
        autocomplete="family-name"
        :disabled="loading"
        :error="errors.apellidos"
      />
    </div>

    <AppInput
      v-model="correo"
      v-bind="correoAttrs"
      name="correo"
      type="email"
      inputmode="email"
      label="Correo electrónico"
      placeholder="tu@correo.com"
      autocomplete="email"
      aria-describedby="registro-correo-hint"
      :disabled="loading"
      :error="errors.correo"
    />
    <p
      id="registro-correo-hint"
      class="business-registration-form__hint"
    >
      Aquí te mandamos tu usuario y contraseña, solo si aprobamos tu solicitud.
    </p>

    <AppInput
      v-model="telefono"
      v-bind="telefonoAttrs"
      name="telefono"
      type="tel"
      inputmode="tel"
      label="Teléfono (opcional)"
      placeholder="Ej. 55 1234 5678"
      autocomplete="tel"
      :disabled="loading"
      :error="errors.telefono"
    />

    <!-- Estado pendiente: el botón muestra su spinner (sin texto) y esto lo dice en palabras -->
    <p
      v-if="loading"
      class="business-registration-form__status"
      role="status"
    >
      Enviando tu solicitud…
    </p>

    <AppButton
      type="submit"
      variant="primary"
      size="lg"
      block
      :loading="loading"
      :disabled="loading"
    >
      Enviar solicitud
    </AppButton>
  </form>
</template>

<script setup lang="ts">
// Molécula: agrupa átomos (AppInput, AppButton) + validación de cliente.
// No hace ninguna llamada HTTP — solo emite `submit` con un payload validado.
//
// Modos de validación (deliberados, no simulados): cada campo se valida al
// salir de él (blur). Una vez que tiene error, se revalida mientras se escribe
// para que el mensaje desaparezca en cuanto se corrige. Tras el primer intento
// de envío, todos los campos se validan también al escribir.
import { nextTick, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import AppInput from '@/components/ui/atoms/AppInput.vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import { businessRegistrationSchema } from '@/validation/business-registration.schema'
import type { BusinessRegistrationPayload } from '@/types/business-registration.types'

type FieldName = 'nombreNegocio' | 'nombre' | 'apellidos' | 'correo' | 'telefono'

const props = withDefaults(defineProps<{
  /** Controlado por el padre mientras espera la respuesta real del backend */
  loading?: boolean
}>(), {
  loading: false,
})

const emit = defineEmits<{
  /** Se emite únicamente cuando la validación de cliente pasa */
  submit: [payload: BusinessRegistrationPayload]
}>()

const formEl = ref<HTMLFormElement | null>(null)

const { defineField, errors, handleSubmit, submitCount, setFieldError } = useForm({
  validationSchema: toTypedSchema(businessRegistrationSchema),
  initialValues: { nombreNegocio: '', nombre: '', apellidos: '', correo: '', telefono: '' },
})

const fieldConfig = (state: { errors: string[] }) => ({
  validateOnBlur: true,
  validateOnChange: false,
  validateOnInput: false,
  validateOnModelUpdate: state.errors.length > 0 || submitCount.value > 0,
})

const [nombreNegocio, nombreNegocioAttrs] = defineField('nombreNegocio', fieldConfig)
const [nombre, nombreAttrs] = defineField('nombre', fieldConfig)
const [apellidos, apellidosAttrs] = defineField('apellidos', fieldConfig)
const [correo, correoAttrs] = defineField('correo', fieldConfig)
const [telefono, telefonoAttrs] = defineField('telefono', fieldConfig)

// Evita el doble envío: el padre tarda un tick en poner `loading`, y la
// validación es asíncrona. `sent` bloquea hasta que el padre termina.
const sent = ref(false)
watch(() => props.loading, (now, before) => {
  if (before && !now) sent.value = false
})

function focusFirstInvalid() {
  formEl.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}

const submit = handleSubmit(
  (values) => {
    if (props.loading || sent.value) return
    sent.value = true
    emit('submit', {
      nombreNegocio: values.nombreNegocio,
      nombre: values.nombre,
      apellidos: values.apellidos,
      correo: values.correo,
      // Sin teléfono no se manda la clave: el contrato rechaza campos desconocidos
      // y un teléfono vacío no es un teléfono.
      ...(values.telefono ? { telefono: values.telefono } : {}),
    })
  },
  () => { nextTick(focusFirstInvalid) },
)

function onSubmit(event: Event) {
  if (props.loading || sent.value) return
  return submit(event)
}

/** El padre lo usa para mostrar bajo un campo un error que solo el servidor conoce. */
function setServerFieldError(field: FieldName, message: string) {
  setFieldError(field, message)
  nextTick(() => {
    formEl.value?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus()
  })
}

defineExpose({ setFieldError: setServerFieldError })
</script>

<style scoped>
.business-registration-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.business-registration-form__row {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-md);
}

.business-registration-form__hint {
  margin-top: calc(var(--spacing-sm) * -1);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.business-registration-form__status {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-muted);
  text-align: center;
}

@media (min-width: 480px) {
  .business-registration-form__row { grid-template-columns: 1fr 1fr; }
}
</style>
