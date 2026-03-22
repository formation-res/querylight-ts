import { describe, expect, it } from "vitest";
import {
  Analyzer,
  DateFieldIndex,
  DistanceFeatureQuery,
  DocumentIndex,
  MatchQuery,
  NgramTokenFilter,
  NumericFieldIndex,
  OP,
  RankFeatureQuery,
  RankingAlgorithm,
  RangeQuery,
  TextFieldIndex,
  type TextFieldIndexState
} from "../src/index";
import { quotesIndex, sampleObject, toDoc } from "./testfixture";

describe("index state serialization", () => {
  it("should load saved state and still work", () => {
    const originalIndex = quotesIndex();
    const originalCount = originalIndex.count();
    const state = originalIndex.indexState;
    const loadedIndex = originalIndex.loadState(state);
    const fieldState = loadedIndex.mapping.description?.indexState as TextFieldIndexState;
    expect(Object.keys(fieldState.reverseMap).length).not.toBe(0);
    expect(loadedIndex.count()).toBe(originalCount);
  });

  it("should preserve ranking settings", () => {
    const index = new DocumentIndex({
      title: new TextFieldIndex(undefined, undefined, RankingAlgorithm.BM25, { k1: 2.0, b: 0.6 }),
      description: new TextFieldIndex(undefined, undefined, RankingAlgorithm.BM25, { k1: 2.0, b: 0.6 })
    });

    [sampleObject("foo", "bar"), sampleObject("bar", "foo")].map(toDoc).forEach((doc) => index.index(doc));

    const loaded = index.loadState(index.indexState);
    const loadedField = loaded.mapping.title as TextFieldIndex;
    expect(loadedField.rankingAlgorithm).toBe(RankingAlgorithm.BM25);
    expect(loadedField.bm25Config.k1).toBe(2.0);
    expect(loadedField.bm25Config.b).toBe(0.6);
  });

  it("should preserve ngram-based matches after loading state", () => {
    const ngramAnalyzer = new Analyzer(undefined, undefined, [new NgramTokenFilter(3)]);
    const index = new DocumentIndex({
      combined: new TextFieldIndex(ngramAnalyzer, ngramAnalyzer, RankingAlgorithm.BM25)
    });

    index.index({
      id: "range-filters",
      fields: {
        combined: ["RangeQuery compares lexical terms and supports range filters over string values."]
      }
    });

    const loaded = index.loadState(index.indexState);

    expect(index.searchRequest({ query: new MatchQuery({ field: "combined", text: "range", operation: OP.OR }), limit: 10 }).map(([id]) => id)).toContain("range-filters");
    expect(loaded.searchRequest({ query: new MatchQuery({ field: "combined", text: "range", operation: OP.OR }), limit: 10 }).map(([id]) => id)).toContain("range-filters");
  });

  it("should preserve numeric and date indexes after loading state", () => {
    const index = new DocumentIndex({
      popularity: new NumericFieldIndex(),
      publishedAt: new DateFieldIndex()
    });

    index.index({
      id: "1",
      fields: {
        popularity: ["10"],
        publishedAt: ["2025-01-01T00:00:00.000Z"]
      }
    });
    index.index({
      id: "2",
      fields: {
        popularity: ["50"],
        publishedAt: ["2025-01-10T00:00:00.000Z"]
      }
    });

    const loaded = index.loadState(index.indexState);

    expect(loaded.searchRequest({ query: new RankFeatureQuery({ field: "popularity" }) }).map(([id]) => id)).toEqual(["2", "1"]);
    expect(loaded.searchRequest({ query: new RangeQuery({ field: "publishedAt", range: { gte: "2025-01-05T00:00:00.000Z" } }) }).map(([id]) => id)).toEqual(["2"]);
    expect(loaded.searchRequest({ query: new DistanceFeatureQuery({ field: "publishedAt", origin: "2025-01-08T00:00:00.000Z", pivot: 7 * 24 * 60 * 60 * 1000 }) }).map(([id]) => id)).toEqual(["2", "1"]);

    const loadedPopularity = loaded.getFieldIndex("popularity") as NumericFieldIndex;
    const loadedPublishedAt = loaded.getFieldIndex("publishedAt") as DateFieldIndex;
    expect(loadedPopularity.stats()).toEqual({
      count: 2,
      min: 10,
      max: 50,
      sum: 60,
      avg: 30
    });
    expect(loadedPopularity.histogram(25)).toEqual([
      { key: 0, docCount: 1 },
      { key: 50, docCount: 1 }
    ]);
    expect(loadedPublishedAt.dateHistogram(24 * 60 * 60 * 1000)).toEqual([
      {
        key: Date.parse("2025-01-01T00:00:00.000Z"),
        keyAsString: "2025-01-01T00:00:00.000Z",
        docCount: 1
      },
      {
        key: Date.parse("2025-01-10T00:00:00.000Z"),
        keyAsString: "2025-01-10T00:00:00.000Z",
        docCount: 1
      }
    ]);
  });
});
