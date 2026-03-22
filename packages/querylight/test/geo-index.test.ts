import { describe, expect, it } from "vitest";
import { DocumentIndex, GeoFieldIndex, GeoPointQuery, GeoPolygonQuery, rectangleToPolygon } from "../src/index";

describe("geo index", () => {
  it("test geo queries", () => {
    const geoIndex = new GeoFieldIndex();
    const index = new DocumentIndex({ loc: geoIndex });
    index.index({ id: "berlin", fields: { loc: [JSON.stringify({ type: "Point", coordinates: [13.4, 52.5] })] } });
    index.index({ id: "paris", fields: { loc: [JSON.stringify({ type: "Point", coordinates: [2.35, 48.85] })] } });

    expect(index.searchRequest({ query: new GeoPointQuery({ field: "loc", latitude: 52.5, longitude: 13.4 }) }).map(([id]) => id)).toContain("berlin");
    expect(index.searchRequest({ query: new GeoPolygonQuery({ field: "loc", polygon: rectangleToPolygon(12.0, 52.0, 14.0, 53.0) }) }).map(([id]) => id)).toEqual(["berlin"]);
  });
});
