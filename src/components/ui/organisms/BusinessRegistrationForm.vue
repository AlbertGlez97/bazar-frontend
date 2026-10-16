<template>
  <!-- Organismo: formulario de registro de negocio, validado con VeeValidate +
       Zod (src/validation/business-registration.schema.ts). La llamada real vive en la
       vista (RegisterBusinessView), no aquí: las moléculas de ui/ no acceden a stores ni
       hacen fetch (ver reglas del barrel @/components). -->
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

    <AppSelect
      v-model="tipoNegocio"
      v-bind="tipoNegocioAttrs"
      name="tipoNegocio"
      label="Tipo de negocio"
      placeholder="Elige una opción"
      :disabled="loading"
      :error="errors.tipoNegocio"
    >
      <option
        v-for="option in BUSINESS_TYPE_OPTIONS"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </AppSelect>

    <div class="business-registration-form__group">
      <AppTextarea
        v-model="queVende"
        v-bind="queVendeAttrs"
        name="queVende"
        label="¿Qué vendes?"
        placeholder="Ej. Ropa, bolsas y accesorios"
        :rows="3"
        aria-describedby="registro-quevende-count"
        :disabled="loading"
        :error="errors.queVende"
      />
      <p
        id="registro-quevende-count"
        class="business-registration-form__hint"
        :class="{ 'business-registration-form__hint--over': queVende.length > QUE_VENDE_MAX }"
      >
        {{ queVende.length }} de {{ QUE_VENDE_MAX }}
      </p>
    </div>

    <AppInput
      v-model="dondeVende"
      v-bind="dondeVendeAttrs"
      name="dondeVende"
      label="¿Dónde vendes? (opcional)"
      placeholder="Ej. Tianguis de Acolman, o en línea"
      :disabled="loading"
      :error="errors.dondeVende"
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

    <div class="business-registration-form__group">
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
        Te mandamos un enlace para confirmarlo.
      </p>
    </div>

    <div class="business-registration-form__group">
      <AppInput
        v-model="telefono"
        v-bind="telefonoAttrs"
        name="telefono"
        type="tel"
        inputmode="tel"
        label="Número de WhatsApp"
        placeholder="Ej. 55 1234 5678"
        autocomplete="tel-national"
        aria-describedby="registro-telefono-hint"
        :disabled="loading"
        :error="errors.telefono"
      />
      <p
        id="registro-telefono-hint"
        class="business-registration-form__hint"
      >
        Por aquí te escribimos por WhatsApp para confirmar tus datos.
      </p>
    </div>

    <AppInput
      v-model="recomendadoPor"
      v-bind="recomendadoPorAttrs"
      name="recomendadoPor"
      label="¿Quién te recomendó? (opcional)"
      placeholder="Ej. Doña Luz"
      :disabled="loading"
      :error="errors.recomendadoPor"
    />

    <!-- Campo trampa: las personas no lo ven ni lo alcanzan con el teclado; los bots lo
         llenan. Su nombre no dice para qué sirve. -->
    <div
      class="business-registration-form__trap"
      aria-hidden="true"
    >
      <input
        v-model="trap"
        type="text"
        name="contacto_alterno"
        tabindex="-1"
        autocomplete="off"
      >
    </div>

    <div class="business-registration-form__legal">
      <LegalNoticeSummary />
      <AppCheckbox
        v-model="aceptaLegal"
        v-bind="aceptaLegalAttrs"
        name="aceptaLegal"
        :disabled="loading"
        :aria-invalid="errors.aceptaLegal ? 'true' : undefined"
        :aria-describedby="errors.aceptaLegal ? 'registro-legal-error' : undefined"
      >
        Leí el <RouterLink
          to="/privacidad"
          target="_blank"
          rel="noopener noreferrer"
        >Aviso de privacidad</RouterLink> y los <RouterLink
          to="/terminos"
          target="_blank"
          rel="noopener noreferrer"
        >Términos</RouterLink>
      </AppCheckbox>
      <p
        v-if="errors.aceptaLegal"
        id="registro-legal-error"
        class="business-registration-form__legal-error business-registration-form__error"
      >
        {{ errors.aceptaLegal }}
      </p>
    </div>

    <div class="business-registration-form__captcha">
      <TurnstileWidget
        ref="captchaEl"
        :site-key="siteKey"
        @verified="onVerified"
        @expired="onExpired"
        @failed="captchaFailed = true"
      />
      <p
        v-if="captchaMessage"
        ref="captchaErrorEl"
        class="business-registration-form__captcha-error"
        role="alert"
        tabindex="-1"
      >
        {{ captchaMessage }}
      </p>
    </div>

    <p
      v-if="!online"
      class="business-registration-form__offline"
      role="status"
    >
      Sin internet. Conéctate para enviar tu solicitud.
    </p>

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
// Organismo: agrupa moléculas (AppInput, AppSelect, AppTextarea, TurnstileWidget, ...) y
// validación de cliente. No hace ninguna llamada HTTP — solo emite `submit` con un payload
// validado.
//
// Modos de validación (deliberados, no simulados): cada campo se valida al salir de él
// (blur). Una vez que tiene error, se revalida mientras se escribe para que el mensaje
// desaparezca en cuanto se corrige. Tras el primer intento de envío, todos los campos se
// validan también al escribir.
import { computed, nextTick, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import AppInput from '@/components/ui/molecules/AppInput.vue'
import AppSelect from '@/components/ui/molecules/AppSelect.vue'
import AppTextarea from '@/components/ui/molecules/AppTextarea.vue'
import AppCheckbox from '@/components/ui/atoms/AppCheckbox.vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import LegalNoticeSummary from '@/components/ui/molecules/LegalNoticeSummary.vue'
import TurnstileWidget from '@/components/ui/molecules/TurnstileWidget.vue'
import { useOnlineStatus } from '@/composables/useOnlineStatus'
import { BUSINESS_TYPE_OPTIONS, businessRegistrationSchema } from '@/validation/business-registration.schema'
import { LEGAL_VERSION } from '@/legal/versions'
import type { BusinessRegistrationPayload } from '@/types/business-registration.types'

type FieldName =
  | 'nombreNegocio' | 'tipoNegocio' | 'queVende' | 'dondeVende' | 'nombre' | 'apellidos'
  | 'correo' | 'telefono' | 'recomendadoPor' | 'aceptaLegal'

const QUE_VENDE_MAX = 400
const CAPTCHA_MISSING = 'Completa la verificación de seguridad.'
const CAPTCHA_NOT_READY = 'La verificación de seguridad no está lista. Toca «Reintentar» o revisa tu internet.'

const props = withDefaults(defineProps<{
  /** Controlado por el padre mientras espera la respuesta real del backend */
  loading?: boolean
  /** Clave PÚBLICA de Cloudflare Turnstile (VITE_TURNSTILE_SITE_KEY) */
  siteKey?: string
}>(), {
  loading: false,
  siteKey: '',
})

const emit = defineEmits<{
  /** Se emite únicamente cuando la validación de cliente pasa y hay verificación de seguridad */
  submit: [payload: BusinessRegistrationPayload]
}>()

const formEl = ref<HTMLFormElement | null>(null)
const captchaEl = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const captchaErrorEl = ref<HTMLElement | null>(null)
const online = useOnlineStatus()

const { defineField, errors, handleSubmit, submitCount, setFieldError } = useForm({
  validationSchema: toTypedSchema(businessRegistrationSchema),
  initialValues: {
    nombreNegocio: '', tipoNegocio: '', queVende: '', dondeVende: '', nombre: '', apellidos: '',
    correo: '', telefono: '', recomendadoPor: '', aceptaLegal: false,
  } as never,
})

const fieldConfig = (state: { errors: string[] }) => ({
  validateOnBlur: true,
  validateOnChange: false,
  validateOnInput: false,
  validateOnModelUpdate: state.errors.length > 0 || submitCount.value > 0,
})
// La casilla no se valida al salir de ella (pasar de largo no es un error): solo al marcarla
// o desmarcarla, y solo después de un error o de un primer intento de envío.
const checkboxConfig = (state: { errors: string[] }) => ({
  validateOnBlur: false,
  validateOnChange: false,
  validateOnInput: false,
  validateOnModelUpdate: state.errors.length > 0 || submitCount.value > 0,
})

const [nombreNegocio, nombreNegocioAttrs] = defineField('nombreNegocio', fieldConfig)
const [tipoNegocio, tipoNegocioAttrs] = defineField('tipoNegocio', fieldConfig)
const [queVende, queVendeAttrs] = defineField('queVende', fieldConfig)
const [dondeVende, dondeVendeAttrs] = defineField('dondeVende', fieldConfig)
const [nombre, nombreAttrs] = defineField('nombre', fieldConfig)
const [apellidos, apellidosAttrs] = defineField('apellidos', fieldConfig)
const [correo, correoAttrs] = defineField('correo', fieldConfig)
const [telefono, telefonoAttrs] = defineField('telefono', fieldConfig)
const [recomendadoPor, recomendadoPorAttrs] = defineField('recomendadoPor', fieldConfig)
const [aceptaLegal, aceptaLegalAttrs] = defineField('aceptaLegal', checkboxConfig)

// Campo trampa (no pasa por el esquema: se manda tal cual)
const trap = ref('')

// ── Verificación de seguridad (Turnstile) ──
// El token es de UN solo uso: se borra al enviar (acierte o falle el servidor) y la persona
// vuelve a verificar. El aviso solo aparece tras un intento de envío, no antes.
const captchaToken = ref('')
const captchaFailed = ref(false)
const captchaTouched = ref(false)
const captchaMessage = computed(() => {
  if (!captchaTouched.value || captchaToken.value) return ''
  return captchaFailed.value ? CAPTCHA_NOT_READY : CAPTCHA_MISSING
})

function onVerified(token: string) {
  captchaToken.value = token
  captchaFailed.value = false
}
function onExpired() {
  captchaToken.value = ''
}
function resetCaptcha() {
  captchaToken.value = ''
  captchaEl.value?.reset()
}

// Evita el doble envío: el padre tarda un tick en poner `loading`, y la
// validación es asíncrona. `sent` bloquea hasta que el padre termina.
const sent = ref(false)
watch(() => props.loading, (now, before) => {
  if (before && !now) {
    sent.value = false
    resetCaptcha() // el token ya se gastó
  }
})

function focusFirstInvalid() {
  const invalid = formEl.value?.querySelector<HTMLElement>('[aria-invalid="true"]')
  if (invalid) invalid.focus()
  else captchaErrorEl.value?.focus()
}

const submit = handleSubmit(
  (values) => {
    if (props.loading || sent.value) return
    captchaTouched.value = true
    if (!captchaToken.value) {
      nextTick(focusFirstInvalid)
      return
    }
    sent.value = true
    emit('submit', {
      nombreNegocio: values.nombreNegocio,
      tipoNegocio: values.tipoNegocio,
      queVende: values.queVende,
      // Lo opcional en blanco no viaja: el contrato rechaza campos desconocidos y vacíos inútiles.
      ...(values.dondeVende ? { dondeVende: values.dondeVende } : {}),
      ...(values.recomendadoPor ? { recomendadoPor: values.recomendadoPor } : {}),
      nombre: values.nombre,
      apellidos: values.apellidos,
      correo: values.correo,
      telefono: values.telefono,
      aceptaLegal: true,
      versionLegal: LEGAL_VERSION,
      turnstileToken: captchaToken.value,
      sitioWebEmpresa: trap.value,
    })
  },
  () => {
    captchaTouched.value = true
    nextTick(focusFirstInvalid)
  },
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

defineExpose({ setFieldError: setServerFieldError, resetCaptcha })
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

.business-registration-form__group { display: flex; flex-direction: column; gap: var(--spacing-xs); }

.business-registration-form__hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
.business-registration-form__hint--over { color: var(--color-danger); font-weight: 600; }

/* Campo trampa: fuera de la pantalla (no display:none, que algunos bots detectan) */
.business-registration-form__trap {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.business-registration-form__legal { display: flex; flex-direction: column; gap: var(--spacing-sm); }
.business-registration-form__legal :deep(a) {
  color: var(--color-primary-hover);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.business-registration-form__legal :deep(a:focus-visible) {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
.business-registration-form__legal-error,
.business-registration-form__captcha-error {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}
.business-registration-form__captcha { display: flex; flex-direction: column; gap: var(--spacing-xs); }
.business-registration-form__captcha-error:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.business-registration-form__offline,
.business-registration-form__status {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-muted);
  text-align: center;
}

@media (min-width: 480px) {
  .business-registration-form__row { grid-template-columns: 1fr 1fr; }
}
</style>
