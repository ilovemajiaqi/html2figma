/* crop.mjs — crop a PNG region and scale it up, writing a new PNG.
   Usage: node crop.mjs <src.png> <out.png> <x> <y> <w> <h> [zoom]
   Output dimensions are rounded to integers: fractional PNG sizes fail to decode in many viewers. */
import fs from 'node:fs';
import zlib from 'node:zlib';

function pngDecode(buf) {
  let p = 8, w = 0, h = 0, bd = 0, ct = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8) throw new Error('bitdepth ' + bd);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct];
  if (!ch) throw new Error('colortype ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(w * h * ch);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, ch, data: out };
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function pngEncode(w, h, rgb) {
  const stride = w * 3;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const [src, outPath, X, Y, W, H, Z] = process.argv.slice(2);
if (src === '--help' || src === '-h') {
  console.log('usage: node crop.mjs <src.png> <out.png> <x> <y> <w> <h> [zoom]');
  process.exit(0);
}
if (!src || !outPath) {
  console.error('usage: node crop.mjs <src.png> <out.png> <x> <y> <w> <h> [zoom]');
  process.exit(1);
}
const nums = [X, Y, W, H].map((v) => Number(v));
if (nums.some((n) => !Number.isFinite(n))) {
  console.error('crop: x/y/w/h must be numbers');
  process.exit(1);
}
const img = pngDecode(fs.readFileSync(src));
const x0 = Math.max(0, Math.min(img.w - 1, nums[0]));
const y0 = Math.max(0, Math.min(img.h - 1, nums[1]));
const w0 = Math.min(nums[2], img.w - x0);
const h0 = Math.min(nums[3], img.h - y0);
const z = Number.isFinite(Number(Z)) && Number(Z) > 0 ? Number(Z) : 1;
const ow = Math.max(1, Math.round(w0 * z));
const oh = Math.max(1, Math.round(h0 * z));
const out = Buffer.alloc(ow * oh * 3);
for (let y = 0; y < oh; y++) {
  for (let x = 0; x < ow; x++) {
    const sx = x0 + Math.min(w0 - 1, Math.floor(x * w0 / ow));
    const sy = y0 + Math.min(h0 - 1, Math.floor(y * h0 / oh));
    const si = (sy * img.w + sx) * img.ch;
    const di = (y * ow + x) * 3;
    if (img.ch >= 3) { out[di] = img.data[si]; out[di + 1] = img.data[si + 1]; out[di + 2] = img.data[si + 2]; }
    else { out[di] = out[di + 1] = out[di + 2] = img.data[si]; }
  }
}
fs.writeFileSync(outPath, pngEncode(ow, oh, out));
console.log('wrote', outPath, ow + 'x' + oh, 'from', src, x0 + ',' + y0, w0 + 'x' + h0, 'zoom', z);
