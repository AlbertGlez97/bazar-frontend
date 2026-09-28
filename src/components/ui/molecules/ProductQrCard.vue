<template>
  <!-- Molécula: el QR de un producto y su botón de descarga (PNG). El código se
       calcula aquí, en el navegador, a partir del id: no se guarda ni se pide al
       servidor. Un id que no es UUID no se dibuja (el escáner nunca lo reconocería). -->
  <section
    v-if="valid"
    class="product-qr-card"
    :aria-label="VOICE.qr.title"
  >
    <img
      v-if="dataUrl"
      class="product-qr-card__image"
      :src="dataUrl"
      :alt="VOICE.qr.imageAlt(productName)"
      width="160"
      height="160"
    >
    <p
      v-else-if="failed"
      class="product-qr-card__message"
      role="alert"
    >
      {{ VOICE.qr.generateError }}
    </p>
    <p
      v-else
      class="product-qr-card__message"
    >
      {{ VOICE.qr.generating }}
    </p>

    <div class="product-qr-card__side">
      <p class="product-qr-card__hint">
        {{ VOICE.qr.hint }}
      </p>
      <AppButton
        variant="secondary"
        :disabled="!dataUrl"
        :loading="downloading"
        @click="download"
      >
        {{ VOICE.qr.download }}
      </AppButton>
      <p
        v-if="downloadFailed"
        class="product-qr-card__message"
        role="alert"
      >
        {{ VOICE.qr.downloadError }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VOICE } from '@/config/voice'
import { isProductId, productQrBlob, productQrDataUrl, productQrFileName } from '@/utils/product-qr'
import { saveBlob } from '@/utils/report-files'
import AppButton from '../atoms/AppButton.vue'

const props = defineProps<{
  productId: string
  productName: string
}>()

const valid = computed(() => isProductId(props.productId))
const dataUrl = ref('')
const failed = ref(false)
const downloading = ref(false)
const downloadFailed = ref(false)

// Cada cambio de producto recalcula el código; una respuesta tardía de un id
// anterior se descarta (el token de la corrida decide cuál es la vigente).
let run = 0
watch(
  () => props.productId,
  async (id) => {
    const current = ++run
    dataUrl.value = ''
    failed.value = false
    downloadFailed.value = false
    if (!isProductId(id)) return
    try {
      const url = await productQrDataUrl(id)
      if (current === run) dataUrl.value = url
    } catch {
      if (current === run) failed.value = true
    }
  },
  { immediate: true },
)

async function download() {
  downloadFailed.value = false
  downloading.value = true
  try {
    saveBlob(await productQrBlob(props.productId), productQrFileName(props.productName, props.productId))
  } catch {
    downloadFailed.value = true
  } finally {
    downloading.value = false
  }
}
</script>

<style scoped>
.product-qr-card {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.product-qr-card__image {
  /* Blanco fijo (token): un QR sobre fondo oscuro no se lee. Nítido, sin suavizar. */
  background: var(--color-qr-paper);
  image-rendering: pixelated;
  width: 160px;
  height: 160px;
  max-width: 100%;
}
.product-qr-card__side {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-sm);
  flex: 1 1 10rem;
}
.product-qr-card__hint,
.product-qr-card__message {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
