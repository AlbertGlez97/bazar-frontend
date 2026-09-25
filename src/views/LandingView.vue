<template>
  <!-- Vista: Landing pública — solo ensambla organismos, sin lógica propia.
       Logo, toldo y pie los pone PublicLayout. -->
  <div class="landing-view">
    <LandingHero />
    <FeaturesSection />
    <AudienceSection />
    <LandingStory />
    <HowItWorksSection />
    <LandingCta />
  </div>
</template>

<script setup lang="ts">
import {
  LandingHero,
  FeaturesSection,
  AudienceSection,
  LandingStory,
  HowItWorksSection,
  LandingCta,
} from '@/components'
</script>

<style scoped>
.landing-view { display: flex; flex-direction: column; }
</style>
