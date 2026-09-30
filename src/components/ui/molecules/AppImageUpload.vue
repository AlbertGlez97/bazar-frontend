<template>
  <!-- Molécula: input de archivo con preview y validación de tipo/tamaño en
       cliente. Solo valida y emite `update:modelValue` con el File elegido
       (o null); NO sube nada — eso es responsabilidad de quien la use. -->
  <div class="app-image-upload">
    <label
      v-if="label"
      class="app-image-upload__label"
    >{{ label }}</label>

    <div
      v-if="previewSrc"
      class="app-image-upload__preview"
    >
      <img
        :src="previewSrc"
        alt="Vista previa"
        class="app-image-upload__img"
      >
    </div>

    <input
      ref="inputRef"
      type="file"
      class="app-image-upload__input"
      :accept="accept"
      :disabled="disabled"
      @change="handleChange"
    >

    <p
      v-if="localError"
      class="app-image-upload__error"
    >
      {{ localError }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

const props = withDefaults(defineProps<{
  label?: string
  disabled?: boolean
  /** URL ya existente (ej. editando un producto que ya tiene imagen) */
  existingImageUrl?: string | null
  /** 5 MiB por defecto — mismo límite que valida el backend */
  maxSizeBytes?: number
  accept?: string
}>(), {
  label: undefined,
  disabled: false,
  existingImageUrl: null,
  maxSizeBytes: 5 * 1024 * 1024,
  accept: 'image/png,image/jpeg,image/webp',
})

const emit = defineEmits<{
  'update:modelValue': [file: File | null]
}>()

// Debe coincidir con lo que el backend realmente acepta y decodifica —
// ACCEPTED_IMAGE_MIME_TYPES en bazar-api/src/storage/storage.service.ts
// (ver también doc/api-contract-for-frontend.md, endpoint
// POST /products/:id/image) — porque el servidor, no el cliente, es la
// fuente de verdad de qué formatos puede procesar sharp. Si esa lista
// cambia en el backend, actualizar esta también.
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

// Firmas típicas de HEIC/HEIF (foto "alta eficiencia" por defecto en
// celulares/tablets modernos). Muchos navegadores no reconocen su MIME
// type y reportan file.type === '', así que también miramos la
// extensión del nombre de archivo para poder dar un mensaje específico
// en vez del genérico "formato no soportado".
const HEIC_TYPES = ['image/heic', 'image/heif']
const HEIC_EXTENSION = /\.(heic|heif)$/i

function isHeic(file: File) {
  return HEIC_TYPES.includes(file.type) || HEIC_EXTENSION.test(file.name)
}

const inputRef = ref<HTMLInputElement | null>(null)
const localError = ref('')
const objectUrl = ref<string | null>(null)

// Mientras no se elija un archivo nuevo, muestra la imagen ya existente
// (útil al editar un producto que ya tiene imagen subida).
const previewSrc = computed(() => objectUrl.value ?? props.existingImageUrl)

function resetSelection() {
  if (inputRef.value) inputRef.value.value = ''
  emit('update:modelValue', null)
}

function handleChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  localError.value = ''

  if (!file) {
    emit('update:modelValue', null)
    return
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    localError.value = isHeic(file)
      ? 'Las fotos HEIC/HEIF no son compatibles. Expórtala o compártela como JPG, PNG o WebP antes de subirla.'
      : 'Solo aceptamos imágenes PNG, JPEG o WebP.'
    resetSelection()
    return
  }

  if (file.size > props.maxSizeBytes) {
    localError.value = 'La imagen pesa más de 5 MB. Prueba con una más ligera.'
    resetSelection()
    return
  }

  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = URL.createObjectURL(file)
  emit('update:modelValue', file)
}

onBeforeUnmount(() => {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
})
</script>

<style scoped>
.app-image-upload {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.app-image-upload__label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-muted);
}
.app-image-upload__preview {
  width: 8rem;
  height: 8rem;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
}
.app-image-upload__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.app-image-upload__input {
  font-size: var(--font-size-sm);
  color: var(--color-text);
}
.app-image-upload__error {
  font-size: 0.8125rem;
  color: var(--color-danger);
  margin: 0;
}
</style>
