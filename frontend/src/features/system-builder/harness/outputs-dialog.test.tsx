import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OutputsDialog } from "./outputs-dialog";

const BUILDING = { state: "building", files: [], sheets: 0 };
const READY = {
  state: "ready",
  sheets: 2,
  files: [
    { name: "harness.pdf", title: "Harness drawing", contentType: "application/pdf" },
    { name: "wiring.csv", title: "Wiring table", contentType: "text/csv" },
  ],
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const sheet = (index: number) =>
  new Response(`<svg xmlns="http://www.w3.org/2000/svg"><text>Sheet ${index}</text></svg>`, {
    status: 200,
    headers: { "Content-Type": "image/svg+xml" },
  });

function stubFetch(answer: () => unknown) {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/outputs")) return json(answer());
    if (url.endsWith("/sheet-1.svg")) return sheet(1);
    if (url.endsWith("/sheet-2.svg")) return sheet(2);
    if (url.endsWith("/harness.pdf")) {
      return new Response("%PDF-1.7", {
        status: 200,
        headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="Stack-H1-harness.pdf"' },
      });
    }
    return new Response("Not found", { status: 404 });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

const urls = (mock: ReturnType<typeof stubFetch>) => mock.mock.calls.map(([input]) => String(input));

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:sheet");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const dialog = () => <OutputsDialog systemId="sys_a" harness="har_h" label="H1" onClose={() => undefined} />;

describe("OutputsDialog", () => {
  it("says the system is building, then shows the sheets after a re-fetch", async () => {
    vi.useFakeTimers();
    let building = true;
    stubFetch(() => (building ? BUILDING : READY));
    render(dialog());

    await act(async () => undefined);
    expect(screen.getByText("The system is still building — outputs follow when it is ready")).toBeTruthy();

    building = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByText("Sheet 1 of 2")).toBeTruthy();
  });

  it("loads sheet-2.svg when the next arrow is pressed", async () => {
    const mock = stubFetch(() => READY);
    render(dialog());

    expect(await screen.findByText("Sheet 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next sheet" }));

    expect(await screen.findByText("Sheet 2 of 2")).toBeTruthy();
    await waitFor(() => expect(urls(mock)).toContain("/api/systems/sys_a/harnesses/har_h/outputs/sheet-2.svg"));
  });

  it("requests a file by name when its download button is pressed", async () => {
    const mock = stubFetch(() => READY);
    render(dialog());

    expect(await screen.findByText("Sheet 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download Harness drawing" }));

    await waitFor(() => expect(urls(mock)).toContain("/api/systems/sys_a/harnesses/har_h/outputs/harness.pdf"));
  });
});
