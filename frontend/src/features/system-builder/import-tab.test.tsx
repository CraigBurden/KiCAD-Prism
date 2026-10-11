import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chooseOption, openSelect } from "@/test/select";

import { ImportTab } from "./import-tab";
import { boardValues, entrySide, missingTargets, suggestBoardMap, unmappedBoards } from "./import-model";
import { renderInSession } from "./session/memory-session";
import { instance, systemDocument } from "./test-fixtures";
import type { ImportUpload } from "@/types/system";

afterEach(() => vi.unstubAllGlobals());

const obc = instance("OBC-A");
const pwr = instance("PWR");
const secret = instance("SECRET", { restricted: true });
const doc = systemDocument([obc, pwr, secret]);

const upload: ImportUpload = {
  importId: "sim_1", filename: "wiring.csv", delimiter: ",", rowCount: 2,
  columns: ["From Board", "From Ref", "From Pin", "To Board", "To Ref", "To Pin"],
  sampleRows: [{ "From Board": "obc-a", "From Ref": "J2", "From Pin": "1", "To Board": "PWR", "To Ref": "J1", "To Pin": "1" }],
  suggestedColumnMap: { from_board: "From Board", from_connector: "From Ref", from_pin: "From Pin", to_board: "To Board", to_connector: "To Ref" },
  boardValues: { "From Board": ["HARNESS", "obc-a"], "To Board": ["PWR", "SECRET"] },
};

describe("import model", () => {
  it("collects board values from the mapped columns and suggests boards by label", () => {
    const values = boardValues(upload, upload.suggestedColumnMap);
    expect(values).toEqual(["HARNESS", "obc-a", "PWR", "SECRET"]);
    const map = suggestBoardMap(values, doc.instances);
    expect(map).toEqual({ "obc-a": obc.id, PWR: pwr.id });
    expect(unmappedBoards(values, map)).toEqual(["HARNESS", "SECRET"]);
    expect(missingTargets(upload.suggestedColumnMap)).toEqual(["To pin"]);
  });

  it("names a harness wire's sides by end, end pin and the pad it lands on", () => {
    const pad = { instanceId: pwr.id, label: "PWR", reference: "J3", portKey: "k", exposed: true, pin: "2", pinNames: null, nets: [] };
    const wire = { kind: "wire" as const, from: pad, to: null, fromEnd: 0, fromPin: "1", toEnd: 2, toPin: "4" };
    expect([entrySide(wire, "from"), entrySide(wire, "to")]).toEqual(["End 1.1 (PWR/J3.2)", "End 3.4 (not mated)"]);
    expect(entrySide({ from: pad, to: pad }, "to")).toBe("PWR/J3.2");
  });
});

describe("ImportTab", () => {
  it("walks upload → map → preview → commit with the same maps", async () => {
    const calls: [string, RequestInit][] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push([url, init]);
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
        status, headers: { "Content-Type": "application/json", ETag: '"sys:sys_1:3"' },
      });
      if (url.endsWith("/imports")) return json(upload, 201);
      const entry = { line: 2, values: { from_board: "obc-a", from_connector: "J2", from_pin: "1", to_board: "PWR", to_connector: "J1", to_pin: "1" },
        reason: null, from: null, to: null, signal: "VIN", harness: null, linkName: "", linkId: null, rowId: null, action: "create" };
      if (url.endsWith("/preview")) {
        return json({ importId: "sim_1", committed: false, counts: { matched: 1, needsReview: 0, unresolved: 0, conflict: 0 },
          matched: [entry], needsReview: [], unresolved: [], conflict: [] });
      }
      return json({ importId: "sim_1", created: 1, updated: 0, unchanged: 0, linksCreated: ["slk_1"], reviewId: null,
        counts: { matched: 1, needsReview: 0, unresolved: 0, conflict: 0 }, unresolved: [], conflict: [] });
    }));
    const { container, loads } = renderInSession(<ImportTab systemId="sys_1" document={doc} canEdit user={null} onNavigate={vi.fn()} />, { document: doc });

    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "wiring.csv", { type: "text/csv" })] } });
    fireEvent.click(screen.getByRole("button", { name: /Upload/ }));
    expect(await screen.findByText(/wiring.csv · 2 rows/)).toBeTruthy();
    expect(calls[0][1].body).toBeInstanceOf(FormData);

    const previewButton = screen.getByRole("button", { name: "Preview" }) as HTMLButtonElement;
    expect(previewButton.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("Map To pin");

    await chooseOption("Column for To pin", "To Pin");
    // A restricted board is never offered as a target.
    await openSelect("Board for HARNESS");
    expect(await screen.findByRole("option", { name: "OBC-A" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "SECRET" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Skip these rows" }));
    await chooseOption("Board for SECRET", "Skip these rows");
    expect(previewButton.disabled).toBe(false);
    fireEvent.click(previewButton);
    expect(await screen.findByText("create (new link)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Commit 1 row" }));
    expect(await screen.findByText("Import committed")).toBeTruthy();
    const commit = calls.find(([url]) => url.endsWith("/commit"))!;
    const preview = calls.find(([url]) => url.endsWith("/preview"))!;
    expect(new Headers(commit[1].headers).get("If-Match")).toBe(doc.system.etag);
    expect(JSON.parse(String(commit[1].body))).toEqual(JSON.parse(String(preview[1].body)));
    expect(JSON.parse(String(commit[1].body)).boardMap).toEqual({ "obc-a": obc.id, PWR: pwr.id, HARNESS: "skip", SECRET: "skip" });
    expect(loads()).toBe(1);
  });

  it("is closed to viewers", () => {
    renderInSession(<ImportTab systemId="sys_1" document={doc} canEdit={false} user={null} onNavigate={vi.fn()} />, { document: doc });
    expect(screen.getByText(/Only designers can import/)).toBeTruthy();
  });
});
