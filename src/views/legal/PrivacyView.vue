<template>
  <!-- Vista (contenedor): /privacidad. Solo conecta el texto del aviso con la plantilla. -->
  <LegalDocument
    :document="PRIVACY_NOTICE"
    :version="LEGAL_VERSION"
    :updated-label="updatedLabel"
  />
</template>

<script setup lang="ts">
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import { PRIVACY_NOTICE } from '@/legal/privacy-notice'
import { LEGAL_VERSION, formatLegalVersionDate } from '@/legal/versions'
import LegalDocument from '@/components/ui/organisms/LegalDocument.vue'

const updatedLabel = formatLegalVersionDate(LEGAL_VERSION)
useDocumentTitle(`${PRIVACY_NOTICE.title} · La Marchanta`)
</script>
