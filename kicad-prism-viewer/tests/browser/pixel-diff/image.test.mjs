import assert from "node:assert/strict";
import { test } from "node:test";
import { inflateSync } from "node:zlib";
import { diffImages, encodePng } from "./image.mjs";

const image = (width, height, fill) => {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(fill, i);
  return { width, height, data };
};

test("identical images differ in no pixel", () => {
  const result = diffImages(image(4, 3, [10, 20, 30, 255]), image(4, 3, [10, 20, 30, 255]));
  assert.equal(result.pixels, 0);
  assert.equal(result.maxDelta, 0);
  assert.equal(result.bbox, null);
});

test("a one-channel change of 1 counts at tolerance 0 and has a tight bbox", () => {
  const a = image(5, 4, [0, 0, 0, 255]);
  const b = image(5, 4, [0, 0, 0, 255]);
  b.data[(2 * 5 + 3) * 4 + 1] = 1; // x=3, y=2
  b.data[(1 * 5 + 1) * 4 + 2] = 9; // x=1, y=1
  const strict = diffImages(a, b);
  assert.equal(strict.pixels, 2);
  assert.equal(strict.maxDelta, 9);
  assert.deepEqual(strict.bbox, [1, 1, 3, 2]);
  assert.deepEqual([...strict.image.data.subarray((2 * 5 + 3) * 4, (2 * 5 + 3) * 4 + 4)], [255, 0, 0, 255]);
  const tolerant = diffImages(a, b, { tolerance: 1 });
  assert.equal(tolerant.pixels, 1);
});

test("different sizes are reported, not compared", () => {
  const result = diffImages(image(2, 2, [0, 0, 0, 0]), image(3, 2, [0, 0, 0, 0]));
  assert.equal(result.comparable, false);
});

test("encodePng writes a valid header and round-trips the pixels", () => {
  const source = image(3, 2, [1, 2, 3, 4]);
  source.data[4] = 200;
  const png = encodePng(source);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.toString("ascii", 12, 16), "IHDR");
  assert.equal(png.readUInt32BE(16), 3);
  assert.equal(png.readUInt32BE(20), 2);
  const idatLength = png.readUInt32BE(33);
  assert.equal(png.toString("ascii", 37, 41), "IDAT");
  const raw = inflateSync(png.subarray(41, 41 + idatLength));
  assert.equal(raw.length, (3 * 4 + 1) * 2);
  assert.equal(raw[0], 0);
  assert.deepEqual([...raw.subarray(1, 9)], [1, 2, 3, 4, 200, 2, 3, 4]);
});
