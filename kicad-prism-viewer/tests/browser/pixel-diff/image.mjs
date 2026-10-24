// RGBA image helpers for the pixel-diff runner: PNG encoding and a strict diff.
import { crc32, deflateSync } from "node:zlib";

// Encode 8-bit RGBA pixels as a PNG (no filtering; deflate does the work).
export function encodePng({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, payload) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), payload]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// Compare two RGBA images pixel by pixel. A pixel differs when any channel
// differs by more than `tolerance` (0 = exact). Returns the count, the largest
// channel delta, the bounding box of differing pixels, and a visual diff:
// the base dimmed to grey, differing pixels in red.
export function diffImages(a, b, { tolerance = 0 } = {}) {
  if (a.width !== b.width || a.height !== b.height) {
    return { comparable: false, reason: `size ${a.width}x${a.height} vs ${b.width}x${b.height}` };
  }
  const { width, height } = a;
  const out = new Uint8Array(width * height * 4);
  let pixels = 0;
  let maxDelta = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0, p = 0; i < a.data.length; i += 4, p += 1) {
    const delta = Math.max(
      Math.abs(a.data[i] - b.data[i]),
      Math.abs(a.data[i + 1] - b.data[i + 1]),
      Math.abs(a.data[i + 2] - b.data[i + 2]),
      Math.abs(a.data[i + 3] - b.data[i + 3]),
    );
    if (delta > maxDelta) maxDelta = delta;
    if (delta > tolerance) {
      pixels += 1;
      const x = p % width;
      const y = (p - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      out[i] = 255;
      out[i + 1] = 0;
      out[i + 2] = 0;
    } else {
      const grey = Math.round((a.data[i] * 0.299 + a.data[i + 1] * 0.587 + a.data[i + 2] * 0.114) * 0.35);
      out[i] = grey;
      out[i + 1] = grey;
      out[i + 2] = grey;
    }
    out[i + 3] = 255;
  }
  return {
    comparable: true,
    pixels,
    fraction: pixels / (width * height),
    maxDelta,
    bbox: pixels ? [minX, minY, maxX, maxY] : null,
    image: { width, height, data: out },
  };
}
