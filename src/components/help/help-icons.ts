import { ClipboardList, HandCoins, Package, Rocket, ShoppingCart, Smartphone, Wallet, WifiOff } from '@lucide/vue'
import type { Component } from 'vue'

/** One small icon per help category; categories not listed simply show none. */
export const HELP_CATEGORY_ICONS: Readonly<Record<string, Component>> = {
  'primeros-pasos': Rocket,
  ventas: ShoppingCart,
  productos: Package,
  deudas: HandCoins,
  finanzas: Wallet,
  administracion: ClipboardList,
  'dispositivos-sesion': Smartphone,
  offline: WifiOff,
}
