// Identidad de la app: única fuente del nombre y la descripción públicos.
// La UI (layouts, títulos) lo importa desde aquí; index.html y el manifest PWA
// lo reciben en build vía vite.config.ts, así que no hay literales duplicados.
export const APP_NAME = 'Bazar'
export const APP_DESCRIPTION = 'Gestión de tu bazar: productos, ventas y comisiones.'
