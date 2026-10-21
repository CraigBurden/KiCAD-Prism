import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { forgetServerState } from "@/lib/server-state";

import type { SystemDocument } from "../model/types";
import { OutputsPane } from "./outputs-pane";

const DOCUMENT = {
  schema: "prism.system.v2",
  name: "Stack",
  harnesses: [{ id: "har_h", label: "H1" }],
} as unknown as SystemDocument;

const BUILDING = { state: "building", files: [], sheets: 0 };
const ICD_READY = {
  state: "ready",
  sheets: 2,
  files: [
    { name: "icd.pdf", title: "Interface control document", contentType: "application/pdf" },
    { name: "sheet-1.svg", title: "Sheet 1", contentType: "image/svg+xml" },
    { name: "sheet-2.svg", title: "Sheet 2", contentType: "image/svg+xml" },
    { name: "icd.html", title: "Interface control document (HTML)", contentType: "text/html" },
    { name: "icd.csv", title: "Interface control document rows", contentType: "text/csv" },
  ],
};
const HARNESS_READY = {
  state: "ready",
  sheets: 1,
  files: [{ name: "harness.pdf", title: "Harness drawing", contentType: "application/pdf" }],
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const sheet = (index: number) =>
  new Response(`<svg xmlns="http://www.w3.org/2000/svg"><text>Sheet ${index}</text></svg>`, {
    status: 200,
    headers: { "Content-Type": "image/svg+xml" },
  });

function stubFetch(icdAnswer: () => unknown, harnessAnswer: () => unknown) {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/icd")) return json(icdAnswer());
    if (url.endsWith("/harnesses/har_h/outputs")) return json(harnessAnswer());
    if (url.endsWith("/icd/sheet-1.svg")) return sheet(1);
    if (url.endsWith("/icd/sheet-2.svg")) return sheet(2);
    if (url.endsWith("/icd/icd.pdf")) {
      return new Response("%PDF-1.7", {
        status: 200,
        headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="stack-icd.pdf"' },
      });
    }
    return new Response("Not found", { status: 404 });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

const urls = (mock: ReturnType<typeof stubFetch>) => mock.mock.calls.map(([input]) => String(input));

beforeEach(() => {
  forgetServerState([]);
  URL.createObjectURL = vi.fn(() => "blob:sheet");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const pane = () => <OutputsPane systemId="sys_a" document={DOCUMENT} name="Stack" />;

const readText = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

describe("OutputsPane", () => {
  it("lists the ICD files, the document button and each harness's files", async () => {
    stubFetch(() => ICD_READY, () => HARNESS_READY);
    render(pane());

    expect(await screen.findByText("Interface control document (HTML)")).toBeTruthy();
    expect(screen.getByText("Interface control document rows")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download the system document as JSON" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "H1" })).toBeTruthy();
    expect(await screen.findByText("Harness drawing")).toBeTruthy();
    expect(screen.getByText("The STEP assembly arrives with stage 5b.")).toBeTruthy();
  });

  it("says the system is building, then shows the outputs after a poll", async () => {
    vi.useFakeTimers();
    let building = true;
    stubFetch(() => (building ? BUILDING : ICD_READY), () => (building ? BUILDING : HARNESS_READY));
    render(pane());

    await act(async () => undefined);
    expect(screen.getAllByText("The system is still building — outputs follow when it is ready").length).toBeGreaterThan(0);

    building = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByText("Interface control document (HTML)")).toBeTruthy();
    expect(screen.getByText("Harness drawing")).toBeTruthy();
  });

  it("requests sheet-1.svg, then sheet-2.svg when the next arrow is pressed", async () => {
    const mock = stubFetch(() => ICD_READY, () => HARNESS_READY);
    render(pane());

    expect(await screen.findByText("Sheet 1 of 2")).toBeTruthy();
    expect(urls(mock)).toContain("/api/systems/sys_a/icd/sheet-1.svg");

    fireEvent.click(screen.getByRole("button", { name: "Next sheet" }));

    expect(await screen.findByText("Sheet 2 of 2")).toBeTruthy();
    await waitFor(() => expect(urls(mock)).toContain("/api/systems/sys_a/icd/sheet-2.svg"));
  });

  it("saves the document as pretty-printed JSON under the system's name", async () => {
    stubFetch(() => ICD_READY, () => HARNESS_READY);
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:${blobs.length}`;
    });
    const downloaded: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloaded.push(this.download);
    });
    render(pane());

    fireEvent.click(await screen.findByRole("button", { name: "Download the system document as JSON" }));

    await waitFor(() => expect(downloaded).toEqual(["stack-system.json"]));
    const saved = blobs.find((blob) => blob.type === "application/json");
    expect(saved).toBeTruthy();
    expect(await readText(saved as Blob)).toBe(JSON.stringify(DOCUMENT, null, 2));
  });

  it("fetches a listed ICD file when its download button is pressed", async () => {
    const mock = stubFetch(() => ICD_READY, () => HARNESS_READY);
    render(pane());

    fireEvent.click(await screen.findByRole("button", { name: "Download Interface control document" }));

    await waitFor(() => expect(urls(mock)).toContain("/api/systems/sys_a/icd/icd.pdf"));
  });
});
