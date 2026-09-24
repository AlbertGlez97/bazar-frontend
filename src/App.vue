<template>
  <RouterView />
  <AppToast />
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store'
import { AppToast } from '@/components'

// Restore local credentials only; server validation belongs to API integration.
useAuthStore()
</script>
