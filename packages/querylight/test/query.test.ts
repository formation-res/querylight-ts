import { describe, expect, it } from "vitest";
import { BoolQuery, DocumentIndex, MatchAll, MatchPhrase, MatchQuery, OP, RankingAlgorithm, TextFieldIndex } from "../src/index";
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

  it("should require all terms for AND match queries", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["alpha beta"] } });
    index.index({ id: "2", fields: { title: ["alpha gamma"] } });

    expect(index.searchRequest({ query: new MatchQuery("title", "alpha beta", OP.AND) }).map(([id]) => id)).toEqual(["1"]);
  });

  it("should highlight exact term matches with source offsets", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["RangeQuery Over Lexical Fields"] } });

    const result = index.highlight("1", new MatchQuery("title", "rangequery"), { fields: ["title"] });

    expect(result.fields[0]?.fragments[0]?.parts.some((part) => part.highlighted)).toBe(true);
    expect(result.fields[0]?.fragments[0]?.text).toContain("RangeQuery");
  });

  it("should highlight phrase matches across the original source text", () => {
    const index = new DocumentIndex({ body: new TextFieldIndex() });
    index.index({ id: "1", fields: { body: ["Range filters work well for sortable values."] } });

    const result = index.highlight("1", new MatchPhrase("body", "range filters"), { fields: ["body"] });

    expect(result.fields[0]?.fragments[0]?.parts.filter((part) => part.highlighted).map((part) => part.text).join("")).toContain("Range filters");
  });
});
