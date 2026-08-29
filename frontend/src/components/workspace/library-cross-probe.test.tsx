import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ProbeEvent, RenderController } from "@/lib/ecad-renderer";

import {
  LibraryCrossProbeProvider,
  LibraryProbeBadge,
  useLibraryCrossProbe,
} from "./library-cross-probe";

function makeController(matches: Record<string, number>): RenderController {
  return {
    zoomBy: vi.fn(),
    resetView: vi.fn(),
    setProbeHighlight: vi.fn((index: string) => matches[index] ?? 0),
    clearProbeHighlight: vi.fn(),
  };
}

function RegisteredController({
  kind,
  controller,
}: {
  kind: "symbol" | "footprint";
  controller: RenderController;
}) {
  const probe = useLibraryCrossProbe();
  const register = probe?.register;
  useEffect(() => register?.(kind, controller), [kind, controller, register]);
  return null;
}

function ProbeButton({ label, event }: { label: string; event: ProbeEvent }) {
  const probe = useLibraryCrossProbe();
  return <button onClick={() => probe?.handleProbe(event)}>{label}</button>;
}

const pin = (
  phase: "hover" | "leave" | "activate",
  number: string,
): ProbeEvent => ({
  phase,
  source: "pin",
  number,
  index: `symbol_pin_${number}`,
  crossIndex: `footprint_pad_${number}`,
});

function Harness({
  symbol,
  footprints,
}: {
  symbol: RenderController;
  footprints: { id: string; controller: RenderController }[];
}) {
  return (
    <LibraryCrossProbeProvider resetKey="pair-a">
      <RegisteredController kind="symbol" controller={symbol} />
      {footprints.map(({ id, controller }) => (
        <RegisteredController
          key={id}
          kind="footprint"
          controller={controller}
        />
      ))}
      <LibraryProbeBadge />
      <ProbeButton label="latch one" event={pin("activate", "1")} />
      <ProbeButton label="hover two" event={pin("hover", "2")} />
      <ProbeButton label="leave two" event={pin("leave", "2")} />
      <ProbeButton label="hover missing" event={pin("hover", "9")} />
    </LibraryCrossProbeProvider>
  );
}

describe("LibraryCrossProbeProvider", () => {
  it("previews hover, restores the latch, and mirrors into every registered copy", async () => {
    const symbol = makeController({ symbol_pin_1: 1, symbol_pin_2: 1 });
    const footprintA = makeController({
      footprint_pad_1: 2,
      footprint_pad_2: 1,
    });
    const footprintB = makeController({
      footprint_pad_1: 1,
      footprint_pad_2: 3,
    });
    render(
      <Harness
        symbol={symbol}
        footprints={[
          { id: "embedded", controller: footprintA },
          { id: "expanded", controller: footprintB },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "latch one" }));
    expect(await screen.findByText("Pin 1 ↔ Pad 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "hover two" }));
    // Mirroring is part of the hover event itself. It must not wait for a
    // later React effect (or for the subsequent activate/click event).
    expect(footprintA.setProbeHighlight).toHaveBeenCalledWith(
      "footprint_pad_2",
      "hover",
    );
    expect(footprintB.setProbeHighlight).toHaveBeenCalledWith(
      "footprint_pad_2",
      "hover",
    );
    expect(await screen.findByText("Pin 2 ↔ Pad 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "leave two" }));
    expect(await screen.findByText("Pin 1 ↔ Pad 1")).toBeInTheDocument();
    await waitFor(() =>
      expect(footprintA.setProbeHighlight).toHaveBeenLastCalledWith(
        "footprint_pad_1",
        "latched",
      ),
    );
  });

  it("keeps only the source identity for a missing counterpart and clears on Escape", async () => {
    const symbol = makeController({ symbol_pin_9: 1 });
    const footprint = makeController({});
    render(
      <Harness
        symbol={symbol}
        footprints={[{ id: "embedded", controller: footprint }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "hover missing" }));
    expect(await screen.findByText("Pin 9")).toBeInTheDocument();
    expect(screen.queryByText(/Pad 9/)).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByText("Pin 9").closest("div")!, {
      key: "Escape",
    });
    await waitFor(() =>
      expect(screen.queryByText("Pin 9")).not.toBeInTheDocument(),
    );
    expect(symbol.clearProbeHighlight).toHaveBeenCalled();
    expect(footprint.clearProbeHighlight).toHaveBeenCalled();
  });
});
