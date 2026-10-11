import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { chooseOption } from "@/test/select";

import { listMates, listModels, saveModelAlignment } from "./catalog-client";
import { ModelsPanel, previewUrl } from "./library-component-models";

vi.mock("./catalog-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./catalog-client")>()),
  listMates: vi.fn(),
  listModels: vi.fn(),
  saveModelAlignment: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

const MODEL = {
  assetId: "ast_1", name: "PinHeader_1x04_P2.54mm_Vertical.step", stepSha256: "a".repeat(64),
  glb: { key: "b".repeat(64), converter: "geometer-2026.9.7", bounds: { minMm: [-1.27, -8.89, -3], maxMm: [1.27, 1.27, 8.54] }, materials: 2, sizeBytes: 53672 },
  alignment: { offsetMm: [0, 0, 0], rotationDeg: [0, 0, 0], scale: 1, updatedBy: null, updatedAt: null },
};

function fakeCatalog() {
  vi.mocked(listMates).mockResolvedValue({ items: [{ componentId: "cmp_socket", name: "Socket", mpn: "PS-104", manufacturer: "Test" }] });
  vi.mocked(listModels).mockResolvedValue({ items: [MODEL] } as never);
  vi.mocked(saveModelAlignment).mockImplementation(async (_, __, alignment) => (
    { items: [{ ...MODEL, alignment: { ...alignment, updatedBy: "a", updatedAt: "t" } }] } as never
  ));
}

describe("ModelsPanel", () => {
  it("shows the converted model and previews an unsaved alignment mated with a partner", async () => {
    fakeCatalog();
    render(<ModelsPanel componentId="cmp_plug" canMutate />);
    expect(await screen.findByText(/2.54 × 10.16 × 11.54 mm · 2 colours/)).toBeTruthy();
    const preview = () => screen.getByTestId("model-preview").getAttribute("src") ?? "";
    expect(preview()).toBe(previewUrl("cmp_plug", "ast_1", MODEL.alignment as never, "front", null));
    fireEvent.change(screen.getByLabelText("Offset Z"), { target: { value: "-8.54" } });
    await chooseOption("Preview mated with", "PS-104");
    await waitFor(() => expect(preview()).toContain("offset=0%2C0%2C-8.54"));
    expect(preview()).toContain("partner=cmp_socket");
    fireEvent.click(screen.getByRole("tab", { name: "Side" }));
    await waitFor(() => expect(preview()).toContain("view=side"));
    fireEvent.click(screen.getByRole("button", { name: "Save alignment" }));
    await waitFor(() => expect(saveModelAlignment).toHaveBeenCalledWith("cmp_plug", "ast_1",
      { offsetMm: [0, 0, -8.54], rotationDeg: [0, 0, 0], scale: 1 }));
  });

  it("lets viewers preview but not save", async () => {
    fakeCatalog();
    render(<ModelsPanel componentId="cmp_plug" canMutate={false} />);
    expect(await screen.findByTestId("model-preview")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save alignment" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Convert/ })).toBeNull();
  });
});
