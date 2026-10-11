import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import { StaleSystemError } from "@/lib/systems-api";
import type { SystemDocument } from "@/types/system";

import { httpTransport, SystemSession, type EditName, type SystemTransport } from "./system-session";
import { SystemSessionProvider } from "./use-system-session";

/** Tests only. */
type Handler = (...args: never[]) => unknown;

export interface MemorySystem {
  transport: SystemTransport;
  /** Every edit and write the session made, in order, without the system and the ETag. */
  calls: { name: EditName; args: unknown[] }[];
  /** How many times the document was read. */
  loads: () => number;
  etag: () => string;
}

/**
 * An in-memory system for tests (AC-15): the document at a version, edits that answer 412 for any
 * ETag but the current one and move the version on, and `edits` to give an edit's result or change
 * the document. Reads not given in `reads` go to the HTTP client.
 */
export function memorySystem(document: SystemDocument, options: {
  edits?: Partial<Record<EditName, Handler>>;
  reads?: Partial<Record<keyof SystemTransport["reads"], Handler>>;
} = {}): MemorySystem {
  let version = document.system.version;
  let loads = 0;
  const calls: MemorySystem["calls"] = [];
  const etag = () => `"sys:${document.system.id}:${version}"`;
  const handle = async (name: EditName, args: unknown[]) => {
    calls.push({ name, args });
    return (options.edits?.[name] as ((...all: unknown[]) => unknown) | undefined)?.(...args);
  };
  const edits = Object.fromEntries(Object.keys(httpTransport.edits).map((name) => [name, async (_systemId: string, ifMatch: string, ...args: unknown[]) => {
    if (ifMatch !== etag()) throw new StaleSystemError("This system changed; reload it", etag());
    const body = await handle(name as EditName, args);
    version += 1;
    return { body, etag: etag() };
  }]));
  const writes = Object.fromEntries(Object.keys(httpTransport.writes).map((name) => [name,
    (_systemId: string, ...args: unknown[]) => handle(name as EditName, args)]));
  const reads = { ...httpTransport.reads, ...options.reads };
  const transport = {
    getSystem: async () => {
      loads += 1;
      return { body: { ...document, system: { ...document.system, version, etag: etag() } }, etag: etag() };
    },
    edits, writes, reads,
  } as unknown as SystemTransport;
  return { transport, calls, loads: () => loads, etag };
}

/**
 * Render `ui` inside a session holding `document`. Without a transport, edits and reads go to the
 * HTTP client (tests that stub `fetch`) and re-reads of the document return it unchanged.
 */
export function renderInSession(ui: ReactElement, { document, transport }: { document: SystemDocument; transport?: SystemTransport }):
  RenderResult & { session: SystemSession; loads: () => number } {
  let loads = 0;
  const given = transport ?? { ...httpTransport, getSystem: async () => {
    loads += 1;
    return { body: document, etag: document.system.etag };
  } };
  const counted: SystemTransport = transport ? { ...given, getSystem: (...args) => {
    loads += 1;
    return given.getSystem(...args);
  } } : given;
  const session = new SystemSession(document.system.id, counted, { document, etag: document.system.etag });
  const wrap = (element: ReactElement) => <SystemSessionProvider session={session}>{element}</SystemSessionProvider>;
  const result = render(wrap(ui));
  return { ...result, rerender: (next: ReactNode) => result.rerender(wrap(next as ReactElement)), session, loads: () => loads };
}
