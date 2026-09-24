/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║       SISTEMA DE DISEÑO — ATOMIC DESIGN HIERARCHY                   ║
 * ║       Barrel Export centralizado · Uso: @/components                ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                      ║
 * ║  ▸ REGLAS DE ORO                                                     ║
 * ║  ─────────────────────────────────────────────────────────────────  ║
 * ║  1. ÁTOMOS  (ui/atoms/)                                              ║
 * ║     → Componentes mínimos, indivisibles, sin lógica de negocio.      ║
 * ║     → Solo reciben props y emiten eventos básicos.                   ║
 * ║     → No importan otros componentes del sistema.                     ║
 * ║     → Ejemplos: AppButton, AppInput, AppBadge, AppSelect             ║
 * ║                                                                      ║
 * ║  2. MOLÉCULAS  (ui/molecules/)                                       ║
 * ║     → Combinación simple de átomos con una única responsabilidad.    ║
 * ║     → Pueden tener lógica local mínima (estado interno simple).      ║
 * ║     → No importan organismos ni hacen llamadas externas.             ║
 * ║     → Ejemplos: AppAlert, AppToast, AppPagination                    ║
 * ║                                                                      ║
 * ║  3. ORGANISMOS  (ui/organisms/)                                      ║
 * ║     → Componentes complejos que combinan átomos y/o moléculas.       ║
 * ║     → Pueden usar composables, Teleport, watchers y efectos.         ║
 * ║     → Representan secciones de UI con lógica propia.                 ║
 * ║     → Ejemplos: AppModal (Teleport + scroll lock + Escape key),      ║
 * ║                 AppCard  (layout estructurado con slots nombrados)    ║
 * ║                                                                      ║
 * ║  ─────────────────────────────────────────────────────────────────  ║
 * ║  ⚠  PROHIBIDO                                                        ║
 * ║     · Un átomo NO puede importar moléculas ni organismos.            ║
 * ║     · Una molécula NO puede importar organismos.                     ║
 * ║     · Ningún componente de ui/ accede a stores ni hace fetch.        ║
 * ║     · No crear componentes de dominio aquí (eso va en views/).       ║
 * ║                                                                      ║
 * ║  ✔  IMPORTAR SIEMPRE desde el barrel:                               ║
 * ║     import { AppButton, AppModal } from '@/components'               ║
 * ║     NUNCA importar rutas internas directamente.                      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// ── ÁTOMOS — indivisibles, sin lógica de negocio ─────────────────────
export { default as AppButton   } from './ui/atoms/AppButton.vue'
export { default as AppInput    } from './ui/atoms/AppInput.vue'
export { default as AppBadge    } from './ui/atoms/AppBadge.vue'
export { default as AppSelect   } from './ui/atoms/AppSelect.vue'
export { default as AppCheckbox } from './ui/atoms/AppCheckbox.vue'
export { default as AppSwitch   } from './ui/atoms/AppSwitch.vue'
export { default as AppProgress } from './ui/atoms/AppProgress.vue'
export { default as AppAvatar   } from './ui/atoms/AppAvatar.vue'
export { default as AppSkeleton } from './ui/atoms/AppSkeleton.vue'
export { default as AppTooltip  } from './ui/atoms/AppTooltip.vue'
export { default as AppTextarea } from './ui/atoms/AppTextarea.vue'

// ── MOLÉCULAS — combinación de átomos, responsabilidad única ─────────
export { default as AppAlert            } from './ui/molecules/AppAlert.vue'
export { default as AppToast            } from './ui/molecules/AppToast.vue'
export { default as AppPagination       } from './ui/molecules/AppPagination.vue'
export { default as InstallAppButton    } from './ui/molecules/InstallAppButton.vue'
export { default as FeatureCard         } from './ui/molecules/FeatureCard.vue'
export { default as ContactForm         } from './ui/molecules/ContactForm.vue'

// ── ORGANISMOS — secciones complejas con lógica propia ───────────────
export { default as AppModal        } from './ui/organisms/AppModal.vue'
export { default as AppCard         } from './ui/organisms/AppCard.vue'
export { default as AppKebabMenu    } from './ui/organisms/AppKebabMenu.vue'
export { default as LandingHero     } from './ui/organisms/LandingHero.vue'
export { default as FeaturesSection } from './ui/organisms/FeaturesSection.vue'
export { default as ContactSection  } from './ui/organisms/ContactSection.vue'
