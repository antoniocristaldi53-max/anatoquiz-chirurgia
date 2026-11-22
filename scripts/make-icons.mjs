// Genera le icone PNG (192, 512, 180 apple-touch) senza dipendenze: sfondo scuro, anello teal, croce.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [11, 16, 22];
const TEAL = [60, 198, 194];
const WHITE = [230, 237, 243];

function shade(u, v) {
  // u,v in [0,1]; restituisce [r,g,b]
  const cx = u - 0.5, cy = v - 0.5;
  const r = Math.hypot(cx, cy);
  const crossArm = 0.075, crossLen = 0.2;
  const inCross = (Math.abs(cx) < crossArm && Math.abs(cy) < crossLen) || (Math.abs(cy) < crossArm && Math.abs(cx) < crossLen);
  if (inCross) return WHITE;
  if (r < 0.34 && r > 0.27) return TEAL;
  if (r <= 0.27) return [19, 35, 44];
  return BG;
}

function png(size) {
  const ss = 4;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const c = shade((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
          acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
        }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let k = 0; k < 3; k++) raw[o + k] = Math.round(acc[k] / (ss * ss));
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192));
writeFileSync('public/icons/icon-512.png', png(512));
writeFileSync('public/icons/apple-touch-icon.png', png(180));
writeFileSync(
  'public/icons/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#0b1016"/><circle cx="50" cy="50" r="30.5" fill="#13232c" stroke="#3cc6c2" stroke-width="7"/><path d="M42.5 30h15v12.5H70v15H57.5V70h-15V57.5H30v-15h12.5z" fill="#e6edf3"/></svg>\n`,
);
console.log('Icone generate in public/icons');
