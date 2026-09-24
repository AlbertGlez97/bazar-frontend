// Genera los iconos PWA en los tamaños que exigen Android, iOS y browsers.
// Corré con: node scripts/generate-pwa-icons.mjs
// Output: public/icons/*.png + public/icons/maskable-512.png
//
// Para regenerar con un logo nuevo: reemplazá SVG_SOURCE con tu SVG cuadrado
// y volvé a correr el script. Los PNGs se sobrescriben.

import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const OUT_DIR = path.resolve('public/icons')

// SVG master 512x512 — derivado del favicon actual (badge "$" sobre azul).
// Para el maskable, el "$" vive dentro de un safe zone de 40% — así queda
// bien cuando Android lo recorta en círculo/squircle.
const SVG_REGULAR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#2563eb"/>
  <text x="256" y="370" font-size="320" text-anchor="middle"
        fill="#ffffff" font-family="system-ui, -apple-system, sans-serif"
        font-weight="800">$</text>
</svg>`

// Maskable: el icono llena todo el canvas (sin esquinas redondeadas) y el
// contenido se mantiene dentro del círculo de 80% (safe zone). Así Android
// puede recortarlo en cualquier forma sin perder el símbolo.
const SVG_MASKABLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2563eb"/>
  <text x="256" y="330" font-size="220" text-anchor="middle"
        fill="#ffffff" font-family="system-ui, -apple-system, sans-serif"
        font-weight="800">$</text>
</svg>`

const targets = [
  { name: '192.png',           size: 192, svg: SVG_REGULAR  },
  { name: '512.png',           size: 512, svg: SVG_REGULAR  },
  { name: 'apple-touch-180.png', size: 180, svg: SVG_REGULAR },
  { name: 'maskable-512.png',  size: 512, svg: SVG_MASKABLE },
]

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })

  for (const { name, size, svg } of targets) {
    const outPath = path.join(OUT_DIR, name)
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(outPath)
    console.log(`✓ ${name}  (${size}×${size})`)
  }

  console.log('\nListo. Iconos generados en public/icons/')
}

main().catch((err) => {
  console.error('✗ Error generando iconos:', err)
  process.exit(1)
})
