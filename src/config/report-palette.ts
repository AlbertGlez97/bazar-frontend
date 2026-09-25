/**
 * Paleta de los archivos exportados (PDF y Excel). Los archivos no leen CSS, así
 * que los valores se copian de los tokens de `src/assets/main.css`;
 * `REPORT_COLOR_TOKENS` dice de cuál viene cada uno y
 * `src/config/__tests__/report-palette.test.ts` lee main.css y falla si alguno
 * se desvía. Cambiar la paleta de la marca = cambiar main.css y estos valores.
 */
export const REPORT_COLORS = {
  primary: '#b8501c',
  primarySoft: '#f9e3d2',
  onPrimary: '#ffffff',
  accent: '#f0b429',
  surface: '#fffdf9',
  surfaceAlt: '#f2e8d5',
  border: '#e3d5bc',
  text: '#2b1d14',
  textMuted: '#6a5443',
  warning: '#8a5300',
  warningSoft: '#fbebc0',
} as const

export type ReportColor = keyof typeof REPORT_COLORS

export const REPORT_COLOR_TOKENS: Record<ReportColor, string> = {
  primary: '--color-primary',
  primarySoft: '--color-primary-soft',
  onPrimary: '--color-on-primary',
  accent: '--color-accent',
  surface: '--color-surface',
  surfaceAlt: '--color-surface-alt',
  border: '--color-border',
  text: '--color-text',
  textMuted: '--color-text-muted',
  warning: '--color-warning',
  warningSoft: '--color-warning-soft',
}

/** `#b8501c` -> `FFB8501C` (ARGB opaco, el formato de color de ExcelJS). */
export function toArgb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`
}
