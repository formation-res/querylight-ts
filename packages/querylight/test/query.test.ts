import { describe, expect, it } from "vitest";
import { BoolQuery, MatchAll, MatchPhrase, MatchQuery, RankingAlgorithm } from "../src/index";
import { quotesIndex } from "./testfixture";

describe("queries", () => {
  it("should return docs", () => {
    Object.values(RankingAlgorithm).forEach((algorithm) => {
      const index = quotesIndex(algorithm);
      expect(index.searchRequest({ from: 0, limit: 3, query: new MatchAll() })).toHaveLength(3);
    });
  });

  it("should find shakespeare", () => {
    Object.values(RankingAlgorithm).forEach((algorithm) => {
      const index = quotesIndex(algorithm);
      expect(Object.keys(index.documents).length).toBeGreaterThan(0);
      const results = index.searchRequest({
        query: new BoolQuery([new MatchQuery("description", "to be")])
      });
      expect(results.length).toBeGreaterThan(0);
    });
  });

  it("should do phrase search", () => {
    Object.values(RankingAlgorithm).forEach((algorithm) => {
      const index = quotesIndex(algorithm);
      expect(index.searchRequest({ query: new MatchPhrase("description", "to be or not to be") })).toHaveLength(1);
    });
  });

  it("should boost things", () => {
    Object.values(RankingAlgorithm).forEach((algorithm) => {
      const index = quotesIndex(algorithm);
      const [id] = index.searchRequest({
        query: new BoolQuery([
          new MatchQuery("description", "to be", undefined, false, 0.5),
          new MatchQuery("description", "basic", undefined, false, 20.0)
        ])
      })[0]!;
      expect(index.get(id)?.fields.title?.[0].startsWith("Philip K. Dick")).toBe(true);
    });
  });

  it("should include prefixes", () => {
    Object.values(RankingAlgorithm).forEach((algorithm) => {
      const index = quotesIndex(algorithm);
      expect(index.searchRequest({ query: new MatchQuery("description", "ba") })).toHaveLength(0);
      expect(index.searchRequest({ query: new MatchQuery("description", "ba", undefined, true) }).length).toBeGreaterThan(0);
    });
  });
});
