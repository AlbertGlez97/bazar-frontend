<template>
  <!-- Enlace real a una ubicación de la ayuda. No usa el RouterLink "normal" porque este
       marca aria-current="page" en todo enlace a la misma ruta (la ayuda vive en una sola
       ruta y cambia por query): aquí aria-current lo decide quien llama. -->
  <RouterLink
    v-slot="{ href, navigate }"
    :to="to"
    custom
  >
    <a
      v-bind="$attrs"
      :href="href"
      @click="navigate"
    >
      <slot />
    </a>
  </RouterLink>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineOptions({ inheritAttrs: false })
defineProps<{ to: RouteLocationRaw }>()
</script>
