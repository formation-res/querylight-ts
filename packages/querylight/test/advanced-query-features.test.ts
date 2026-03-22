import { describe, expect, it } from "vitest";
import {
  BoostingQuery,
  DateFieldIndex,
  DisMaxQuery,
  DistanceFeatureQuery,
  DocumentIndex,
  MatchAll,
  NumericFieldIndex,
  RankFeatureQuery,
  RangeQuery,
  RegexpQuery,
  ScriptQuery,
  ScriptScoreQuery,
  TermQuery,
  TextFieldIndex,
  WildcardQuery
} from "../src/index";

describe("advanced query features", () => {
  it("should validate dis max tie breaker values", () => {
    expect(() => new DisMaxQuery({ queries: [], tieBreaker: -0.1 })).toThrow();
    expect(() => new DisMaxQuery({ queries: [], tieBreaker: 1.1 })).toThrow();
  });

  it("should validate boosting negative boost values", () => {
    expect(() => new BoostingQuery({ positive: new MatchAll(), negative: new MatchAll(), negativeBoost: 0 })).toThrow();
    expect(() => new BoostingQuery({ positive: new MatchAll(), negative: new MatchAll(), negativeBoost: 1.1 })).toThrow();
  });

  it("should validate distance feature parameters", () => {
    expect(() => new DistanceFeatureQuery({ field: "publishedAt", origin: "not-a-date", pivot: 10 })).toThrow();
    expect(() => new DistanceFeatureQuery({ field: "publishedAt", origin: "2025-01-01T00:00:00.000Z", pivot: 0 })).toThrow();
  });

  it("should support question mark wildcards", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["cat"] } });
    index.index({ id: "2", fields: { title: ["cot"] } });
    index.index({ id: "3", fields: { title: ["coat"] } });

    expect(index.searchRequest({ query: new WildcardQuery({ field: "title", pattern: "c?t" }) }).map(([id]) => id).sort()).toEqual(["1", "2"]);
  });

  it("should support regex objects without global-state issues", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["querylight"] } });
    index.index({ id: "2", fields: { title: ["query planner"] } });

    const query = new RegexpQuery({ field: "title", pattern: /^query/g });
    expect(index.searchRequest({ query }).map(([id]) => id).sort()).toEqual(["1", "2"]);
    expect(index.searchRequest({ query }).map(([id]) => id).sort()).toEqual(["1", "2"]);
  });

  it("should return positive hits only for boosting queries", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex(), tags: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["alpha"], tags: ["deprecated"] } });
    index.index({ id: "2", fields: { title: ["beta"], tags: ["deprecated"] } });

    const query = new BoostingQuery({
      positive: new TermQuery({ field: "title", text: "alpha" }),
      negative: new TermQuery({ field: "tags", text: "deprecated" }),
      negativeBoost: 0.5
    });

    expect(index.searchRequest({ query }).map(([id]) => id)).toEqual(["1"]);
  });

  it("should support multiple numeric values per document for rank and distance features", () => {
    const index = new DocumentIndex({ feature: new NumericFieldIndex() });
    index.index({ id: "1", fields: { feature: ["1", "8"] } });
    index.index({ id: "2", fields: { feature: ["6"] } });
    index.index({ id: "3", fields: { feature: ["20"] } });

    expect(index.searchRequest({ query: new RankFeatureQuery({ field: "feature" }) }).map(([id]) => id)).toEqual(["3", "1", "2"]);
    expect(index.searchRequest({ query: new DistanceFeatureQuery({ field: "feature", origin: 7, pivot: 5 }) }).map(([id]) => id)).toEqual(["1", "2", "3"]);
  });

  it("should support numeric and date range queries on dedicated indexes", () => {
    const index = new DocumentIndex({
      price: new NumericFieldIndex(),
      publishedAt: new DateFieldIndex()
    });
    index.index({ id: "1", fields: { price: ["9"], publishedAt: ["2025-01-01T00:00:00.000Z"] } });
    index.index({ id: "2", fields: { price: ["15"], publishedAt: ["2025-01-10T00:00:00.000Z"] } });
    index.index({ id: "3", fields: { price: ["25"], publishedAt: ["2025-02-01T00:00:00.000Z"] } });

    expect(index.searchRequest({ query: new RangeQuery({ field: "price", range: { gte: "10", lt: "20" } }) }).map(([id]) => id)).toEqual(["2"]);
    expect(index.searchRequest({
      query: new RangeQuery({ field: "publishedAt", range: { gte: "2025-01-05T00:00:00.000Z", lt: "2025-01-20T00:00:00.000Z" } })
    }).map(([id]) => id)).toEqual(["2"]);
  });

  it("should support alternate rank feature modes", () => {
    const index = new DocumentIndex({ popularity: new NumericFieldIndex() });
    index.index({ id: "1", fields: { popularity: ["2"] } });
    index.index({ id: "2", fields: { popularity: ["10"] } });
    index.index({ id: "3", fields: { popularity: ["50"] } });

    expect(index.searchRequest({ query: new RankFeatureQuery({ field: "popularity", options: { type: "log", scalingFactor: 1 } }) }).map(([id]) => id)).toEqual(["3", "2", "1"]);
    expect(index.searchRequest({ query: new RankFeatureQuery({ field: "popularity", options: { type: "sigmoid", pivot: 10, exponent: 2 } }) }).map(([id]) => id)).toEqual(["3", "2", "1"]);
    expect(index.searchRequest({ query: new RankFeatureQuery({ field: "popularity", options: { type: "linear", factor: 0.5 } }) }).map(([id]) => id)).toEqual(["3", "2", "1"]);
  });

  it("should expose index-backed numeric helpers to scripts", () => {
    const index = new DocumentIndex({ popularity: new NumericFieldIndex(), title: new TextFieldIndex() });
    index.index({ id: "1", fields: { popularity: ["5"], title: ["alpha"] } });
    index.index({ id: "2", fields: { popularity: ["20"], title: ["alpha"] } });

    const filtered = index.searchRequest({
      query: new ScriptQuery({ script: ({ numericValues }) => numericValues("popularity").some((value) => value >= 10) })
    });
    expect(filtered.map(([id]) => id)).toEqual(["2"]);

    const rescored = index.searchRequest({
      query: new ScriptScoreQuery({
        query: new TermQuery({ field: "title", text: "alpha" }),
        script: ({ score, numericValues }) => score + numericValues("popularity").reduce((sum, value) => sum + value, 0)
      })
    });
    expect(rescored.map(([id]) => id)).toEqual(["2", "1"]);
  });
});
