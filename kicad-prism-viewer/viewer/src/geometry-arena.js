// Geometry arena (System Builder SB2-90). Thousands of small vertex and index
// buffers each cost a driver allocation rounded up to a page (16 KB on Apple
// GPUs): the JTYU Satellite Bus's 8,634 buffers could waste ~125 MB that no
// count here would show, and a larger system of systems more. Geometry is
// suballocated from large chunks instead, with waste bounded at any scale:
// - best fit: an allocation takes the smallest free range that holds it, so
//   the ends of chunks fill before a new chunk opens;
// - freed ranges merge with their neighbours, and an empty chunk is released;
// - an allocation over half a chunk gets a buffer of exactly its size;
// - a chunk that drops below half full is repacked: its live allocations are
//   copied on the GPU into the others and it is released, so tiles loaded and
//   released over a long session cannot leave the arena mostly holes.
// Allocations are objects the caller keeps; a repack moves them in place and
// bumps `generation`, so anything that recorded their buffers (render bundles)
// knows to record again.

export const ARENA_CHUNK_BYTES = 16 * 1024 * 1024;
const ALIGN = 4; // vertex offsets and writeBuffer need 4; u16/u32 index offsets need 2/4
const REPACK_BELOW = 0.5;

export class GeometryArena {
  constructor(device, usage, label, chunkBytes = ARENA_CHUNK_BYTES) {
    this.device = device;
    this.usage = usage | GPUBufferUsageFlags.COPY_SRC | GPUBufferUsageFlags.COPY_DST;
    this.label = label;
    this.chunkBytes = chunkBytes;
    this.chunks = [];
    this.usedBytes = 0;
    this.generation = 0;
    this.repacks = 0;
  }

  /** `{buffer, offset, size}` for `bytes`, rounded up to the alignment. */
  alloc(bytes) {
    const size = Math.max(ALIGN, Math.ceil(bytes / ALIGN) * ALIGN);
    const allocation = { buffer: null, offset: 0, size, chunk: null };
    this.place(allocation, null);
    return allocation;
  }

  /** Put an allocation in the best-fitting free range of any chunk but `except`, or a new chunk. */
  place(allocation, except) {
    const { size } = allocation;
    let best = null;
    if (size <= this.chunkBytes / 2) {
      for (const chunk of this.chunks) {
        if (chunk === except || chunk.dedicated) continue;
        chunk.free.forEach((range, index) => {
          if (range.size >= size && (!best || range.size < best.range.size)) best = { chunk, index, range };
        });
      }
    }
    let chunk;
    let offset;
    if (best) {
      ({ chunk } = best);
      offset = best.range.offset;
      if (best.range.size === size) chunk.free.splice(best.index, 1);
      else chunk.free[best.index] = { offset: offset + size, size: best.range.size - size };
    } else {
      // A large allocation gets a buffer of exactly its size: in a shared chunk it would strand the rest.
      const dedicated = size > this.chunkBytes / 2;
      const chunkSize = dedicated ? size : this.chunkBytes;
      chunk = {
        buffer: this.device.createBuffer({ label: `${this.label}-${this.chunks.length}`, size: chunkSize, usage: this.usage }),
        size: chunkSize,
        free: chunkSize > size ? [{ offset: size, size: chunkSize - size }] : [],
        used: 0,
        live: new Set(),
        dedicated,
      };
      this.chunks.push(chunk);
      offset = 0;
    }
    chunk.used += size;
    chunk.live.add(allocation);
    this.usedBytes += size;
    Object.assign(allocation, { buffer: chunk.buffer, offset, chunk });
  }

  /** Copy `data` into an allocation. */
  write(allocation, data) {
    this.device.queue.writeBuffer(allocation.buffer, allocation.offset, data);
  }

  /** Return an allocation; an empty chunk goes, and one under half full is repacked. */
  free(allocation) {
    const { chunk } = allocation;
    if (!chunk || !chunk.live.has(allocation)) return;
    this.release(chunk, allocation);
    allocation.chunk = null;
    if (!chunk.live.size) {
      this.drop(chunk);
      return;
    }
    if (!chunk.dedicated && chunk.used < chunk.size * REPACK_BELOW && this.chunks.length > 1) this.repack(chunk);
  }

  release(chunk, allocation) {
    chunk.used -= allocation.size;
    chunk.live.delete(allocation);
    this.usedBytes -= allocation.size;
    const free = chunk.free;
    let index = free.findIndex((range) => range.offset > allocation.offset);
    if (index < 0) index = free.length;
    free.splice(index, 0, { offset: allocation.offset, size: allocation.size });
    // Merge with the next range, then with the previous one.
    if (index + 1 < free.length && free[index].offset + free[index].size === free[index + 1].offset) {
      free[index].size += free[index + 1].size;
      free.splice(index + 1, 1);
    }
    if (index > 0 && free[index - 1].offset + free[index - 1].size === free[index].offset) {
      free[index - 1].size += free[index].size;
      free.splice(index, 1);
    }
  }

  drop(chunk) {
    chunk.buffer.destroy?.();
    this.chunks.splice(this.chunks.indexOf(chunk), 1);
  }

  /** Move a chunk's live allocations elsewhere on the GPU and release it. */
  repack(chunk) {
    const encoder = this.device.createCommandEncoder({ label: `${this.label}-repack` });
    for (const allocation of [...chunk.live]) {
      const from = { buffer: allocation.buffer, offset: allocation.offset };
      this.release(chunk, allocation);
      this.place(allocation, chunk);
      encoder.copyBufferToBuffer(from.buffer, from.offset, allocation.buffer, allocation.offset, allocation.size);
    }
    this.device.queue.submit([encoder.finish()]);
    this.drop(chunk);
    this.generation += 1;
    this.repacks += 1;
  }

  /** Bytes the chunks hold on the GPU. */
  reservedBytes() {
    return this.chunks.reduce((sum, chunk) => sum + chunk.size, 0);
  }

  destroy() {
    for (const chunk of this.chunks) chunk.buffer.destroy?.();
    this.chunks = [];
    this.usedBytes = 0;
  }
}

// GPUBufferUsage outside a browser (tests): the two flags the arena adds.
const GPUBufferUsageFlags = globalThis.GPUBufferUsage || { COPY_SRC: 0x0004, COPY_DST: 0x0008 };
