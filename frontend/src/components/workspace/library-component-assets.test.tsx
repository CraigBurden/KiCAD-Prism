import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CatalogComponent } from "@/types/catalog";
import { AssetsPanel } from "./library-component-assets";

vi.mock("./catalog-client");
vi.mock("./library-preview-inspector", () => ({
  LibraryPreviewPair: ({ symbolAssetId, footprintAssetId }: { symbolAssetId?: string; footprintAssetId?: string }) => (
    <div data-testid="preview">{symbolAssetId}/{footprintAssetId}</div>
  ),
}));

const asset = (id: string, asset_type: string, required = true) => ({
  id, asset_type, required, name: `${id}.file`, target_library: "Lib", target_name: id, size_bytes: 2048, sha256: "a".repeat(64), content_type: "text/plain",
});

const component = {
  id: "comp-1",
  name: "LMT86DCKT",
  revision_id: "rev-6",
  released_revision_id: "rev-5",
  identity_kind: "mpn",
  validation: { enabled: true },
  assets: [asset("sym-a", "symbol"), asset("sym-b", "symbol"), asset("fp-a", "footprint"), asset("step", "3dmodel", false)],
  representations: [
    { id: "rep-1", label: "Default pair", is_default: true, display_order: 0, symbol: { id: "sym-a" }, footprint: { id: "fp-a" } },
    { id: "rep-2", label: "Alternate", is_default: false, display_order: 1, symbol: { id: "sym-b" }, footprint: { id: "fp-a" } },
  ],
} as unknown as CatalogComponent;

function renderPanel(canMutate = true) {
  return render(
    <AssetsPanel
      component={component}
      canMutate={canMutate}
      busyAction=""
      onAttach={vi.fn()}
      onDetachAsset={vi.fn()}
      onDownload={vi.fn()}
      onRegeneratePreviews={vi.fn()}
      onValidate={vi.fn()}
      onRepresentationsChanged={vi.fn()}
    />,
  );
}

describe("AssetsPanel", () => {
  it("lists files by type and marks an empty type missing", () => {
    renderPanel();
    expect(within(screen.getByRole("region", { name: "Symbols" })).getAllByText(/sym-[ab]\.file/)).toHaveLength(2);
    expect(within(screen.getByRole("region", { name: "SPICE models" })).getByText("Missing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download sym-a.file" })).toBeDisabled();
  });

  it("previews the default representation until another is picked", () => {
    renderPanel();
    expect(screen.getByTestId("preview")).toHaveTextContent("sym-a/fp-a");
    fireEvent.click(screen.getByRole("button", { name: "Preview Alternate" }));
    expect(screen.getByTestId("preview")).toHaveTextContent("sym-b/fp-a");
    expect(screen.getByText("Preview · Alternate")).toBeInTheDocument();
  });

  it("saves a representation only once it has been edited", () => {
    renderPanel();
    const save = screen.getByRole("button", { name: "Save Alternate" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getAllByRole("textbox", { name: "Representation label" })[1], { target: { value: "Alt" } });
    expect(save).toBeEnabled();
  });

  it("offers no edits to a reader", () => {
    renderPanel(false);
    expect(screen.queryByRole("button", { name: /Detach/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Symbols" })).not.toBeInTheDocument();
  });
});
