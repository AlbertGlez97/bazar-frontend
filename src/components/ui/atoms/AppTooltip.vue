<template>
  <!--
    AppTooltip — átomo indivisible (R27).
    Muestra un icono "i" con un bubble flotante al hover / focus / click.
    Accesible: role="tooltip", aria-describedby, Escape cierra, click afuera cierra.

    Posicionamiento: el placement vertical es preferido (prop) pero se invierte
    automáticamente si no cabe; el alineamiento horizontal arranca centrado y
    flippea a 'start' (bubble hacia la derecha del trigger) o 'end' (bubble
    hacia la izquierda) si se saldría del viewport. Esto evita que un tooltip
    quede recortado por contenedores con overflow:hidden (modales, etc.).
  -->
  <span
    ref="wrapperRef"
    class="tooltip-wrapper"
    :class="{ 'is-pinned': pinned }"
    @mouseenter="_scheduleRecompute"
    @focusin="_scheduleRecompute"
  >
    <button
      type="button"
      class="tooltip-trigger"
      :aria-label="ariaLabel || text"
      :aria-describedby="ttId"
      :aria-expanded="pinned"
      @click.stop="toggle"
    >
      <!-- Icono "i" inline para mantener el átomo autocontenido -->
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="2"
        />
        <path
          d="M12 8h.01"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
        />
        <path
          d="M11 12h1v5h1"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <span
      :id="ttId"
      ref="bubbleRef"
      role="tooltip"
      class="tooltip-bubble"
      :class="[
        `tooltip-bubble--${actualPlacement}`,
        `tooltip-bubble--align-${actualAlign}`,
      ]"
    >
      {{ text }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'

interface Props {
  text: string
  ariaLabel?: string
  placement?: 'top' | 'bottom'
}
const props = withDefaults(defineProps<Props>(), {
  ariaLabel: undefined,
  placement: 'top',
})

// ID único por instancia para vincular el bubble con aria-describedby (a11y)
const ttId = `tt-${Math.random().toString(36).slice(2, 9)}`

// pinned = visible tras click, persiste hasta cerrar con click afuera o Escape.
// El hover/focus también lo muestran (vía CSS), pero pinned asegura persistencia.
const pinned = ref(false)

// ── Refs DOM + posicionamiento dinámico ─────────────────────────────────
const wrapperRef = ref<HTMLElement | null>(null)
const bubbleRef  = ref<HTMLElement | null>(null)
// Placement/align efectivos — pueden flippear respecto al placement preferido.
const actualPlacement = ref<'top' | 'bottom'>(props.placement)
const actualAlign     = ref<'center' | 'start' | 'end'>('center')

/**
 * Encuentra el primer ancestro que RECORTA visualmente al elemento — esto
 * es: cualquier elemento con overflow ≠ visible (hidden, auto, scroll). Es
 * el área real contra la que tenemos que medir, no el viewport: un modal
 * con overflow:hidden recorta tooltips aunque el viewport tenga sobra.
 *
 * Si no hay ningún ancestro recortante, devolvemos el rect del viewport.
 */
function _getClippingRect(el: HTMLElement): { left: number, right: number, top: number, bottom: number } {
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

/**
 * Mide la posición del trigger contra su contenedor recortante y decide
 * si flippear vertical y/u horizontalmente para que el bubble no quede
 * recortado. Se llama al primer mouseenter/focusin/click — NO en cada
 * paint, así no generamos layout thrash.
 */
function _recompute() {
  const wrapper = wrapperRef.value
  const bubble  = bubbleRef.value
  if (!wrapper || !bubble) return

  const wrapperRect = wrapper.getBoundingClientRect()
  // offsetWidth/offsetHeight reportan dimensiones aunque el bubble esté
  // opacity:0 (CSS de hover) — display sigue siendo inline. No necesitamos
  // forzar visibilidad temporal.
  const bw = bubble.offsetWidth
  const bh = bubble.offsetHeight

  const triggerCx = wrapperRect.left + wrapperRect.width / 2
  const clip      = _getClippingRect(wrapper)
  const margin    = 8                     // colchón mínimo contra el borde

  // ── Horizontal ────────────────────────────────────────────────────
  // Centro = trigger. Si la mitad del bubble se sale por el lado izquierdo
  // del contenedor recortante, alineamos al inicio (bubble crece hacia la
  // derecha). Si se sale por el lado derecho, alineamos al final.
  const half = bw / 2
  if (triggerCx - half < clip.left + margin) {
    actualAlign.value = 'start'
  } else if (triggerCx + half > clip.right - margin) {
    actualAlign.value = 'end'
  } else {
    actualAlign.value = 'center'
  }

  // ── Vertical ──────────────────────────────────────────────────────
  // Empezamos del placement preferido y flippeamos solo si no cabe dentro
  // del contenedor recortante.
  if (props.placement === 'top') {
    actualPlacement.value = (wrapperRect.top - bh - margin < clip.top) ? 'bottom' : 'top'
  } else {
    actualPlacement.value = (wrapperRect.bottom + bh + margin > clip.bottom) ? 'top' : 'bottom'
  }
}

function _scheduleRecompute() {
  // rAF garantiza que el layout está estable cuando medimos (evita lecturas
  // forzadas a mitad de un mouseenter durante animaciones).
  requestAnimationFrame(_recompute)
}

function toggle() {
  pinned.value = !pinned.value
  if (pinned.value) {
    _scheduleRecompute()
    _bindGlobalClosers()
  } else {
    _unbindGlobalClosers()
  }
}

function _onClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  // Si el click cae dentro de ESTE wrapper, lo dejamos pasar (no cerrar)
  if (target?.closest('.tooltip-wrapper.is-pinned')) return
  pinned.value = false
  _unbindGlobalClosers()
}

function _onEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    pinned.value = false
    _unbindGlobalClosers()
  }
}

function _bindGlobalClosers() {
  // setTimeout para evitar que el mismo click que abre cierre el tooltip
  setTimeout(() => {
    document.addEventListener('click', _onClickOutside)
    document.addEventListener('keydown', _onEscape)
  }, 0)
}

function _unbindGlobalClosers() {
  document.removeEventListener('click', _onClickOutside)
  document.removeEventListener('keydown', _onEscape)
}

// Cleanup defensivo si el componente se desmonta con el tooltip abierto
onBeforeUnmount(_unbindGlobalClosers)

// Usamos props para evitar warning de TS sobre props no leídos
void props
</script>

<style scoped>
/* ── Wrapper posicional ───────────────────────────────────────────────── */
.tooltip-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  vertical-align: middle;
  line-height: 1;
}

/* ── Icono disparador ─────────────────────────────────────────────────── */
.tooltip-trigger {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;                              /* 24px — visual */
  height: 1.5rem;
  border-radius: 50%;
  background: rgba(37, 99, 235, .12);
  color: var(--color-primary);
  cursor: pointer;
  transition: background .15s ease, color .15s ease, transform .15s ease;
  position: relative;
}
/* Hit area extendida a 44×44px sin cambiar el tamaño visual (Apple HIG) */
.tooltip-trigger::before {
  content: '';
  position: absolute;
  inset: -0.625rem;                           /* -10px en cada lado */
  min-width:  2.75rem;
  min-height: 2.75rem;
  border-radius: 50%;
}
.tooltip-trigger:hover,
.tooltip-trigger:focus-visible {
  background: var(--color-primary);
  color: #fff;
  outline: none;
  transform: scale(1.1);
}

/* ── Bubble flotante ──────────────────────────────────────────────────── */
/* La posición horizontal la define la modificadora --align-{center|start|end}.
   El centrado por translateX(-50%) ya NO se aplica acá: estaba acoplado al
   modo 'center' y rompía el align-end (sobre todo dentro de un modal con
   overflow). Ahora cada align controla su propio offset y la flecha también
   se alinea al lado correcto del bubble. */
.tooltip-bubble {
  position: absolute;
  width: max-content;
  max-width: 280px;
  padding: 8px 12px;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .2);
  font-size: 0.8rem;
  font-weight: 400;
  line-height: 1.45;
  letter-spacing: normal;
  text-transform: none;
  text-align: left;
  white-space: normal;
  opacity: 0;
  pointer-events: none;
  z-index: 100;
  transition: opacity .15s ease, transform .15s ease;
}

/* ── Alineamiento horizontal (con flip automático en el script) ────────── */
/* center: bubble centrado sobre el trigger — caso por defecto. */
.tooltip-bubble--align-center {
  left: 50%;
  transform: translateX(-50%);
}
/* start: bubble alineado al borde IZQUIERDO del trigger (crece a la derecha). */
.tooltip-bubble--align-start {
  left: 0;
  right: auto;
}
/* end: bubble alineado al borde DERECHO del trigger (crece a la izquierda). */
.tooltip-bubble--align-end {
  right: 0;
  left: auto;
}

/* ── Placement vertical (también con flip automático) ──────────────────── */
.tooltip-bubble--top    { bottom: calc(100% + 8px); }
.tooltip-bubble--bottom { top:    calc(100% + 8px); }

/* Flecha — se posiciona según placement vertical Y align horizontal. La
   flecha apunta al trigger, así que cuando el bubble está align-end (a la
   izquierda del trigger) la flecha va al borde derecho del bubble, etc. */
.tooltip-bubble::after {
  content: '';
  position: absolute;
  border: 6px solid transparent;
}
/* Vertical de la flecha según placement */
.tooltip-bubble--top::after    { top:    100%; border-top-color:    var(--color-border); }
.tooltip-bubble--bottom::after { bottom: 100%; border-bottom-color: var(--color-border); }
/* Horizontal de la flecha según align */
.tooltip-bubble--align-center::after {
  left: 50%;
  transform: translateX(-50%);
}
.tooltip-bubble--align-start::after {
  /* trigger ~24px de ancho — la flecha cae sobre el centro del trigger */
  left: 12px;
}
.tooltip-bubble--align-end::after {
  right: 12px;
}

/* Mostrar: hover, focus dentro del wrapper, o pinned por click */
.tooltip-wrapper:hover .tooltip-bubble,
.tooltip-wrapper:focus-within .tooltip-bubble,
.tooltip-wrapper.is-pinned .tooltip-bubble {
  opacity: 1;
  pointer-events: auto;
}

/* En móviles angostos, el bubble no debe salirse de la pantalla */
@media (max-width: 480px) {
  .tooltip-bubble {
    max-width: 220px;
    font-size: 0.75rem;
  }
}
</style>
