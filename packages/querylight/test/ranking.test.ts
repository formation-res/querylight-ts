import { describe, expect, it } from "vitest";
import { DocumentIndex, MatchQuery, RankingAlgorithm, TextFieldIndex } from "../src/index";

function createDocs() {
  return [
    { id: "1", fields: { text: ["foo foo foo bar"] } },
    { id: "2", fields: { text: ["foo bar bar bar"] } },
    { id: "3", fields: { text: ["bar bar bar bar"] } }
  ];
}

function createIndex(algorithm: RankingAlgorithm): DocumentIndex {
  const index = new DocumentIndex({ text: new TextFieldIndex(undefined, undefined, algorithm) });
  createDocs().forEach((doc) => index.index(doc));
  return index;
}

describe("ranking", () => {
  it("should work for both algorithms", () => {
    const tfidf = createIndex(RankingAlgorithm.TFIDF);
    const bm25 = createIndex(RankingAlgorithm.BM25);
    expect(tfidf.search(new MatchQuery({ field: "text", text: "foo" }))[0]?.[0]).toBe("1");
    expect(bm25.search(new MatchQuery({ field: "text", text: "foo" }))[0]?.[0]).toBe("1");
  });

  it("bm25 scores should match lucene", () => {
    const bm25 = createIndex(RankingAlgorithm.BM25);
    const results = bm25.search(new MatchQuery({ field: "text", text: "foo" }));
    expect(results).toHaveLength(2);
    expect(results[0]?.[0]).toBe("1");
    expect(results[0]?.[1]).toBeCloseTo(0.7385771316718703, 6);
    expect(results[1]?.[0]).toBe("2");
    expect(results[1]?.[1]).toBeCloseTo(0.4700036292457356, 6);
  });
});
