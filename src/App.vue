<template>
  <RouterView />
  <AppToast />
  <PwaUpdatePrompt />
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store'
import { AppToast } from '@/components'
import PwaUpdatePrompt from '@/components/ui/molecules/PwaUpdatePrompt.vue'

// Restore local credentials only; server validation belongs to API integration.
useAuthStore()
</script>
