import { describe, expect, it } from "vitest";
import { geometryContainsPoint, geometryIntersectsGeohash, geometryIntersectsPolygon, rectangleToPolygon } from "../src/geo";

describe("geo algorithms", () => {
  it("treats polygon holes as excluded areas", () => {
    const polygonWithHole = {
      type: "Polygon" as const,
      coordinates: [
        [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
        [[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]
      ]
    };

    expect(geometryContainsPoint(polygonWithHole, 0.5, 0.5)).toBe(true);
    expect(geometryContainsPoint(polygonWithHole, 2, 2)).toBe(false);
  });

  it("matches intersections across multipolygon members", () => {
    const multiPolygon = {
      type: "MultiPolygon" as const,
      coordinates: [
        rectangleToPolygon(0, 0, 1, 1),
        rectangleToPolygon(10, 10, 11, 11)
      ]
    };

    expect(geometryIntersectsPolygon(multiPolygon, rectangleToPolygon(10.2, 10.2, 10.8, 10.8))).toBe(true);
    expect(geometryIntersectsPolygon(multiPolygon, rectangleToPolygon(5, 5, 6, 6))).toBe(false);
  });

  it("rejects geohash intersections when geometry bounds are disjoint", () => {
    const berlin = { type: "Point" as const, coordinates: [13.405, 52.52] as [number, number] };

    expect(geometryIntersectsGeohash(berlin, "dr5r")).toBe(false);
  });
});
