/**
 * History shows the commits behind a branch ref, which for a linked project is
 * the fetched remote tip. The checkout's own HEAD can be ahead of it, so the
 * list must say which row (if any) the local clone actually has checked out.
 */

export function shortSha(sha: string): string {
    return sha.slice(0, 8);
}

export function isLocalHeadCommit(
    commitSha: string,
    branchTipSha: string | null,
    localHeadSha: string | null,
): boolean {
    return Boolean(
        localHeadSha &&
        branchTipSha &&
        branchTipSha !== localHeadSha &&
        commitSha === localHeadSha,
    );
}

export function localHeadNote(
    branchTipSha: string | null,
    localHeadSha: string | null,
    visibleHashes: readonly string[],
): string | null {
    if (!localHeadSha || !branchTipSha || branchTipSha === localHeadSha) return null;
    if (visibleHashes.includes(localHeadSha)) return null;
    return `Local checkout is at ${shortSha(localHeadSha)}`;
}
