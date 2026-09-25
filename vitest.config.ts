// Configuración de Vitest — entorno jsdom para tests de Vue 3
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // Mismo alias @/ que en vite.config.ts
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Entorno que simula el DOM del navegador
    environment: 'jsdom',
    // Archivo de configuración global (importaciones automáticas de matchers)
    setupFiles: ['./src/test/setup.ts'],
    // Vitest reemplaza el CSS por un string vacío salvo que se incluya aquí;
    // brand-tokens.test.ts necesita leer main.css como texto (`?raw`).
    css: { include: [/assets\/main\.css/] },
    // Activa las APIs de test globales (describe, it, expect) sin necesidad de importarlas
    globals: true,
    // Resuelve archivos de tipos correctamente
    typecheck: {
      tsconfig: './tsconfig.app.json',
    },
    // Cobertura vía V8 (nativa, sin instrumentation extra)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Umbrales mínimos — el comando falla con exit code 1 si bajan del 80%
      thresholds: {
        statements: 80,
        branches:   80,
      },
      exclude: [
        'node_modules/**',
        'src/test/**',
        'src/main.ts',
        'src/router/**',
        '**/*.d.ts',
        'src/types/**',        // solo interfaces/tipos — sin lógica ejecutable
        '**/*.types.ts',
        'vite.config.ts',      // config de build — sin lógica de app
        'vitest.config.ts',    // config de tests
        'scripts/**',          // scripts de build/tooling
        '**/*.mjs',            // archivos generados (PWA icons, etc.)
      ],
    },
  },
})
