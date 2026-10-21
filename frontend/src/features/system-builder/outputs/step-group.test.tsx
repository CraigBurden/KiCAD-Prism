import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "@/lib/api";
import { forgetServerState } from "@/lib/server-state";

import type { SystemStepAnswer } from "../model/types";
import { startStep, stepFile, stepState } from "../model/api";
import { StepGroup } from "./step-group";

vi.mock("../model/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../model/api")>();
  return { ...actual, stepState: vi.fn(), startStep: vi.fn(), stepFile: vi.fn() };
});

const NONE: SystemStepAnswer = { state: "none", boards: [], missing: [] };
const BUILDING: SystemStepAnswer = {
  state: "building",
  boards: [
    { occurrence: "occ_c", label: "Carrier", state: "ready", missingModels: 0, fallback: false },
    { occurrence: "occ_s", label: "SoM", state: "building", missingModels: 0, fallback: false },
  ],
  missing: [],
};
const READY: SystemStepAnswer = {
  state: "ready",
  boards: [
    { occurrence: "occ_c", label: "Carrier", state: "ready", missingModels: 2, fallback: true },
    { occurrence: "occ_s", label: "SoM", state: "ready", missingModels: 0, fallback: false },
  ],
  missing: ["Widget"],
  sizeBytes: 13_000_000,
};
const FAILED: SystemStepAnswer = {
  state: "failed",
  boards: [],
  missing: [],
  error: "kicad-cli could not export the carrier",
};

const mockedStepState = vi.mocked(stepState);
const mockedStartStep = vi.mocked(startStep);
const mockedStepFile = vi.mocked(stepFile);

beforeEach(() => {
  forgetServerState([]);
  mockedStepState.mockReset();
  mockedStartStep.mockReset();
  mockedStepFile.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:step");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const group = () => <StepGroup systemId="sys_a" name="Stack" />;

describe("StepGroup", () => {
  it("builds, shows each board, then the download and warnings after a poll", async () => {
    vi.useFakeTimers();
    let answer = NONE;
    mockedStepState.mockImplementation(async () => answer);
    mockedStartStep.mockImplementation(async () => (answer = BUILDING));
    render(group());

    await act(async () => undefined);
    expect(screen.getByRole("button", { name: "Build STEP" })).toBeTruthy();
    expect(
      screen.getByText("Boards from kicad-cli at their commits, parts from the catalog, harnesses as tubes"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Build STEP" }));
    await act(async () => undefined);

    expect(mockedStartStep).toHaveBeenCalledWith("sys_a");
    expect(screen.getByText("Building the STEP assembly…")).toBeTruthy();
    expect(screen.getByText("Carrier")).toBeTruthy();
    expect(screen.getByText("SoM")).toBeTruthy();
    expect(screen.getByText("building")).toBeTruthy();

    answer = READY;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByRole("button", { name: "Download stack.step" })).toBeTruthy();
    expect(screen.getByText("12.4 MB")).toBeTruthy();
    expect(screen.getByText("Carrier: 2 component models missing")).toBeTruthy();
    expect(screen.getByText("built from a plain checkout (submodules or LFS missing)")).toBeTruthy();
    expect(screen.getByText("Missing models: Widget")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rebuild" })).toBeTruthy();
  });

  it("downloads the STEP file under the system's name", async () => {
    mockedStepState.mockResolvedValue(READY);
    mockedStepFile.mockResolvedValue({
      blob: new Blob(["ISO-10303-21"], { type: "model/step" }),
      filename: "stack.step",
    });
    const downloaded: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloaded.push(this.download);
    });
    render(group());

    fireEvent.click(await screen.findByRole("button", { name: "Download stack.step" }));

    await waitFor(() => expect(mockedStepFile).toHaveBeenCalledWith("sys_a", "stack.step"));
    await waitFor(() => expect(downloaded).toEqual(["stack.step"]));
  });

  it("shows a failure and posts again from Rebuild", async () => {
    mockedStepState.mockResolvedValue(FAILED);
    mockedStartStep.mockResolvedValue(FAILED);
    render(group());

    expect(await screen.findByText("kicad-cli could not export the carrier")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rebuild" }));

    await waitFor(() => expect(mockedStartStep).toHaveBeenCalledWith("sys_a"));
  });

  it("says the assembly needs access to every board when the read is refused", async () => {
    mockedStepState.mockRejectedValue(new ApiHttpError(403, "The change touches a board you cannot see", "system_redacted"));
    render(group());

    expect(
      await screen.findByText("The STEP assembly needs access to every board in the system"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Build STEP" })).toBeNull();
  });

  it("says the system is still building when the POST is refused", async () => {
    mockedStepState.mockResolvedValue(NONE);
    mockedStartStep.mockRejectedValue(
      new ApiHttpError(409, "The system bundle is still building", "system_bundle_building"),
    );
    render(group());

    await act(async () => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Build STEP" }));

    expect(await screen.findByText("The system is still building")).toBeTruthy();
  });
});
