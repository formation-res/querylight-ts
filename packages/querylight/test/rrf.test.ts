import { describe, expect, it } from "vitest";
import { BoolQuery, DocumentIndex, GeoFieldIndex, GeoPolygonQuery, MatchQuery, TextFieldIndex, VectorFieldIndex, bigramVector, createSeededRandom, reciprocalRankFusion, rectangleToPolygon } from "../src/index";

describe("reciprocal rank fusion", () => {
  it("should promote documents that occur in both rankings", () => {
    const fused = reciprocalRankFusion([
      [
        ["doc-1", 10],
        ["doc-2", 5],
        ["doc-3", 1]
      ],
      [
        ["doc-2", 100],
        ["doc-4", 20],
        ["doc-1", 1]
      ]
    ], { rankConstant: 0 });

    expect(fused.map(([id]) => id)).toEqual(["doc-2", "doc-1", "doc-4", "doc-3"]);
  });

  it("should support weighting one ranking more heavily", () => {
    const fused = reciprocalRankFusion([
      [
        ["doc-1", 10],
        ["doc-2", 9]
      ],
      [
        ["doc-2", 50],
        ["doc-1", 1]
      ]
    ], { rankConstant: 0, weights: [1, 3] });

    expect(fused[0]?.[0]).toBe("doc-2");
  });

  it("should combine lexical and vector search results", () => {
    const textIndex = new DocumentIndex({ title: new TextFieldIndex() });
    const vectorIndex = new VectorFieldIndex(8, 36 * 36, createSeededRandom(42));
    const docs = [
      { id: "d1", fields: { title: ["filter coffee brewing guide"] } },
      { id: "d2", fields: { title: ["best cafes in berlin"] } },
      { id: "d3", fields: { title: ["geo search with bounding boxes"] } }
    ];

    docs.forEach((doc) => {
      textIndex.index(doc);
      vectorIndex.insert(doc.id, [bigramVector(doc.fields.title[0]!)]);
    });

    const lexical = textIndex.search(new MatchQuery("title", "coffee guide"));
    const vector = vectorIndex.query(bigramVector("cofee gide"), 3);
    const fused = reciprocalRankFusion([lexical, vector], { rankConstant: 20 });

    expect(fused[0]?.[0]).toBe("d1");
    expect(fused).toHaveLength(3);
  });

  it("should combine structured search with geo filters", () => {
    const index = new DocumentIndex({
      title: new TextFieldIndex(),
      location: new GeoFieldIndex()
    });

    index.index({
      id: "cafe-1",
      fields: {
        title: ["specialty coffee berlin mitte"],
        location: ['{"type":"Point","coordinates":[13.405,52.52]}']
      }
    });
    index.index({
      id: "cafe-2",
      fields: {
        title: ["specialty coffee potsdam"],
        location: ['{"type":"Point","coordinates":[13.06,52.4]}']
      }
    });
    index.index({
      id: "bakery-1",
      fields: {
        title: ["artisan bakery berlin mitte"],
        location: ['{"type":"Point","coordinates":[13.404,52.521]}']
      }
    });

    const lexical = index.search(new MatchQuery("title", "specialty coffee"));
    const geo = index.search(
      new GeoPolygonQuery("location", rectangleToPolygon(13.403, 52.519, 13.406, 52.522))
    );
    const fused = reciprocalRankFusion([lexical, geo], { rankConstant: 10 });

    expect(fused[0]?.[0]).toBe("cafe-1");
    expect(fused.map(([id]) => id)).toContain("bakery-1");
  });

  it("can be used after running separate constrained searches", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["vector search with filters"] } });
    index.index({ id: "2", fields: { title: ["vector search tutorial"] } });
    index.index({ id: "3", fields: { title: ["geo filters and faceting"] } });

    const broad = index.search(new MatchQuery("title", "vector search", undefined, false));
    const filtered = index.search(new BoolQuery([], [], [new MatchQuery("title", "filters")], [], undefined));
    const fused = reciprocalRankFusion([broad, filtered], { rankConstant: 5 });

    expect(fused[0]?.[0]).toBe("1");
  });
});
