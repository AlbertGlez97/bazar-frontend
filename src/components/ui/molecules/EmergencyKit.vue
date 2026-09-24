<template>
  <!--
    EmergencyKit — molécula que muestra la frase de recuperación de 12 palabras.
    Uso: en el paso 2 del wizard de registro y (futuro) en una vista
    de "re-descargar Kit" desde settings.

    Render responsabilidad:
      - Grilla numerada 3×4 de palabras.
      - Botón "Descargar Kit PDF" → genera un PDF con pdfmake (lazy import).
      - Bloque de advertencias sobre cómo guardar la frase.
  -->
  <div class="emergency-kit" :class="{ 'emergency-kit--printable': printable }">
    <div class="emergency-kit__header">
      <span class="emergency-kit__icon">🔐</span>
      <div>
        <h2 class="emergency-kit__title">Kit de Emergencia</h2>
        <p class="emergency-kit__subtitle">
          Estas 12 palabras son la ÚNICA forma de recuperar tu cuenta si olvidas la contraseña.
        </p>
      </div>
    </div>

    <!-- Grilla de palabras -->
    <ol class="emergency-kit__grid">
      <li
        v-for="(word, i) in phrase"
        :key="i"
        class="emergency-kit__word"
      >
        <span class="emergency-kit__num">{{ i + 1 }}</span>
        <span class="emergency-kit__text">{{ word }}</span>
      </li>
    </ol>

    <!-- Advertencias -->
    <div class="emergency-kit__warnings">
      <div class="emergency-kit__warning">
        <span>✅</span> <span>Guárdala en papel en un lugar físico seguro.</span>
      </div>
      <div class="emergency-kit__warning">
        <span>✅</span> <span>Si usas un gestor de contraseñas, puedes guardarla ahí.</span>
      </div>
      <div class="emergency-kit__warning emergency-kit__warning--danger">
        <span>❌</span> <span>NO la guardes en un archivo sin cifrar en tu computadora.</span>
      </div>
      <div class="emergency-kit__warning emergency-kit__warning--danger">
        <span>❌</span> <span>NO la envíes por email, WhatsApp ni la fotografíes en la nube.</span>
      </div>
      <div class="emergency-kit__warning emergency-kit__warning--danger">
        <span>⚠️</span> <span>Si alguien obtiene esta frase, puede acceder a toda tu cuenta.</span>
      </div>
    </div>

    <!-- Botón de descarga del PDF -->
    <div class="emergency-kit__actions" v-if="showPrintButton">
      <AppButton
        variant="secondary"
        size="md"
        block
        @click="downloadAsPdf"
      >
        ⬇️ Descargar Kit PDF
      </AppButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AppButton } from '@/components'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'

interface Props {
  phrase: string[]
  email:  string
  /** Si true, muestra el botón descargar PDF. Default: true. */
  showPrintButton?: boolean
  /** Si true, aplica estilos de página completa (uso en vista de re-descarga). */
  printable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showPrintButton: true,
  printable:       false,
})

/**
 * Genera y descarga el Kit de Emergencia como PDF profesional usando pdfmake.
 *
 * Lazy import: pdfmake pesa ~700KB; se carga sólo cuando el usuario hace clic
 * en el botón. Esto mantiene chico el bundle inicial y mejora el TTI.
 */
async function downloadAsPdf(): Promise<void> {
  const [pdfModule, fontsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ])
  // Distintos bundlers exponen el default de formas distintas — soportamos ambos
  const pdfMake: any = (pdfModule as any).default ?? pdfModule

  // ── Resolución robusta del VFS de pdfmake ─────────────────────────────
  // pdfmake 0.3.x es CommonJS y registraba las fuentes mutando un global.
  // Bajo Vite + ESM ese efecto secundario NO se aplica, así que probamos
  // todas las rutas posibles del módulo importado en orden de especificidad
  // y nos quedamos con la primera que contenga archivos .ttf.
  const fontsRaw: any = fontsModule
  const hasTtfs = (v: any): boolean =>
    !!v && typeof v === 'object' && Object.keys(v).some((k) => k.endsWith('.ttf'))

  const vfs: Record<string, string> | null =
       (fontsRaw?.default?.pdfMake?.vfs as Record<string, string> | undefined)
    ?? (fontsRaw?.pdfMake?.vfs         as Record<string, string> | undefined)
    ?? (fontsRaw?.default?.vfs         as Record<string, string> | undefined)
    ?? (fontsRaw?.vfs                  as Record<string, string> | undefined)
    // 0.3.x con dynamic import: el módulo entero ES el VFS (claves = TTFs)
    ?? (hasTtfs(fontsRaw?.default) ? (fontsRaw.default as Record<string, string>) : null)
    ?? (hasTtfs(fontsRaw)          ? (fontsRaw         as Record<string, string>) : null)

  if (!vfs) {
    // Diagnóstico: dump completo del módulo importado para que se pueda
    // identificar la nueva forma del export en una versión futura de pdfmake.
    console.error('[EmergencyKit] No se pudo localizar el VFS de pdfmake. Módulo importado:', fontsModule)
    return
  }

  // ── Cargar el VFS en pdfmake 0.3.x ────────────────────────────────────
  // En 0.2.x bastaba con `pdfMake.vfs = vfs`. En 0.3.x esa propiedad ya no
  // se lee: hay que llamar `addVirtualFileSystem(vfs)`, que itera las
  // claves del objeto y hace `fs.writeFileSync(key, base64, 'base64')`
  // sobre el singleton de virtual-fs.js — que es a quien pdfkit consulta
  // al cargar Roboto-Medium.ttf y demás. La auto-registración que hace
  // vfs_fonts al final del archivo (`_global.pdfMake.addVirtualFileSystem(vfs)`)
  // no se dispara bajo Vite + ESM porque `_global.pdfMake` no existe.
  if (typeof pdfMake.addVirtualFileSystem !== 'function') {
    console.error('[EmergencyKit] pdfMake.addVirtualFileSystem no está disponible. Módulo importado:', pdfModule)
    return
  }
  pdfMake.addVirtualFileSystem(vfs)

  // ── Declaración explícita de fuentes ──────────────────────────────────
  // pdfmake 0.3.x ya trae estos mismos 4 defaults para Roboto en el
  // constructor — los reasignamos como red de seguridad por si en una
  // versión futura cambian los defaults. Los nombres coinciden con los
  // archivos TTF que el VFS recién pobló.
  pdfMake.fonts = {
    Roboto: {
      normal:      'Roboto-Regular.ttf',
      bold:        'Roboto-Medium.ttf',
      italics:     'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
  }

  // Fecha en español para los metadatos del documento
  const fecha = new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  // Arma la grilla 3×4 de palabras como cuerpo de tabla pdfmake
  const wordRows: any[][] = []
  for (let row = 0; row < 4; row++) {
    const cells: any[] = []
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col
      cells.push({
        stack: [
          { text: String(idx + 1), color: '#64748b', fontSize: 8 },
          {
            // Sin font explícito → hereda Roboto del defaultStyle.
            // pdfmake 0.3.x exige declarar cada fuente en pdfMake.fonts;
            // como solo cargamos el VFS de Roboto, referenciar 'Courier'
            // (aun siendo una de las 14 PDF base) revienta con
            // "Font 'Courier' in style 'bold' is not defined".
            // La diferenciación visual la da `bold: true` + el tamaño
            // mayor (12 vs 8 del número de índice).
            text:     props.phrase[idx] ?? '',
            bold:     true,
            fontSize: 12,
            margin:   [0, 2, 0, 0],
          },
        ],
        fillColor: '#f8fafc',
        margin:    [6, 6, 6, 6],
      })
    }
    wordRows.push(cells)
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize:     'A4',
    pageMargins:  [40, 40, 40, 40],
    defaultStyle: { font: 'Roboto' },
    content: [
      // A) Encabezado: banda azul a ancho completo con título y subtítulo
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: 'FinanzasApp — Kit de Emergencia', color: '#ffffff', bold: true, fontSize: 18 },
              {
                text:     'Estas 12 palabras son la ÚNICA forma de recuperar tu cuenta si olvidas la contraseña.',
                color:    '#ffffff',
                italics:  true,
                fontSize: 10,
                margin:   [0, 4, 0, 0],
              },
            ],
            fillColor: '#2563eb',
            margin:    [12, 12, 12, 12],
            border:    [false, false, false, false],
          }]],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 16],
      },

      // B) Metadatos en dos columnas + separador horizontal gris claro
      {
        columns: [
          { text: [{ text: 'Usuario: ', bold: true }, props.email] },
          { text: [{ text: 'Fecha: ',   bold: true }, fecha], alignment: 'right' },
        ],
        fontSize: 10,
        margin:   [0, 0, 0, 8],
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' }],
        margin: [0, 0, 0, 16],
      },

      // C) Tabla central: header azul + 3 columnas × 4 filas con las 12 palabras
      {
        table: {
          headerRows: 1,
          widths:     ['*', '*', '*'],
          body: [
            [{
              text:      'Frase de Recuperación (12 palabras)',
              colSpan:    3,
              alignment: 'center',
              fillColor: '#dbeafe',
              color:     '#2563eb',
              bold:      true,
              fontSize:  11,
              margin:    [0, 6, 0, 6],
            }, {}, {}],
            ...wordRows,
          ],
        },
        layout: {
          hLineColor: () => '#e2e8f0',
          vLineColor: () => '#e2e8f0',
          hLineWidth: () => 1,
          vLineWidth: () => 1,
        },
        margin: [0, 0, 0, 20],
      },

      // D) Bloque de advertencias: título naranja + lista con colores semáforo
      // Roboto (fuente default de pdfmake) no incluye dingbats ni emojis,
      // así que los iconos van como prefijos ASCII ([OK] / [NO]) que
      // Roboto soporta nativamente. El color del prefijo lo aplica el
      // mismo color del item — verde para positivos, rojo para negativos.
      {
        text:     '! Instrucciones de seguridad',
        color:    '#d97706',
        bold:     true,
        fontSize: 12,
        margin:   [0, 0, 0, 8],
      },
      {
        ul: [
          { text: '[OK] Guárdala en papel en un lugar físico seguro.',                              color: '#16a34a' },
          { text: '[OK] Si usas un gestor de contraseñas, puedes guardarla ahí.',                   color: '#16a34a' },
          { text: '[NO] NO la guardes en un archivo sin cifrar en tu computadora.',                 color: '#dc2626' },
          { text: '[NO] NO la envíes por email, WhatsApp ni la fotografíes en la nube.',            color: '#dc2626' },
          { text: '[NO] Si alguien obtiene esta frase, puede acceder a toda tu cuenta.',            color: '#dc2626' },
        ],
        fontSize: 10,
        margin:   [0, 0, 0, 20],
      },

      // E) Footer: línea separadora + nota centrada en gris pequeño
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cbd5e1' }],
        margin: [0, 0, 0, 6],
      },
      {
        text:      'Documento generado por FinanzasApp — Guarda este documento en un lugar seguro y privado.',
        alignment: 'center',
        fontSize:  8,
        color:     '#64748b',
      },
    ],
  }

  pdfMake.createPdf(docDefinition).open()
}
</script>

<style scoped>
/* ── Bloque principal ────────────────────────────────────────────── */
.emergency-kit {
  background: var(--color-surface);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius);
  padding: var(--space-lg);
  max-width: 600px;
}

.emergency-kit__header {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-start;
  margin-bottom: var(--space-md);
}
.emergency-kit__icon { font-size: 2rem; line-height: 1; }
.emergency-kit__title {
  font-size: 1.3rem;
  font-weight: 800;
  margin: 0 0 4px;
  color: var(--color-text);
}
.emergency-kit__subtitle {
  font-size: 0.88rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.4;
}

/* ── Grilla de palabras ──────────────────────────────────────────── */
.emergency-kit__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  list-style: none;
  padding: var(--space-md);
  margin: 0 0 var(--space-md);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.emergency-kit__word {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 0.95rem;
}
.emergency-kit__num {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-text-muted);
  min-width: 18px;
  text-align: right;
}
.emergency-kit__text {
  font-family: var(--font-mono, 'Menlo', 'Consolas', monospace);
  font-weight: 600;
  color: var(--color-text);
  word-break: break-all;
}

/* ── Advertencias ────────────────────────────────────────────────── */
.emergency-kit__warnings {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
  margin-bottom: var(--space-md);
}
.emergency-kit__warning {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  color: var(--color-text);
  line-height: 1.4;
}
.emergency-kit__warning--danger { color: var(--color-danger); }

/* ── Acciones ────────────────────────────────────────────────────── */
.emergency-kit__actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 560px) {
  .emergency-kit__grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
