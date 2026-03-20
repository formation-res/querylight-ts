import { describe, expect, it } from "vitest";
import { decodeGeohash, decodeGeohashBounds, encodeGeohash, geohashContains, geohashesForGeometry } from "../src/geo";

describe("geohash", () => {
  it("should encode known hashes", () => {
    expect(encodeGeohash(0.1, -0.1, 12)).toBe("ebpbtdpntc6e");
    expect(encodeGeohash(52.530888, 13.394904, 12)).toBe("u33dbfcyegk2");
  });

  it("should decode to the cell center", () => {
    const [lon, lat] = decodeGeohash("u33dbfcyegk2");
    expect(lat).toBeCloseTo(52.530888, 6);
    expect(lon).toBeCloseTo(13.394904, 6);
  });

  it("should contain the encoded coordinate in its bbox", () => {
    expect(geohashContains("ebpbtdpntc6e", 0.1, -0.1)).toBe(true);
    expect(geohashContains("ebpbtdpntc6e", -0.1, 0.1)).toBe(false);
  });

  it("should cover a bbox polygon with a small set", () => {
    const bbox = decodeGeohashBounds("u33db");
    const hashes = geohashesForGeometry(
      {
        type: "Polygon",
        coordinates: [[
          [bbox.minLon, bbox.minLat],
          [bbox.maxLon, bbox.minLat],
          [bbox.maxLon, bbox.maxLat],
          [bbox.minLon, bbox.maxLat],
          [bbox.minLon, bbox.minLat]
        ]]
      },
      5
    );
    expect(hashes.size).toBeLessThan(5);
    expect(hashes.has("u33db")).toBe(true);
  });
});
