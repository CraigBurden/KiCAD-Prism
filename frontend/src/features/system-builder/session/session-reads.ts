import type { SessionRead, SystemReads, Topic } from "./system-session";

function read<T>(key: string, follows: readonly Topic[], keep: boolean, load: (reads: SystemReads, signal: AbortSignal) => Promise<T>): SessionRead<T> {
  return { key, follows, keep, load };
}

const VERSION: readonly Topic[] = ["version"];

/**
 * AC-15: every read the System Builder makes of an open system, with what makes it stale.
 * `keep` says whether the last value stays shown while a newer one loads, as each read
 * behaved before the session owned them.
 */
export const sessionReads = {
  /** The subsystem contents (CONTRACTS_P2 §5). */
  hierarchy: () => read("hierarchy", VERSION, false, (reads) => reads.getHierarchy()),
  /** The diagram's saved positions: unversioned (§1 invariant 6), read once; a failure is an empty layout. */
  layout: () => read("layout", [], false, (reads) => reads.getLayout().catch(() => ({}))),
  /** The 3D scene, re-read when the scene key moves and polled while bundles build. */
  scene: () => read("scene", ["scene"], true, (reads) => reads.getScene()),
  /** The root level's mate solve (§14.10). */
  placement: () => read("placement", VERSION, false, (reads) => reads.getPlacement()),
  linkMate: (linkId: string) => read(`link-mate:${linkId}`, VERSION, false, (reads) => reads.getLinkMate(linkId)),
  mating: (instanceId: string) => read(`mating:${instanceId}`, VERSION, false, (reads) => reads.getMating(instanceId)),
  /** A board's interface at the baseline it is placed at; `status` re-reads it once extraction settles. */
  instanceInterface: (instanceId: string, baseline: string | null, status: string | null) =>
    read(`interface:${instanceId}@${baseline ?? ""}:${status ?? ""}`, [], false, (reads) => reads.getInstanceInterface(instanceId)),
  /** Open reviews and the recent automatic changes (the Changes tray). */
  changes: () => read("changes", VERSION, true, async (reads) => {
    const [reviews, history] = await Promise.all([reads.listReviews("open"), reads.getHistory(null, 50)]);
    return { reviews, events: history.events };
  }),
  /** The newest page of the audit log; taking a snapshot moves it without a new version. */
  auditLog: () => read("audit-log", ["version", "repository"], true, (reads) => reads.getHistory(null, 50)),
  snapshots: () => read("snapshots", ["version", "repository"], true, (reads) => reads.listSnapshots()),
  gitLink: () => read("git-link", ["version", "repository"], true, (reads) => reads.getGitLink()),
  /** SB2-98: the top bar's git link and latest snapshot; edits leave them alone. */
  repository: () => read("repository", ["repository"], true, async (reads) => {
    const [git, snapshots] = await Promise.all([reads.getGitLink().catch(() => null), reads.listSnapshots().catch(() => [])]);
    return { git, snapshot: snapshots[0] ?? null };
  }),
  snapshotDiff: (snapshotId: string, against: string) =>
    read(`diff:${snapshotId}:${against}`, VERSION, false, (reads) => reads.diffSnapshot(snapshotId, against)),
  endSuggestions: (harnessId: string, endId: string) =>
    read(`suggestions:${harnessId}:${endId}`, VERSION, false, (reads) => reads.getEndSuggestions(harnessId, endId)),
  /** The live ICD; the last one stays shown while a newer version is generated. */
  icd: () => read("icd", VERSION, true, (reads) => reads.getIcdHtml()),
  /** SB2-33: every system net with its board nets, kept until the next connectivity's list arrives. */
  netMembers: () => read("net-members", ["nets"], true, (reads, signal) => reads.listSystemNetMembers(signal)),
  /** SB2-32: the system net a clicked board net belongs to (null: it stays on its board). */
  tracedNet: (occurrence: string, net: string) =>
    read(`trace:${occurrence}\n${net}`, ["nets"], false, (reads, signal) => reads.traceSystemNet(occurrence, net, signal)),
};
