// Identidad de la app: única fuente del nombre, la descripción y el color de
// marca públicos. La UI (layouts, títulos) importa desde aquí; index.html y el
// manifest PWA lo reciben en build vía vite.config.ts, así que no hay literales
// duplicados. THEME_COLOR y BACKGROUND_COLOR deben coincidir con --color-primary
// y --color-bg de src/assets/main.css (lo comprueba brand-tokens.test.ts).
export const APP_NAME = 'La Marchanta'
export const APP_DESCRIPTION =
  'La app para vender de tú a tú: catálogo, ventas, comisiones y deudas de tu changarro, bazar o tianguis.'
export const THEME_COLOR = '#b8501c'
export const BACKGROUND_COLOR = '#faf4e8'
