import type { HarnessEnd, SystemDocument, SystemHarness, SystemInstance, SystemLink } from "@/types/system";

/**
 * SB2-99: lookups by id over a system document, built once per object and shared by every
 * component that reads them (no `Array.find` by id per row per render). Documents are replaced,
 * never mutated, so the object is the cache key. Findings are indexed in `findings.ts`.
 */
export interface DocumentIndex {
  instances: ReadonlyMap<string, SystemInstance>;
  links: ReadonlyMap<string, SystemLink>;
  harnesses: ReadonlyMap<string, SystemHarness>;
  /** Harness end id → the end and its harness. */
  ends: ReadonlyMap<string, { harness: SystemHarness; end: HarnessEnd }>;
}

const documents = new WeakMap<SystemDocument, DocumentIndex>();

export function documentIndex(document: SystemDocument): DocumentIndex {
  let index = documents.get(document);
  if (!index) {
    index = {
      instances: new Map(document.instances.map((instance) => [instance.id, instance])),
      links: new Map(document.links.map((link) => [link.id, link])),
      harnesses: new Map((document.harnesses ?? []).map((harness) => [harness.id, harness])),
      ends: new Map((document.harnesses ?? []).flatMap((harness) => harness.ends.map((end) => [end.id, { harness, end }] as const))),
    };
    documents.set(document, index);
  }
  return index;
}
