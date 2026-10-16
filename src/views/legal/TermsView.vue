<template>
  <!-- Vista (contenedor): /terminos. Solo conecta el texto de los términos con la plantilla. -->
  <LegalDocument
    :document="TERMS"
    :version="LEGAL_VERSION"
    :updated-label="updatedLabel"
  />
</template>

<script setup lang="ts">
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import { TERMS } from '@/legal/terms'
import { LEGAL_VERSION, formatLegalVersionDate } from '@/legal/versions'
import LegalDocument from '@/components/ui/organisms/LegalDocument.vue'

const updatedLabel = formatLegalVersionDate(LEGAL_VERSION)
useDocumentTitle(`${TERMS.title} · La Marchanta`)
</script>
