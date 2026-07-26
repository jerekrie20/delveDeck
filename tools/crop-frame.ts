// One-time asset tool: cut a single square frame out of a horizontal sprite strip
// and write it as a standalone PNG.
//
// Run by hand, output committed to `public/`. Nothing at runtime touches this.
//
// Why it exists: a few of the inherited portraits from `../infinite-delve` are
// 10- and 15-frame animation strips, and rule 1 of this project is "no art that
// animates or aligns". Shipping the strip and positioning it with CSS would be
// exactly the per-frame-alignment trap that stalled the previous project — so the
// frame is cut ONCE, here, and what ships is a plain static image.
//
// Deliberately dependency-free (node:zlib only): this runs a handful of times ever
// and is not worth an image library in the tree.
//
//   npx tsx tools/crop-frame.ts <input.png> <output.png> [frameIndex]
//
// The one thing you must not break: output must be a normal 8-bit PNG that any
// browser renders without help. Correctness beats file size — every row is written
// with filter type 0.

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Bytes per pixel for the PNG colour types we accept (8-bit, non-indexed). */
const BYTES_PER_PIXEL: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };

interface Chunk {
  type: string;
  data: Buffer;
}

const crcTable: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function readChunks(png: Buffer): Chunk[] {
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('not a PNG');
  const chunks: Chunk[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    chunks.push({ type, data: png.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length; // length + type + data + crc
  }
  return chunks;
}

function writeChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** Reverse the per-scanline filters, returning raw pixel rows. */
function unfilter(raw: Buffer, width: number, height: number, bpp: number): Buffer {
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++]!;
    const rowStart = y * stride;
    const priorStart = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[pos++]!;
      const left = x >= bpp ? out[rowStart + x - bpp]! : 0;
      const up = y > 0 ? out[priorStart + x]! : 0;
      const upLeft = y > 0 && x >= bpp ? out[priorStart + x - bpp]! : 0;
      let restored: number;
      switch (filter) {
        case 0: restored = value; break;
        case 1: restored = value + left; break;
        case 2: restored = value + up; break;
        case 3: restored = value + ((left + up) >> 1); break;
        case 4: restored = value + paeth(left, up, upLeft); break;
        default: throw new Error(`unknown PNG filter type ${filter} on row ${y}`);
      }
      out[rowStart + x] = restored & 0xff;
    }
  }
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function cropFrame(png: Buffer, frameIndex: number): Buffer {
  const chunks = readChunks(png);
  const header = chunks.find((chunk) => chunk.type === 'IHDR');
  if (!header) throw new Error('PNG has no IHDR');

  const width = header.data.readUInt32BE(0);
  const height = header.data.readUInt32BE(4);
  const bitDepth = header.data.readUInt8(8);
  const colorType = header.data.readUInt8(9);
  const interlace = header.data.readUInt8(12);

  if (bitDepth !== 8) throw new Error(`only 8-bit PNGs supported, got ${bitDepth}`);
  if (interlace !== 0) throw new Error('interlaced PNGs not supported');
  const bpp = BYTES_PER_PIXEL[colorType];
  if (!bpp) throw new Error(`unsupported colour type ${colorType}`);

  // Frames are square and laid out left to right, so the frame size is the height.
  const frameSize = height;
  const frameCount = width / frameSize;
  if (!Number.isInteger(frameCount)) {
    throw new Error(`${width}x${height} is not a whole number of square frames`);
  }
  if (frameIndex < 0 || frameIndex >= frameCount) {
    throw new Error(`frame ${frameIndex} out of range (strip has ${frameCount})`);
  }

  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
  const pixels = unfilter(inflateSync(idat), width, height, bpp);

  // Copy the frame's column range out of every row, prefixing filter type 0.
  const srcStride = width * bpp;
  const dstStride = frameSize * bpp;
  const cropped = Buffer.alloc((dstStride + 1) * frameSize);
  for (let y = 0; y < frameSize; y++) {
    const srcStart = y * srcStride + frameIndex * dstStride;
    cropped[y * (dstStride + 1)] = 0;
    pixels.copy(cropped, y * (dstStride + 1) + 1, srcStart, srcStart + dstStride);
  }

  const newHeader = Buffer.from(header.data);
  newHeader.writeUInt32BE(frameSize, 0);
  newHeader.writeUInt32BE(frameSize, 4);

  return Buffer.concat([
    PNG_SIGNATURE,
    writeChunk('IHDR', newHeader),
    writeChunk('IDAT', deflateSync(cropped, { level: 9 })),
    writeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const [input, output, frame] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: npx tsx tools/crop-frame.ts <input.png> <output.png> [frameIndex]');
  process.exit(1);
}

const result = cropFrame(readFileSync(input), Number(frame ?? 0));
writeFileSync(output, result);
console.log(`${input} → ${output} (frame ${frame ?? 0}, ${result.length} bytes)`);
