import { describe, expect, it } from "vitest";

import { addBoards } from "./add-board-dialog";
import { memorySystem } from "./session/memory-session";
import { SystemSession } from "./session/system-session";
import { systemDocument } from "./test-fixtures";

const board = (key: number, label: string) => ({ key, projectId: `prj_${key}`, label, source: "branch" as const, ref: "main", pinned: false });

describe("addBoards (SB2-124)", () => {
  it("adds boards in order with each new ETag and keeps going past a refusal", async () => {
    const doc = systemDocument([]);
    // The in-memory system answers 412 to any ETag but the current one, so the third board lands only with the second's ETag.
    const memory = memorySystem(doc, { edits: { addInstance: (input: { label: string }) => {
      if (input.label === "BAD") throw new Error("trackedRef does not exist");
      return { id: `ins_${input.label}` };
    } } });
    const session = new SystemSession("sys_1", memory.transport, { document: doc, etag: memory.etag() });
    const result = await session.edit("add", (system) => addBoards(system, [board(1, "OBC"), board(2, "BAD"), board(3, "PAY")]));
    expect(result?.added).toEqual(["ins_OBC", "ins_PAY"]);
    expect(result?.failures.map((failure) => [failure.board.label, failure.error])).toEqual([["BAD", expect.stringMatching(/trackedRef/)]]);
    expect(memory.calls.map((call) => (call.args[0] as { label: string }).label)).toEqual(["OBC", "BAD", "PAY"]);
    expect(memory.etag()).toBe('"sys:sys_1:3"');
  });
});
