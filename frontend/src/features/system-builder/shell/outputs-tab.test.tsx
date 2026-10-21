/**
 * The header's Outputs button opens the ICD / Outputs tab (CONTRACTS §17):
 * the page wires it to `setView({ tab: "outputs" })`, which puts `tab=outputs`
 * in the URL.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { SessionState } from "../session/system-session";
import { SystemHeader } from "./system-header";
import { useSystemView } from "./system-view";

const STATE: SessionState = { bundleStale: false, saving: false, undoStack: [], redoStack: [] };

function Page() {
  const view = useSystemView();
  const location = useLocation();
  return (
    <>
      <SystemHeader
        name="Stack"
        folderId={null}
        version={1}
        state={STATE}
        canEdit={false}
        onUndo={() => undefined}
        onRedo={() => undefined}
        onOutputs={() => view.setView({ tab: "outputs" })}
      />
      <p data-testid="location">{location.search}</p>
    </>
  );
}

describe("Outputs header button", () => {
  it("opens the ICD / Outputs tab", () => {
    render(
      <MemoryRouter initialEntries={["/system/sys_a"]}>
        <Page />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Outputs" }));

    expect(screen.getByTestId("location").textContent).toBe("?tab=outputs");
  });
});
