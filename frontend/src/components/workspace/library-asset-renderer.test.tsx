import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LibraryAssetRenderer } from "./library-asset-renderer";

type Handle = { dispose: ReturnType<typeof vi.fn> };

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

  it("leaves pan and zoom to the shared preview viewport", async () => {
    const handle: Handle = { dispose: vi.fn() };
    renderer.renderSymbol.mockResolvedValue(handle);

    const view = render(
      <LibraryAssetRenderer assetId="symbol-a" kind="symbol" label="Symbol" />,
    );

    await waitFor(() => expect(renderer.renderSymbol).toHaveBeenCalledTimes(1));
    expect(renderer.renderSymbol.mock.calls[0]?.[1]).toMatchObject({
      interactive: false,
    });
    view.unmount();
    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });

  it("disposes a superseded late handle without losing the current one", async () => {
    const first = deferred<Handle>();
    const second = deferred<Handle>();
    const firstHandle: Handle = { dispose: vi.fn() };
    const secondHandle: Handle = { dispose: vi.fn() };
    renderer.renderFootprint
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const view = render(
      <LibraryAssetRenderer assetId="footprint-a" kind="footprint" label="Footprint" />,
    );
    await waitFor(() => expect(renderer.renderFootprint).toHaveBeenCalledTimes(1));

    view.rerender(
      <LibraryAssetRenderer assetId="footprint-b" kind="footprint" label="Footprint" />,
    );
    await waitFor(() => expect(renderer.renderFootprint).toHaveBeenCalledTimes(2));

    await act(async () => second.resolve(secondHandle));
    await act(async () => first.resolve(firstHandle));

    expect(firstHandle.dispose).toHaveBeenCalledTimes(1);
    expect(secondHandle.dispose).not.toHaveBeenCalled();

    view.unmount();
    expect(secondHandle.dispose).toHaveBeenCalledTimes(1);
  });
});
