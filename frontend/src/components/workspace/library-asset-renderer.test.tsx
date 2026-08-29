import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LibraryAssetRenderer } from "./library-asset-renderer";

const controller = () => ({
  zoomBy: vi.fn(),
  resetView: vi.fn(),
  setProbeHighlight: vi.fn(() => 1),
  clearProbeHighlight: vi.fn(),
});

type Handle = {
  controller: ReturnType<typeof controller>;
  dispose: ReturnType<typeof vi.fn>;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const renderer = vi.hoisted(() => ({
  parseSymbolLibrary: vi.fn((text: string) => [{ children: [], text }]),
  parseFootprint: vi.fn((text: string) => ({ text })),
  renderSymbol: vi.fn(),
  renderFootprint: vi.fn(),
}));

vi.mock("@/lib/ecad-renderer", () => ({
  assetContentUrl: (_source: string, assetId: string) => `/asset/${assetId}`,
  loadAssetText: (url: string) => Promise.resolve(url),
  loadEcadRenderer: () => Promise.resolve(renderer),
  symbolUnitCount: () => 1,
  symbolUnitLabel: (unit: number) => `Unit ${unit}`,
}));

describe("LibraryAssetRenderer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes the embedded camera contract to the renderer", async () => {
    const handle: Handle = { controller: controller(), dispose: vi.fn() };
    renderer.renderSymbol.mockResolvedValue(handle);

    const view = render(
      <LibraryAssetRenderer assetId="symbol-a" kind="symbol" label="Symbol" />,
    );

    await waitFor(() => expect(renderer.renderSymbol).toHaveBeenCalledTimes(1));
    expect(renderer.renderSymbol.mock.calls[0]?.[1]).toMatchObject({
      selectable: true,
      navigation: {
        wheel: "modifier",
        pinch: false,
        touchPan: false,
      },
    });
    view.unmount();
    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });

  it("disposes a superseded late handle without losing the current one", async () => {
    const first = deferred<Handle>();
    const second = deferred<Handle>();
    const firstHandle: Handle = { controller: controller(), dispose: vi.fn() };
    const secondHandle: Handle = { controller: controller(), dispose: vi.fn() };
    renderer.renderFootprint
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const view = render(
      <LibraryAssetRenderer
        assetId="footprint-a"
        kind="footprint"
        label="Footprint"
      />,
    );
    await waitFor(() =>
      expect(renderer.renderFootprint).toHaveBeenCalledTimes(1),
    );

    view.rerender(
      <LibraryAssetRenderer
        assetId="footprint-b"
        kind="footprint"
        label="Footprint"
      />,
    );
    await waitFor(() =>
      expect(renderer.renderFootprint).toHaveBeenCalledTimes(2),
    );

    await act(async () => second.resolve(secondHandle));
    await act(async () => first.resolve(firstHandle));

    expect(firstHandle.dispose).toHaveBeenCalledTimes(1);
    expect(secondHandle.dispose).not.toHaveBeenCalled();

    view.unmount();
    expect(secondHandle.dispose).toHaveBeenCalledTimes(1);
  });

  it("disposes every handle exactly once across twenty mount cycles", async () => {
    const handles = Array.from({ length: 20 }, () => ({
      controller: controller(),
      dispose: vi.fn(),
    }));
    renderer.renderSymbol.mockImplementation(async () => {
      const handle = handles[renderer.renderSymbol.mock.calls.length - 1];
      if (!handle) throw new Error("unexpected render");
      return handle;
    });

    for (let index = 0; index < handles.length; index += 1) {
      const view = render(
        <LibraryAssetRenderer
          assetId={`symbol-${index}`}
          kind="symbol"
          label="Symbol"
        />,
      );
      await waitFor(() =>
        expect(renderer.renderSymbol).toHaveBeenCalledTimes(index + 1),
      );
      view.unmount();
    }

    expect(
      handles.every((handle) => handle.dispose.mock.calls.length === 1),
    ).toBe(true);
  });
});
