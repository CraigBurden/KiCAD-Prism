import assert from "node:assert/strict";
import test from "node:test";

import { GeometryArena } from "./geometry-arena.js";

function fakeDevice() {
  const device = {
    buffers: [],
    writes: [],
    copies: [],
    submits: 0,
    createBuffer({ size, label }) {
      const buffer = { size, label, destroyed: false, destroy() { this.destroyed = true; } };
      device.buffers.push(buffer);
      return buffer;
    },
    createCommandEncoder() {
      return {
        copyBufferToBuffer: (from, fromOffset, to, toOffset, size) => device.copies.push([from.label, fromOffset, to.label, toOffset, size]),
        finish: () => ({}),
      };
    },
    queue: {
      writeBuffer: (buffer, offset, data) => device.writes.push([buffer.label, offset, data.byteLength]),
      submit: () => { device.submits += 1; },
    },
  };
  return device;
}

const arena = (chunk = 1024) => {
  const device = fakeDevice();
  return { device, arena: new GeometryArena(device, 0, "test", chunk) };
};

test("small allocations share a chunk, aligned to four bytes", () => {
  const { device, arena: a } = arena();
  const first = a.alloc(10);
  const second = a.alloc(24);
  assert.equal(device.buffers.length, 1);
  assert.equal(first.buffer, second.buffer);
  assert.deepEqual([first.offset, first.size, second.offset], [0, 12, 12]);
  assert.equal(a.usedBytes, 36);
  a.write(second, new Uint8Array(24));
  assert.deepEqual(device.writes, [["test-0", 12, 24]]);
});

test("freed ranges merge; an empty chunk is released", () => {
  const { device, arena: a } = arena();
  const blocks = [a.alloc(100), a.alloc(100), a.alloc(100)];
  a.free(blocks[0]);
  a.free(blocks[1]);
  assert.deepEqual(blocks[2].chunk.free, [{ offset: 0, size: 200 }, { offset: 300, size: 724 }]);
  a.free(blocks[2]);
  assert.equal(a.chunks.length, 0);
  assert.equal(device.buffers[0].destroyed, true);
  assert.equal(a.reservedBytes(), 0);
});

test("best fit fills the end of a chunk before opening another", () => {
  const { device, arena: a } = arena();
  const hole = a.alloc(300);
  a.alloc(500);
  a.free(hole); // a 300 hole at the start, 224 left at the end
  const small = a.alloc(100);
  assert.equal(small.offset, 800, "the tighter end range, not the hole");
  assert.equal(device.buffers.length, 1);
});

test("a large allocation gets exactly its size, nothing stranded", () => {
  const { device, arena: a } = arena();
  const over = a.alloc(600);
  assert.equal(over.buffer.size, 600);
  assert.deepEqual(over.chunk.free, []);
  const big = a.alloc(4000);
  assert.equal(big.buffer.size, 4000);
  assert.equal(device.buffers.length, 2);
});

test("a chunk under half full is repacked into the others and released", () => {
  const { device, arena: a } = arena();
  const first = [a.alloc(400), a.alloc(400)]; // chunk 0: 800 of 1024
  const second = [a.alloc(400), a.alloc(400)]; // chunk 1
  const survivor = second[1];
  a.free(first[0]); // chunk 0 at 400: still half full or more? 400 < 512, but it is the target below
  // chunk 0 dropped below half: its survivor moves to chunk 1? chunk 1 is full, so a fresh chunk takes it.
  const generation = a.generation;
  assert.ok(generation >= 1);
  a.free(second[0]); // chunk 1 below half: survivor moves into the free space
  assert.equal(a.generation, generation + 1);
  assert.ok(device.copies.length >= 2, "live data is copied on the GPU");
  assert.ok(device.buffers.filter((buffer) => !buffer.destroyed).length <= 2);
  assert.equal(a.usedBytes, 800);
  assert.equal(survivor.chunk.live.has(survivor), true, "the caller's allocation object was moved in place");
  assert.equal(survivor.buffer, survivor.chunk.buffer);
});
