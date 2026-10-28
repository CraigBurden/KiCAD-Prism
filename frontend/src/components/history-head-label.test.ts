import { describe, expect, it } from "vitest";

import { isLocalHeadCommit, localHeadNote, shortSha } from "./history-head-label";

const TIP = "1111111111111111111111111111111111111111";
const HEAD = "2222222222222222222222222222222222222222";

describe("history head labels", () => {
    it("shortens a commit to eight characters", () => {
        expect(shortSha(HEAD)).toBe("22222222");
    });

    it("marks the HEAD row only when it differs from the listed branch tip", () => {
        expect(isLocalHeadCommit(HEAD, TIP, HEAD)).toBe(true);
        expect(isLocalHeadCommit(TIP, TIP, HEAD)).toBe(false);
        expect(isLocalHeadCommit(HEAD, TIP, TIP)).toBe(false);
        expect(isLocalHeadCommit(HEAD, TIP, null)).toBe(false);
        expect(isLocalHeadCommit(HEAD, null, HEAD)).toBe(false);
    });

    it("notes a local HEAD that the visible commits do not include", () => {
        expect(localHeadNote(TIP, HEAD, [TIP])).toBe("Local checkout is at 22222222");
        expect(localHeadNote(TIP, HEAD, [TIP, HEAD])).toBeNull();
    });

    it("stays quiet when the branch tip is the checkout", () => {
        expect(localHeadNote(TIP, TIP, [TIP])).toBeNull();
        expect(localHeadNote(TIP, null, [TIP])).toBeNull();
        expect(localHeadNote(null, HEAD, [])).toBeNull();
    });
});
