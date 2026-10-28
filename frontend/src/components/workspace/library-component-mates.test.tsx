import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addMate, listComponents, listMates, removeMate } from "./catalog-client";
import { MatesWithPanel, type MatingPart } from "./library-component-mates";

vi.mock("./catalog-client");

const socket = { componentId: "cmp_socket", name: "Socket", mpn: "ADF6-30", manufacturer: "Samtec" };
const housing = { componentId: "cmp_housing", name: "Housing", mpn: "PHR-4", manufacturer: "JST" };

function fakeCatalog(initial: MatingPart[] = [socket]) {
  let mates = [...initial];
  vi.mocked(listMates).mockImplementation(async () => ({ items: mates }));
  vi.mocked(listComponents).mockResolvedValue({ total: 2, page: 1, page_size: 8, pages: 1, items: [
    { id: "cmp_plug", mpn: "ADM6-30", manufacturer: "Samtec", value: "Plug", description: "" },
    { id: "cmp_housing", mpn: "PHR-4", manufacturer: "JST", value: "Housing", description: "" },
  ] } as never);
  vi.mocked(addMate).mockImplementation(async () => {
    mates = [...mates, housing];
    return { items: mates };
  });
  vi.mocked(removeMate).mockImplementation(async (_, partner) => {
    mates = mates.filter((m) => m.componentId !== partner);
    return { items: mates };
  });
}

beforeEach(() => vi.clearAllMocks());

describe("MatesWithPanel", () => {
  it("lists partners and lets a writer add and remove them", async () => {
    fakeCatalog();
    render(<MatesWithPanel componentId="cmp_plug" canMutate />);
    expect(await screen.findByText("ADF6-30")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Find a mating part"), { target: { value: "PH" } });
    fireEvent.click(await screen.findByRole("button", { name: "Add PHR-4" }));
    await waitFor(() => expect(screen.getByText("PHR-4")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Add ADM6-30" })).toBeNull(); // the part itself is never offered
    expect(addMate).toHaveBeenCalledWith("cmp_plug", "cmp_housing");
    fireEvent.click(screen.getByRole("button", { name: "Remove ADF6-30" }));
    await waitFor(() => expect(screen.queryByText("ADF6-30")).toBeNull());
    expect(removeMate).toHaveBeenCalledWith("cmp_plug", "cmp_socket");
  });

  it("is read-only for viewers", async () => {
    fakeCatalog();
    render(<MatesWithPanel componentId="cmp_plug" canMutate={false} />);
    expect(await screen.findByText("ADF6-30")).toBeTruthy();
    expect(screen.queryByLabelText("Find a mating part")).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });
});
