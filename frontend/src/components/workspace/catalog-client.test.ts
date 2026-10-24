import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", async (importOriginal) => ({
  ifMatch: (await importOriginal<typeof import("@/lib/api")>()).ifMatch,
  fetchJson: vi.fn(async () => ({})),
  fetchBlob: vi.fn(async () => new Blob()),
}));

import { fetchBlob, fetchJson } from "@/lib/api";
import * as catalog from "./catalog-client";

// The wire format lives here, once. Component tests fake this module instead
// of routing URLs.

const signal = new AbortController().signal;

function lastCall() {
  const [url, init, fallback] = vi.mocked(fetchJson).mock.calls.at(-1) ?? [];
  const body = init?.body;
  return {
    url,
    method: init?.method ?? "GET",
    body: typeof body === "string" ? JSON.parse(body) : body,
    signal: init?.signal,
    ifMatch: (init?.headers as Record<string, string> | undefined)?.["If-Match"],
    fallback,
  };
}

beforeEach(() => vi.mocked(fetchJson).mockClear());

describe("catalog client", () => {
  it.each([
    ["getComponent", () => catalog.getComponent("a/b", signal), "/api/catalog/components/a%2Fb", "GET"],
    ["listComponents", () => catalog.listComponents(new URLSearchParams({ q: "r" }), signal), "/api/catalog/components?q=r", "GET"],
    ["getComponentRevision", () => catalog.getComponentRevision("c", "r1", signal), "/api/catalog/components/c/revisions/r1", "GET"],
    ["compareComponentRevisions", () => catalog.compareComponentRevisions("c", "r1", "r2", signal), "/api/catalog/components/c/revisions/compare?before=r1&after=r2", "GET"],
    ["listComponentAudit", () => catalog.listComponentAudit("c", signal), "/api/catalog/components/c/audit", "GET"],
    ["verifyComponentAudit", () => catalog.verifyComponentAudit("c", signal), "/api/catalog/components/c/audit/verify", "GET"],
    ["regenerateComponentPreviews", () => catalog.regenerateComponentPreviews("c"), "/api/catalog/components/c/previews/regenerate", "POST"],
    ["queueComponentValidation", () => catalog.queueComponentValidation("c", signal), "/api/catalog/components/c/validate", "POST"],
    ["getValidationJob", () => catalog.getValidationJob("j 1", signal), "/api/catalog/validation/jobs/j%201", "GET"],
    ["removeMate", () => catalog.removeMate("c", "m1"), "/api/catalog/components/c/mates-with/m1", "DELETE"],
    ["listMetadataFields", () => catalog.listMetadataFields(), "/api/catalog/metadata/fields", "GET"],
    ["listMetadataFields archived", () => catalog.listMetadataFields({ includeArchived: true }), "/api/catalog/metadata/fields?include_archived=true", "GET"],
    ["archiveMetadataField", () => catalog.archiveMetadataField("f1"), "/api/catalog/metadata/fields/f1/archive", "POST"],
    ["restoreMetadataField", () => catalog.restoreMetadataField("f1"), "/api/catalog/metadata/fields/f1/restore", "POST"],
    ["approveMetadataBatchFields", () => catalog.approveMetadataBatchFields("b1"), "/api/catalog/metadata/batches/b1/approve-fields", "POST"],
    ["getMetadataJob", () => catalog.getMetadataJob("j1"), "/api/catalog/metadata/jobs/j1", "GET"],
    ["getReleaseQueue", () => catalog.getReleaseQueue(new URLSearchParams({ page: "2" }), signal), "/api/catalog/release-queue?page=2", "GET"],
    ["getCatalogHealth", () => catalog.getCatalogHealth(), "/api/catalog/health", "GET"],
    ["getCatalogHealth with file check", () => catalog.getCatalogHealth({ checkFiles: true }), "/api/catalog/health?check_files=true", "GET"],
    ["listImportSessions", () => catalog.listImportSessions(signal), "/api/catalog/import-sessions", "GET"],
    ["listImportProposals", () => catalog.listImportProposals("s1", signal), "/api/catalog/import-sessions/s1/proposals", "GET"],
    ["listFolderImportRoots", () => catalog.listFolderImportRoots(), "/api/catalog/import-sources/folder-roots", "GET"],
  ])("%s requests the operation's URL", async (_, call, url, method) => {
    await call();
    expect(lastCall()).toMatchObject({ url, method });
  });

  it.each([
    ["createComponent", () => catalog.createComponent({ kind: "part" }), "/api/catalog/components", "POST", { kind: "part" }],
    ["releaseComponent unguarded", () => catalog.releaseComponent("c", { workflow_stage: "done" }), "/api/catalog/components/c/release", "POST", { workflow_stage: "done" }],
    ["addMate", () => catalog.addMate("c", "m1"), "/api/catalog/components/c/mates-with", "POST", { componentId: "m1" }],
    ["saveModelAlignment", () => catalog.saveModelAlignment("c", "a1", { scale: 1 }), "/api/catalog/components/c/models/a1/alignment", "PUT", { scale: 1 }],
    ["createMetadataField", () => catalog.createMetadataField({ key: "k" }), "/api/catalog/metadata/fields", "POST", { key: "k" }],
    ["updateMetadataField", () => catalog.updateMetadataField("f1", { key: "k" }), "/api/catalog/metadata/fields/f1", "PATCH", { key: "k" }],
    ["saveMetadataGridPreferences", () => catalog.saveMetadataGridPreferences({ visible: [], order: [], widths: {}, pinned: [] }), "/api/catalog/metadata/grid-preferences", "PUT", { visible: [], order: [], widths: {}, pinned: [] }],
    ["applyMetadataBatch", () => catalog.applyMetadataBatch("b1", ["i1"]), "/api/catalog/metadata/batches/b1/apply", "POST", { item_ids: ["i1"] }],
    ["createProjectImportSession", () => catalog.createProjectImportSession("project", "p1"), "/api/catalog/import-sessions/projects", "POST", { scope: "project", project_id: "p1" }],
    ["createFolderSnapshot", () => catalog.createFolderSnapshot("Libs"), "/api/catalog/import-snapshots/folders", "POST", { display_name: "Libs" }],
    ["discoverFolderSnapshot", () => catalog.discoverFolderSnapshot("s1", { files: [] }), "/api/catalog/import-snapshots/folders/s1/discover", "POST", { files: [] }],
    ["completeFolderSnapshot", () => catalog.completeFolderSnapshot("s1", { approved_component_ids: [] }), "/api/catalog/import-snapshots/folders/s1/complete", "POST", { approved_component_ids: [] }],
    ["importServerFolder", () => catalog.importServerFolder("cern", "sub"), "/api/catalog/import-snapshots/folders/server", "POST", { root_name: "cern", subpath: "sub" }],
    ["resolveImportProposal accept", () => catalog.resolveImportProposal("p1", "accept", { value: "v" }), "/api/catalog/import-proposals/p1/accept", "POST", { value: "v" }],
    ["resolveImportProposal reject", () => catalog.resolveImportProposal("p1", "reject"), "/api/catalog/import-proposals/p1/reject", "POST", undefined],
    ["saveProposalDrafts", () => catalog.saveProposalDrafts("s1", [{ id: "d" }]), "/api/catalog/import-sessions/s1/proposals/drafts", "PUT", { drafts: [{ id: "d" }] }],
    ["bulkAcceptProposals", () => catalog.bulkAcceptProposals("s1", [{ id: "i" }]), "/api/catalog/import-sessions/s1/proposals/bulk-accept", "POST", { items: [{ id: "i" }] }],
  ])("%s sends its JSON body", async (_, call, url, method, body) => {
    await call();
    expect(lastCall()).toMatchObject({ url, method, body });
  });

  it.each([
    ["patchComponent", () => catalog.patchComponent("c", { value: "1k" }, "r1"), "/api/catalog/components/c", "PATCH", { value: "1k" }],
    ["releaseComponent", () => catalog.releaseComponent("c", { workflow_stage: "done" }, "r1"), "/api/catalog/components/c/release", "POST", { workflow_stage: "done" }],
    ["linkComponentAsset", () => catalog.linkComponentAsset("c", "symbol", { file_path: "x" }, "r1"), "/api/catalog/components/c/assets/symbol/link", "POST", { file_path: "x" }],
    ["createRepresentation", () => catalog.createRepresentation("c", { label: "L" }, "r1"), "/api/catalog/components/c/representations", "POST", { label: "L" }],
    ["updateRepresentation", () => catalog.updateRepresentation("c", "p1", { label: "L" }, "r1"), "/api/catalog/components/c/representations/p1", "PATCH", { label: "L" }],
    ["detachComponentAsset", () => catalog.detachComponentAsset("c", "a1", "r1"), "/api/catalog/components/c/assets/id/a1", "DELETE", undefined],
    ["deleteRepresentation", () => catalog.deleteRepresentation("c", "p1", "r1"), "/api/catalog/components/c/representations/p1", "DELETE", undefined],
  ])("%s sends the component ETag as If-Match", async (_, call, url, method, body) => {
    await call();
    expect(lastCall()).toMatchObject({ url, method, body, ifMatch: '"component:c:r1"' });
  });

  it("passes the caller's signal through", async () => {
    await catalog.getComponent("c", signal);
    expect(lastCall().signal).toBe(signal);
  });

  it("keeps each call site's error fallback", async () => {
    await catalog.searchAssets("symbol", "r 1", 20, signal);
    expect(lastCall()).toMatchObject({
      url: "/api/catalog/assets/search?asset_type=symbol&limit=20&q=r%201",
      fallback: "Failed to search catalog assets",
    });
    await catalog.browseStoredAssets("3d model", "x", 50, signal);
    expect(lastCall()).toMatchObject({
      url: "/api/catalog/assets/browse?asset_type=3d%20model&limit=50&q=x",
      fallback: "Stored assets could not be listed.",
    });
    await catalog.saveProposalDrafts("s1", []);
    expect(lastCall().fallback).toBe("Failed to save import edits");
    await catalog.bulkAcceptProposals("s1", []);
    expect(lastCall().fallback).toBe("Failed to accept import rows");
  });

  it("routes asset imports by type", async () => {
    const form = new FormData();
    await catalog.importComponentAsset("c", "symbol", form, "r1");
    expect(lastCall()).toMatchObject({ url: "/api/catalog/components/c/symbol-import", method: "POST", body: form, ifMatch: '"component:c:r1"' });
    await catalog.importComponentAsset("c", "footprint", form);
    expect(lastCall().url).toBe("/api/catalog/components/c/footprint-import");
    await catalog.importComponentAsset("c", "3dmodel", form);
    expect(lastCall().url).toBe("/api/catalog/components/c/assets/3dmodel");
  });

  it("uploads files as forms", async () => {
    const file = new File(["x"], "R.kicad_sym");
    await catalog.uploadSnapshotFile("s1", "lib/R.kicad_sym", file, "Failed to upload R.kicad_sym");
    const upload = lastCall();
    expect(upload).toMatchObject({ url: "/api/catalog/import-snapshots/folders/s1/files", method: "POST", fallback: "Failed to upload R.kicad_sym" });
    expect((upload.body as FormData).get("relative_path")).toBe("lib/R.kicad_sym");

    await catalog.previewMetadataCsv(file, "Import metadata from R.csv");
    const preview = lastCall();
    expect(preview).toMatchObject({ url: "/api/catalog/metadata/import-csv/preview", fallback: "Failed to preview CSV" });
    expect((preview.body as FormData).get("change_summary")).toBe("Import metadata from R.csv");

    await catalog.importProposalsCsv("s1", file);
    expect(lastCall()).toMatchObject({ url: "/api/catalog/import-sessions/s1/proposals.csv", fallback: "Failed to import CSV" });
  });

  it("exports metadata as a blob with the chosen fields", async () => {
    await catalog.exportMetadataCsv(["value", "mpn"]);
    expect(fetchBlob).toHaveBeenCalledWith(
      "/api/catalog/metadata/export.csv?field=value&field=mpn",
      undefined,
      "Failed to export metadata",
    );
  });

  it("builds the URLs the browser fetches itself", () => {
    expect(catalog.catalogPreviewUrl("p 1")).toBe("/api/catalog/previews/p%201");
    expect(catalog.metadataBatchReportUrl("b1")).toBe("/api/catalog/metadata/batches/b1/report.csv");
    expect(catalog.importProposalsCsvUrl("s1")).toBe("/api/catalog/import-sessions/s1/proposals.csv");
    expect(catalog.modelPreviewUrl("c", "a1", new URLSearchParams({ view: "top" })))
      .toBe("/api/catalog/components/c/models/a1/preview.svg?view=top");
  });
});
