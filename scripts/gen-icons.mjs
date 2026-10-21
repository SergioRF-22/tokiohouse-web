// Genera iconos placeholder (fondo sólido + casa blanca) sin dependencias.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const BG = [0xe4, 0x57, 0x2e]
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (b) => {
  let c = 0xffffffff
  for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, c])
}

// scale: tamaño del glifo respecto al lienzo (maskable necesita zona segura ~60%)
function png(size, scale) {
  const stride = size * 3 + 1
  const raw = Buffer.alloc(stride * size)
  const s = size * scale
  const o = (size - s) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x - o) / s
      const v = (y - o) / s
      const roof = v >= 0 && v < 0.5 && Math.abs(u - 0.5) <= v
      const body = v >= 0.45 && v <= 1 && u >= 0.15 && u <= 0.85
      raw.set(roof || body ? [255, 255, 255] : BG, y * stride + 1 + x * 3)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync('public/icon-192.png', png(192, 0.7))
writeFileSync('public/icon-512.png', png(512, 0.7))
writeFileSync('public/icon-maskable-512.png', png(512, 0.5))
