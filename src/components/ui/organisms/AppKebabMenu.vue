<template>
  <!--
    AppKebabMenu — organismo. Botón "⋮" que despliega un menú de acciones.

    Reutiliza la lógica de auto-flip contra el primer ancestro recortante
    (overflow != visible) que ya validamos en AppTooltip — así el menú nunca
    queda cortado por un modal, una tabla con overflow:auto o un card.

    Props:
      options: Array<{ label, icon, action, variant?: 'default' | 'danger' }>

    A11y:
      - role="menu" en el dropdown, role="menuitem" en cada opción
      - aria-haspopup, aria-expanded en el trigger
      - Escape cierra; click afuera cierra
  -->
  <div
    ref="rootRef"
    class="kebab"
    :class="{ 'kebab--open': open }"
  >
    <button
      type="button"
      class="kebab__trigger"
      :aria-haspopup="'menu'"
      :aria-expanded="open"
      :aria-label="ariaLabel"
      @click.stop="toggle"
    >
      <!-- Tres puntos verticales — más sobrio que el horizontal '···' y
           menos invasivo visualmente entre badges/acciones del card. -->
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="5"
          r="1.6"
          fill="currentColor"
        />
        <circle
          cx="12"
          cy="12"
          r="1.6"
          fill="currentColor"
        />
        <circle
          cx="12"
          cy="19"
          r="1.6"
          fill="currentColor"
        />
      </svg>
    </button>

    <ul
      v-if="open"
      ref="menuRef"
      role="menu"
      class="kebab__menu"
      :class="[
        `kebab__menu--${placement}`,
        `kebab__menu--align-${align}`,
      ]"
    >
      <li
        v-for="(opt, i) in options"
        :key="i"
        role="menuitem"
        class="kebab__item"
        :class="{ 'kebab__item--danger': opt.variant === 'danger' }"
        @click.stop="select(opt)"
      >
        <span
          v-if="opt.icon"
          class="kebab__icon"
        >{{ opt.icon }}</span>
        <span class="kebab__label">{{ opt.label }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onBeforeUnmount } from 'vue'

export interface KebabOption {
  label:    string
  icon?:    string
  action:   () => void
  variant?: 'default' | 'danger'
}

interface Props {
  options:    KebabOption[]
  ariaLabel?: string
}
withDefaults(defineProps<Props>(), {
  ariaLabel: 'Acciones',
})

// ── Estado interno ─────────────────────────────────────────────────────
const open      = ref(false)
const placement = ref<'down' | 'up'>('down')
const align     = ref<'start' | 'end'>('end')   // por convención: alineado al borde derecho del trigger

const rootRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)

// ── Auto-posicionamiento ───────────────────────────────────────────────
/**
 * Sube por la cadena de ancestros buscando el primer elemento que recorte
 * con overflow ≠ visible. Esa es el área real contra la que medimos para
 * decidir si flippear. Si no hay nada recortante, caemos al viewport.
 *
 * Mismo patrón que en AppTooltip — mantenemos el comportamiento consistente
 * en todo el sistema.
 */
function _getClippingRect(el: HTMLElement) {
  let parent: HTMLElement | null = el.parentElement
  while (parent && parent !== document.body) {
    const cs = getComputedStyle(parent)
    if (/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) {
      const r = parent.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    }
    parent = parent.parentElement
  }
  return { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight }
}

/** Decide placement/align según el espacio real disponible. */
function _recompute() {
  const root = rootRef.value
  const menu = menuRef.value
  if (!root || !menu) return

  const triggerRect = root.getBoundingClientRect()
  const mw          = menu.offsetWidth
  const mh          = menu.offsetHeight
  const clip        = _getClippingRect(root)
  const margin      = 8

  // Vertical: preferimos abajo (UX estándar) y subimos solo si no cabe.
  placement.value = (triggerRect.bottom + mh + margin > clip.bottom)
    ? 'up'
    : 'down'

  // Horizontal: arrancamos alineados al borde derecho del trigger; si así
  // se saldría por la izquierda del contenedor, alineamos a la izquierda.
  const wouldClipLeft = triggerRect.right - mw < clip.left + margin
  align.value = wouldClipLeft ? 'start' : 'end'
}

// ── Apertura / cierre ──────────────────────────────────────────────────
function toggle() {
  if (open.value) {
    close()
  } else {
    openMenu()
  }
}

async function openMenu() {
  open.value = true
  // Esperamos a que el dropdown esté en el DOM para medirlo.
  await nextTick()
  _recompute()
  _bindGlobalClosers()
}

function close() {
  if (!open.value) return
  open.value = false
  _unbindGlobalClosers()
}

function select(opt: KebabOption) {
  // Cerramos ANTES de ejecutar — así el callback puede abrir un modal sin
  // que el menú quede flotando por encima.
  close()
  opt.action()
}

// ── Cerradores globales ────────────────────────────────────────────────
function _onClickOutside(event: MouseEvent) {
  const root = rootRef.value
  if (!root) return
  if (root.contains(event.target as Node)) return
  close()
}

function _onEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

function _bindGlobalClosers() {
  // setTimeout para evitar que el mismo click que abre el menú lo cierre.
  setTimeout(() => {
    document.addEventListener('click', _onClickOutside)
    document.addEventListener('keydown', _onEscape)
  }, 0)
}

function _unbindGlobalClosers() {
  document.removeEventListener('click', _onClickOutside)
  document.removeEventListener('keydown', _onEscape)
}

// Cleanup defensivo si el componente se desmonta con el menú abierto.
onBeforeUnmount(_unbindGlobalClosers)
</script>

<style scoped>
/* ── Wrapper posicional ───────────────────────────────────────────────── */
.kebab {
  position: relative;
  display: inline-flex;
}

/* ── Trigger ⋮ — discreto, neutro, no compite con acciones primarias ─── */
.kebab__trigger {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm, 6px);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background .15s ease, color .15s ease;
}
.kebab__trigger:hover,
.kebab__trigger:focus-visible {
  background: var(--color-bg);
  color: var(--color-text);
  outline: none;
}
.kebab--open .kebab__trigger {
  background: var(--color-bg);
  color: var(--color-text);
}

/* ── Dropdown ──────────────────────────────────────────────────────────
   Coherente con AppModal: surface + border sutil + sombra ligera. */
.kebab__menu {
  position: absolute;
  z-index: 200;
  min-width: 160px;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius, 8px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .18);
  font-size: 0.85rem;
}

/* Placement vertical (auto-flip) */
.kebab__menu--down { top:    calc(100% + 6px); }
.kebab__menu--up   { bottom: calc(100% + 6px); }

/* Alineamiento horizontal (auto-flip) */
.kebab__menu--align-end   { right: 0; left: auto; }
.kebab__menu--align-start { left:  0; right: auto; }

/* ── Items ────────────────────────────────────────────────────────────── */
.kebab__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--radius-sm, 6px);
  color: var(--color-text);
  cursor: pointer;
  user-select: none;
  transition: background .12s ease, color .12s ease;
  white-space: nowrap;
}
.kebab__item:hover,
.kebab__item:focus-visible {
  background: var(--color-bg);
  outline: none;
}

.kebab__icon {
  font-size: 0.95rem;
  line-height: 1;
  width: 18px;
  display: inline-flex;
  justify-content: center;
}
.kebab__label { flex: 1; }

/* ── Variante danger ──────────────────────────────────────────────────── */
.kebab__item--danger        { color: var(--color-danger); }
.kebab__item--danger:hover  { background: rgba(239, 68, 68, .08); }
</style>
