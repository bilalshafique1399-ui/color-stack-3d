import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Pure Node.js PNG encoder to generate crisp isometric Color Stack icons
 * for PWA home screen and Android launcher icons without native canvas dependencies.
 */
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function renderIconPng(size, padScale = 1.0) {
  const raw = Buffer.alloc(size * (size * 4 + 1));

  // Helper to scale 512-space coordinates around center (256, 256)
  const tx = (v) => 256 + (v - 256) * padScale;

  const slabs = [
    // Bottom Emerald slab
    {
      top: [[tx(256), tx(336)], [tx(396), tx(266)], [tx(256), tx(196)], [tx(116), tx(266)]],
      left: [[tx(116), tx(266)], [tx(256), tx(336)], [tx(256), tx(384)], [tx(116), tx(314)]],
      right: [[tx(396), tx(266)], [tx(256), tx(336)], [tx(256), tx(384)], [tx(396), tx(314)]],
      cTop: [46, 229, 157],
      cLeft: [27, 179, 119],
      cRight: [18, 138, 91],
    },
    // Middle Gold slab
    {
      top: [[tx(256), tx(272)], [tx(380), tx(210)], [tx(256), tx(148)], [tx(132), tx(210)]],
      left: [[tx(132), tx(210)], [tx(256), tx(272)], [tx(256), tx(316)], [tx(132), tx(254)]],
      right: [[tx(380), tx(210)], [tx(256), tx(272)], [tx(256), tx(316)], [tx(380), tx(254)]],
      cTop: [255, 209, 92],
      cLeft: [229, 174, 43],
      cRight: [194, 141, 20],
    },
    // Top Coral Rose slab
    {
      top: [[tx(256), tx(210)], [tx(364), tx(156)], [tx(256), tx(102)], [tx(148), tx(156)]],
      left: [[tx(148), tx(156)], [tx(256), tx(210)], [tx(256), tx(252)], [tx(148), tx(198)]],
      right: [[tx(364), tx(156)], [tx(256), tx(210)], [tx(256), tx(252)], [tx(364), tx(198)]],
      cTop: [255, 94, 126],
      cLeft: [224, 62, 96],
      cRight: [184, 40, 71],
    },
  ];

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // Filter type 0 (None)
    const ny = (y / size) * 512;
    const gradT = y / size;

    // Background deep indigo gradient
    const bgR = Math.round(30 * (1 - gradT) + 15 * gradT);
    const bgG = Math.round(27 * (1 - gradT) + 23 * gradT);
    const bgB = Math.round(75 * (1 - gradT) + 42 * gradT);

    for (let x = 0; x < size; x++) {
      const nx = (x / size) * 512;
      let r = bgR, g = bgG, b = bgB;

      for (const s of slabs) {
        if (pointInPoly(nx, ny, s.left)) {
          [r, g, b] = s.cLeft;
        } else if (pointInPoly(nx, ny, s.right)) {
          [r, g, b] = s.cRight;
        }
        if (pointInPoly(nx, ny, s.top)) {
          [r, g, b] = s.cTop;
        }
      }

      const idx = rowStart + 1 + x * 4;
      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const publicDir = path.resolve('public');
fs.mkdirSync(publicDir, { recursive: true });

fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), renderIconPng(180, 0.92));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), renderIconPng(192, 0.95));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), renderIconPng(512, 0.95));
// Maskable icon keeps 15% safe zone padding around edges
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), renderIconPng(512, 0.78));

console.log('Generated PWA & Android launcher PNG icons successfully.');
