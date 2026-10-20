import { describe, expect, it } from "vitest";

import {
  PIN_SPACING_NM,
  SHEET_CORNER_NM,
  autoRoute,
  castAngle,
  clampOffset,
  defaultPorts,
  defaultSheetSize,
  dragSegment,
  followEnd,
  followEnds,
  portPoint,
  resize,
  routeMidpoint,
  selectionMode,
  simplifyRoute,
  slidePort,
  spreadAlongEdge,
} from "./geometry";

const MM = 1_000_000;
const mm = (value: number) => Math.round(value * MM);

describe("castAngle", () => {
  const size = { widthNm: mm(100), heightNm: mm(50) };

  it("sends the four directions to the four edges, +y up", () => {
    expect(castAngle(0, size)).toEqual({ edge: "right", offsetNm: mm(25) });
    expect(castAngle(90, size)).toEqual({ edge: "top", offsetNm: mm(50) });
    expect(castAngle(180, size)).toMatchObject({ edge: "left" });
    expect(castAngle(180, size).offsetNm).toBeCloseTo(mm(25));
    expect(castAngle(270, size).edge).toBe("bottom");
  });

  it("follows the aspect: a shallow angle on a wide sheet still meets the side edge", () => {
    expect(castAngle(20, size).edge).toBe("right");
    expect(castAngle(30, size).edge).toBe("top");
  });
});

describe("spreadAlongEdge", () => {
  it("keeps order, keeps the pin spacing and stays clear of both corners", () => {
    const length = mm(50.8);
    const out = spreadAlongEdge([mm(30), mm(30.1), mm(30.2), mm(49)], length, SHEET_CORNER_NM);
    for (let index = 1; index < out.length; index += 1) expect(out[index] - out[index - 1]).toBeGreaterThanOrEqual(PIN_SPACING_NM);
    expect(out[0]).toBeGreaterThanOrEqual(SHEET_CORNER_NM);
    expect(out[out.length - 1]).toBeLessThanOrEqual(length - SHEET_CORNER_NM);
    expect(out.every((offset) => offset % 2_540_000 === 0)).toBe(true);
  });

  it("pushes pins back from the far corner instead of off the edge", () => {
    const out = spreadAlongEdge([mm(49), mm(49.5), mm(50)], mm(50.8), SHEET_CORNER_NM);
    expect(out).toEqual([mm(30.48), mm(35.56), mm(40.64)]);
  });
});

describe("defaultSheetSize", () => {
  it("is a 50.8 mm square without an outline", () => {
    expect(defaultSheetSize(undefined, [])).toEqual({ widthNm: mm(50.8), heightNm: mm(50.8) });
  });

  it("takes the outline's aspect with the longer side 50.8 mm", () => {
    expect(defaultSheetSize({ widthNm: mm(100), heightNm: mm(50) }, [])).toEqual({ widthNm: mm(50.8), heightNm: mm(25.4) });
  });

  it("grows evenly until a crowded edge fits its pins", () => {
    const ports = ["J1", "J2", "J3", "J4"].map((key, index) => ({ key, angleDeg: -10 + index * 6 }));
    const size = defaultSheetSize({ widthNm: mm(100), heightNm: mm(50) }, ports);
    // Four pins on the right edge need 2 × 10.16 + 3 × 5.08 = 35.56 mm.
    expect(size.heightNm).toBe(mm(35.56));
    expect(size.widthNm).toBe(mm(71.12));
  });
});

describe("defaultPorts", () => {
  const size = { widthNm: mm(50.8), heightNm: mm(50.8) };

  it("places each connector by its angle and spreads neighbours apart", () => {
    const ports = defaultPorts([
      { key: "J1", angleDeg: 0 },
      { key: "J2", angleDeg: 1 },
      { key: "J3", angleDeg: 90 },
      { key: "J4", angleDeg: 180 },
      { key: "J5", angleDeg: 270 },
    ], size);
    expect(ports.J1.edge).toBe("right");
    expect(ports.J2.edge).toBe("right");
    // J2 is a degree above J1, so it is nearer the top: lower offset.
    expect(ports.J1.offsetNm - ports.J2.offsetNm).toBe(PIN_SPACING_NM);
    expect(ports.J3).toEqual({ edge: "top", offsetNm: mm(25.4) });
    expect(ports.J4.edge).toBe("left");
    expect(ports.J5.edge).toBe("bottom");
  });

  it("spreads connectors without a placement down the left edge in the order given", () => {
    const ports = defaultPorts([{ key: "J9" }, { key: "J10" }, { key: "J2" }], size);
    expect([ports.J9, ports.J10, ports.J2].map((port) => port.edge)).toEqual(["left", "left", "left"]);
    expect(ports.J10.offsetNm - ports.J9.offsetNm).toBe(PIN_SPACING_NM);
    expect(ports.J2.offsetNm - ports.J10.offsetNm).toBe(PIN_SPACING_NM);
  });
});

describe("portPoint and clampOffset", () => {
  it("clamps a stored offset past the edge back inside the corners", () => {
    const size = { widthNm: mm(50.8), heightNm: mm(50.8) };
    expect(clampOffset({ edge: "left", offsetNm: mm(80) }, size)).toBe(mm(50.8) - SHEET_CORNER_NM);
    expect(portPoint({ x: 0, y: 0 }, size, { edge: "bottom", offsetNm: mm(20.32) })).toEqual({ x: mm(20.32), y: mm(50.8) });
  });
});

describe("slidePort", () => {
  const origin = { x: 0, y: 0 };
  const size = { widthNm: mm(50.8), heightNm: mm(50.8) };

  it("snaps along the nearest edge to the pin grid", () => {
    expect(slidePort(origin, size, { x: mm(-3), y: mm(21.1) }, [])).toEqual({ edge: "left", offsetNm: mm(20.32) });
  });

  it("moves onto the next edge when dragged round a corner", () => {
    expect(slidePort(origin, size, { x: mm(30), y: mm(-2) }, [])).toEqual({ edge: "top", offsetNm: mm(30.48) });
  });

  it("stays clear of the corners", () => {
    expect(slidePort(origin, size, { x: mm(-1), y: mm(1) }, [])).toEqual({ edge: "left", offsetNm: SHEET_CORNER_NM });
  });

  it("refuses a spot another pin holds", () => {
    expect(slidePort(origin, size, { x: 0, y: mm(20.3) }, [{ edge: "left", offsetNm: mm(20.32) }])).toBeNull();
  });
});

describe("resize", () => {
  const rect = { x: 0, y: 0, w: mm(50.8), h: mm(50.8) };
  const ports = { J1: { edge: "top" as const, offsetNm: mm(30.48) }, J2: { edge: "left" as const, offsetNm: mm(20.32) } };

  it("stops shrinking where the furthest pin would leave the edge", () => {
    const out = resize(rect, "bottom-right", { x: mm(5), y: mm(5) }, ports);
    expect(out.rect.w).toBe(mm(30.48) + SHEET_CORNER_NM);
    expect(out.rect.h).toBe(mm(20.32) + SHEET_CORNER_NM);
    expect(out.ports).toEqual(ports);
  });

  it("keeps pins where they are on the sheet when the left edge moves", () => {
    const out = resize(rect, "top-left", { x: mm(-10.16), y: 0 }, ports);
    expect(out.rect).toEqual({ x: mm(-10.16), y: 0, w: mm(60.96), h: mm(50.8) });
    expect(out.ports.J1.offsetNm).toBe(mm(40.64));
    expect(out.ports.J2.offsetNm).toBe(mm(20.32));
  });

  it("stops the left edge before it passes a top pin's corner clearance", () => {
    const out = resize(rect, "bottom-left", { x: mm(40), y: mm(50.8) }, ports);
    expect(out.ports.J1.offsetNm).toBe(SHEET_CORNER_NM);
    expect(out.rect.x).toBe(mm(30.48) - SHEET_CORNER_NM);
  });
});

describe("routes", () => {
  it("joins two facing pins at one height with a straight run", () => {
    const route = autoRoute({ point: { x: 0, y: 0 }, edge: "right" }, { point: { x: mm(50.8), y: 0 }, edge: "left" });
    expect(route).toEqual([{ x: 0, y: 0 }, { x: mm(50.8), y: 0 }]);
  });

  it("bends at most twice and goes round a symbol in the way", () => {
    const blocker = { x: mm(20), y: mm(-20), w: mm(10), h: mm(30) };
    const route = autoRoute(
      { point: { x: 0, y: 0 }, edge: "right" },
      { point: { x: mm(50.8), y: mm(15.24) }, edge: "left" },
      [blocker],
    );
    expect(route.length).toBeLessThanOrEqual(6);
    for (let index = 1; index < route.length; index += 1) {
      const a = route[index - 1];
      const b = route[index];
      expect(a.x === b.x || a.y === b.y).toBe(true);
    }
    const crosses = route.some((point, index) => {
      if (index === 0) return false;
      const prev = route[index - 1];
      const minX = Math.min(prev.x, point.x);
      const maxX = Math.max(prev.x, point.x);
      const minY = Math.min(prev.y, point.y);
      const maxY = Math.max(prev.y, point.y);
      return maxX > blocker.x && minX < blocker.x + blocker.w && maxY > blocker.y && minY < blocker.y + blocker.h;
    });
    expect(crosses).toBe(false);
  });

  it("drops repeated points and merges collinear runs", () => {
    expect(simplifyRoute([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }])).toEqual([
      { x: 0, y: 0 },
      { x: 9, y: 0 },
      { x: 9, y: 4 },
    ]);
  });

  it("moves a middle segment across and keeps the pins' points", () => {
    const route = [{ x: 0, y: 0 }, { x: mm(10.16), y: 0 }, { x: mm(10.16), y: mm(20.32) }, { x: mm(30.48), y: mm(20.32) }];
    const moved = dragSegment(route, 1, { x: mm(15.24), y: mm(3) });
    expect(moved[0]).toEqual(route[0]);
    expect(moved[moved.length - 1]).toEqual(route[route.length - 1]);
    expect(moved).toContainEqual({ x: mm(15.24), y: 0 });
  });

  it("follows a moved pin, keeping the first segment's direction", () => {
    const route = [{ x: 0, y: 0 }, { x: mm(10.16), y: 0 }, { x: mm(10.16), y: mm(20.32) }, { x: mm(30.48), y: mm(20.32) }];
    expect(followEnd(route, "start", { x: mm(-5.08), y: mm(2.54) })).toEqual([
      { x: mm(-5.08), y: mm(2.54) },
      { x: mm(10.16), y: mm(2.54) },
      { x: mm(10.16), y: mm(20.32) },
      { x: mm(30.48), y: mm(20.32) },
    ]);
  });

  it("turns a straight two-point route into a Z when one end moves off line", () => {
    const moved = followEnd([{ x: 0, y: 0 }, { x: mm(20.32), y: 0 }], "end", { x: mm(20.32), y: mm(10.16) });
    expect(moved).toEqual([{ x: 0, y: 0 }, { x: mm(10.16), y: 0 }, { x: mm(10.16), y: mm(10.16) }, { x: mm(20.32), y: mm(10.16) }]);
  });

  it("moves a route whole when both ends moved together", () => {
    const route = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    expect(followEnds(route, { x: 5, y: 5 }, { x: 15, y: 15 })).toEqual([{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }]);
  });

  it("puts the mark on the longest segment", () => {
    expect(routeMidpoint([{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 40, y: 10 }]).point).toEqual({ x: 20, y: 10 });
  });
});

describe("selectionMode", () => {
  it("is a window left to right and a crossing right to left", () => {
    expect(selectionMode({ x: 0, y: 0 }, { x: 10, y: 10 })).toBe("window");
    expect(selectionMode({ x: 10, y: 10 }, { x: 0, y: 0 })).toBe("crossing");
  });
});
