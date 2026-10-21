// Genera los iconos de public/ a partir de ../_setup/icono.png (requiere sharp).
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../../_setup/icono.png', import.meta.url))
const out = (file) => fileURLToPath(new URL(`../public/${file}`, import.meta.url))

// Color de fondo del icono (píxel de la esquina) para el margen del maskable
const { data } = await sharp(SRC).extract({ left: 4, top: 4, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true })
const bg = { r: data[0], g: data[1], b: data[2], alpha: 1 }

const plain = (size, file) => sharp(SRC).resize(size, size).png().toFile(out(file))

// Maskable: el glifo ocupa ~70% centrado (zona segura = círculo del 80%)
async function maskable(size, file) {
  const inner = Math.round(size * 0.7)
  const glyph = await sharp(SRC).resize(inner, inner).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: glyph, gravity: 'centre' }])
    .png()
    .toFile(out(file))
}

await Promise.all([
  plain(192, 'icon-192.png'),
  plain(512, 'icon-512.png'),
  plain(180, 'apple-touch-icon.png'),
  plain(64, 'favicon.png'),
  maskable(512, 'icon-maskable-512.png'),
])
console.log('Iconos generados en public/')
