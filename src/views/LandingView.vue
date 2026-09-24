<template>
  <!-- Vista: Landing pública — solo ensambla organismos, sin lógica propia -->
  <div class="landing-view">
    <LandingHero />
    <FeaturesSection />
    <ContactSection />
  </div>
</template>

<script setup lang="ts">
import { LandingHero, FeaturesSection, ContactSection } from '@/components'
</script>

<style scoped>
.landing-view { display: flex; flex-direction: column; }
</style>
