/**
 * Each board's 3D bundle for the system's 3D tab (stage 3b): the project's
 * `webgpu-3d/status` at the occurrence's commit, asked again while any is
 * still building (and, slowly, while one is missing or failed). Boards
 * share an answer by project and commit.
 */
import { useEffect, useMemo, useState } from "react";

import { fetchJson } from "@/lib/api";

import type { SystemDocument } from "../model/types";
import { sceneMembers, type MemberAsset } from "./scene-descriptor";

/** How often to ask again while a board's 3D bundle is building, and while one is missing or failed (rebuilt elsewhere). */
const POLL_MS = 2000;
const IDLE_POLL_MS = 15000;

interface StatusAnswer {
  status: "ready" | "building" | "missing" | "invalid";
  bundle_url?: string;
}

export function memberAsset(answer: StatusAnswer | null): MemberAsset {
  if (!answer) return { status: "failed", bundleUrl: null };
  if (answer.status === "ready" && answer.bundle_url) return { status: "ready", bundleUrl: new URL(answer.bundle_url, window.location.href).toString() };
  if (answer.status === "building") return { status: "building", bundleUrl: null };
  return { status: answer.status === "invalid" ? "failed" : "missing", bundleUrl: null };
}

function sameAssets(current: ReadonlyMap<string, MemberAsset>, entries: readonly (readonly [string, MemberAsset])[]): boolean {
  return current.size === entries.length && entries.every(([key, asset]) => {
    const known = current.get(key);
    return known?.status === asset.status && known.bundleUrl === asset.bundleUrl;
  });
}

export function useMemberAssets(document: SystemDocument | undefined): ReadonlyMap<string, MemberAsset> {
  const members = useMemo(() => (document ? sceneMembers(document) : []), [document]);
  const membersKey = members.map((member) => member.key).join(" ");
  const [assets, setAssets] = useState<ReadonlyMap<string, MemberAsset>>(() => new Map());
  const [round, setRound] = useState(0);

  useEffect(() => {
    let live = true;
    const ask = async (member: (typeof members)[number]) => {
      const url = `/api/projects/${encodeURIComponent(member.projectId)}/webgpu-3d/status?commit=${encodeURIComponent(member.commit)}`;
      const answer = await fetchJson<StatusAnswer>(url, undefined, "Failed to read a board's 3D status").catch(() => null);
      return [member.key, memberAsset(answer)] as const;
    };
    void Promise.all(members.map(ask)).then((entries) => {
      if (!live) return;
      // An unchanged answer keeps the map, so the scene is not sent again.
      setAssets((current) => (sameAssets(current, entries) ? current : new Map(entries)));
      const building = entries.some(([, asset]) => asset.status === "building");
      if (building || entries.some(([, asset]) => asset.status !== "ready")) {
        window.setTimeout(() => {
          if (live) setRound((value) => value + 1);
        }, building ? POLL_MS : IDLE_POLL_MS);
      }
    });
    return () => {
      live = false;
    };
    // `membersKey` stands for `members`: ask again only when the boards change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membersKey, round]);

  return assets;
}
