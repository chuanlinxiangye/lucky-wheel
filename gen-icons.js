// 用 Node 内置 zlib 手写 PNG 编码器，生成转盘图标（无需任何第三方库）
// 图案：深色圆底 + 6 色扇形转盘 + 白色中心圆
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'icons');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------- PNG 编码 ----------
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crcBuf]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- 画转盘 ----------
function drawIcon(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  // maskable 图标要求关键内容落在中心 80% 安全区内
  const radius = maskable ? size * 0.33 : size * 0.42;
  const colors = [
    [233, 69, 96], [245, 197, 66], [112, 161, 255],
    [123, 237, 159], [162, 155, 254], [255, 165, 2],
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let r = 15, g = 15, b = 26, a = 255;
      if (dist <= radius) {
        let ang = Math.atan2(dy, dx) + Math.PI / 2;
        if (ang < 0) ang += Math.PI * 2;
        const sector = Math.floor(ang / (Math.PI * 2 / 6)) % 6;
        [r, g, b] = colors[sector];
        // 分隔线
        if (dist > radius - size * 0.008) { r = 26; g = 26; b = 46; }
      } else if (dist <= radius + size * 0.015) {
        [r, g, b] = [26, 26, 46]; // 深色描边
      }
      // 白色中心圆
      if (dist <= radius * 0.22) { r = 255; g = 255; b = 255; }
      const idx = (y * size + x) * 4;
      px[idx] = r; px[idx + 1] = g; px[idx + 2] = b; px[idx + 3] = a;
    }
  }
  return encodePNG(size, size, px);
}

fs.writeFileSync(path.join(OUT_DIR, 'icon-192.png'), drawIcon(192));
fs.writeFileSync(path.join(OUT_DIR, 'icon-512.png'), drawIcon(512));
fs.writeFileSync(path.join(OUT_DIR, 'icon-512-maskable.png'), drawIcon(512, { maskable: true }));
console.log('OK:', fs.readdirSync(OUT_DIR).join(', '));
