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
export { default as AppImageUpload } from './ui/atoms/AppImageUpload.vue'
export { default as BrandLogo   } from './ui/atoms/BrandLogo.vue'
export { default as QuantityStepper } from './ui/atoms/QuantityStepper.vue'

// ── MOLÉCULAS — combinación de átomos, responsabilidad única ─────────
export { default as AppAlert            } from './ui/molecules/AppAlert.vue'
export { default as AppToast            } from './ui/molecules/AppToast.vue'
export { default as AppPagination       } from './ui/molecules/AppPagination.vue'
export { default as InstallAppButton    } from './ui/molecules/InstallAppButton.vue'
export { default as FeatureCard         } from './ui/molecules/FeatureCard.vue'
export { default as BusinessRegistrationForm } from './ui/molecules/BusinessRegistrationForm.vue'
export { default as DeviceIdentifyForm } from './ui/molecules/DeviceIdentifyForm.vue'
export { default as MemberSelector      } from './ui/molecules/MemberSelector.vue'
export { default as ProductCard         } from './ui/molecules/ProductCard.vue'
export { default as ProductForm         } from './ui/molecules/ProductForm.vue'
export { default as CartLineItem        } from './ui/molecules/CartLineItem.vue'
export { default as CartSummary         } from './ui/molecules/CartSummary.vue'
export { default as CashInput          } from './ui/molecules/CashInput.vue'
export { default as CategoryQuickFilter } from './ui/molecules/CategoryQuickFilter.vue'

// ── ORGANISMOS — secciones complejas con lógica propia ───────────────
export { default as AppModal        } from './ui/organisms/AppModal.vue'
export { default as AppCard         } from './ui/organisms/AppCard.vue'
export { default as AppKebabMenu    } from './ui/organisms/AppKebabMenu.vue'
export { default as LandingHero     } from './ui/organisms/LandingHero.vue'
export { default as FeaturesSection } from './ui/organisms/FeaturesSection.vue'
export { default as AudienceSection } from './ui/organisms/AudienceSection.vue'
export { default as LandingStory    } from './ui/organisms/LandingStory.vue'
export { default as HowItWorksSection } from './ui/organisms/HowItWorksSection.vue'
export { default as LandingCta      } from './ui/organisms/LandingCta.vue'
export { default as ProductCatalogGrid } from './ui/organisms/ProductCatalogGrid.vue'
export { default as ProductFormModal   } from './ui/organisms/ProductFormModal.vue'
export { default as UiModeSwitch       } from './ui/organisms/UiModeSwitch.vue'
export { default as QrScannerModal     } from './ui/organisms/QrScannerModal.vue'
export { default as SaleCart           } from './ui/organisms/SaleCart.vue'
export { default as SaleCatalogPicker  } from './ui/organisms/SaleCatalogPicker.vue'
export { default as SaleResult         } from './ui/organisms/SaleResult.vue'
export { default as SyncStatusIndicator } from './ui/organisms/SyncStatusIndicator.vue'
