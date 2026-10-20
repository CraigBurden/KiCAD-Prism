/**
 * What a placed published entry holds, for the 3D tab (stage 3d, CONTRACTS
 * §15.3): its frozen payload (`GET /api/catalog/system-entries/{revisionId}`,
 * §12.3), redacted for the reader's hidden boards. The entry draws as its
 * contents, one rigid group: its boards at their pinned commits and its bodies
 * with their parts' models, where the child's own placement put them.
 */
import { useEffect, useMemo, useState } from "react";

import { fetchJson } from "@/lib/api";

import type { SystemBundle, SystemDocument } from "../model/types";

type PartRef = { componentId: string; revisionId?: string | null };

/** The part of a published entry's payload the 3D tab reads. */
export interface EntryContents {
  document: SystemDocument;
  bundle: SystemBundle;
  /** The catalog parts the child was built from: each reference's resolved revision. */
  parts?: { parts: { ref: string; componentId: string; revisionId: string }[] };
}

/** The entry occurrences of a document, by occurrence id: their catalog revision. */
function entryRevisions(document: SystemDocument): [string, string][] {
  return document.occurrences.flatMap((item) => (item.source.kind === "entry" ? [[item.id, item.source.revisionId] as [string, string]] : []));
}

/** Each entry occurrence's contents; null while loading or when it cannot be read. */
export function useEntryContents(document: SystemDocument): ReadonlyMap<string, EntryContents | null> {
  const wanted = useMemo(() => entryRevisions(document), [document]);
  const wantedKey = wanted.map(([occurrence, revision]) => `${occurrence}=${revision}`).join(" ");
  const [contents, setContents] = useState<ReadonlyMap<string, EntryContents | null>>(() => new Map());

  useEffect(() => {
    let live = true;
    const read = async ([occurrence, revision]: [string, string]) => {
      const answer = await fetchJson<EntryContents>(`/api/catalog/system-entries/${encodeURIComponent(revision)}`, undefined, "Failed to read a published system")
        .catch(() => null);
      return [occurrence, answer] as const;
    };
    void Promise.all(wanted.map(read)).then((entries) => {
      if (live) setContents(new Map(entries));
    });
    return () => {
      live = false;
    };
    // `wantedKey` stands for `wanted`: read again only when the entries change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey]);
  return contents;
}

/** A part reference inside an entry, pinned to the revision the child was built from. */
export function frozenPartRef(contents: EntryContents, ref: PartRef): PartRef {
  const key = ref.revisionId ? `${ref.componentId}@${ref.revisionId}` : ref.componentId;
  const resolved = contents.parts?.parts.find((part) => part.ref === key);
  return resolved ? { componentId: resolved.componentId, revisionId: resolved.revisionId } : ref;
}

/** Every catalog part an entry's bodies and their connectors name, pinned. */
export function entryPartRefs(contents: EntryContents): PartRef[] {
  return [
    ...contents.document.occurrences.flatMap((item) => (item.source.kind === "body" ? [frozenPartRef(contents, item.source)] : [])),
    ...(contents.document.bodyConnectors ?? []).map((item) => frozenPartRef(contents, item.part)),
  ];
}
