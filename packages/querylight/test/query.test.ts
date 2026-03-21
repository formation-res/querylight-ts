import { describe, expect, it } from "vitest";
import {
  Analyzer,
  BoolQuery,
  BoostingQuery,
  DateFieldIndex,
  DisMaxQuery,
  DistanceFeatureQuery,
  DocumentIndex,
  ExistsQuery,
  MatchAll,
  MatchPhrase,
  MatchQuery,
  MultiMatchQuery,
  NgramTokenFilter,
  NumericFieldIndex,
  OP,
  PrefixQuery,
  RankFeatureQuery,
  RangeQuery,
  RankingAlgorithm,
  RegexpQuery,
  ScriptQuery,
  ScriptScoreQuery,
  TermQuery,
  TermsQuery,
  TextFieldIndex,
  VectorFieldIndex,
  VectorRescoreQuery,
  WildcardQuery,
  bigramVector,
  createSeededRandom
} from "../src/index";
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

  it("should support prefix queries directly", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["querylight"] } });
    index.index({ id: "2", fields: { title: ["query planner"] } });
    index.index({ id: "3", fields: { title: ["light query"] } });

    expect(index.searchRequest({ query: new PrefixQuery("title", "que") }).map(([id]) => id).sort()).toEqual(["1", "2", "3"]);

    const result = index.highlight("1", new PrefixQuery("title", "que"), { fields: ["title"] });
    expect(result.fields[0]?.fragments[0]?.spans[0]?.kind).toBe("prefix");
  });

  it("should require all terms for AND match queries", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["alpha beta"] } });
    index.index({ id: "2", fields: { title: ["alpha gamma"] } });

    expect(index.searchRequest({ query: new MatchQuery("title", "alpha beta", OP.AND) }).map(([id]) => id)).toEqual(["1"]);
  });

  it("should support exact any-of terms queries", () => {
    const index = new DocumentIndex({ tags: new TextFieldIndex() });
    index.index({ id: "1", fields: { tags: ["alpha"] } });
    index.index({ id: "2", fields: { tags: ["beta"] } });
    index.index({ id: "3", fields: { tags: ["gamma"] } });
    index.index({ id: "4", fields: { tags: ["alpha", "beta"] } });

    expect(index.searchRequest({ query: new TermsQuery("tags", ["alpha", "beta"]) }).map(([id]) => id).sort()).toEqual(["1", "2", "4"]);
  });

  it("should support wildcard term queries", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["querylight"] } });
    index.index({ id: "2", fields: { title: ["query planner"] } });
    index.index({ id: "3", fields: { title: ["light query"] } });
    index.index({ id: "4", fields: { title: ["vector search"] } });

    expect(index.searchRequest({ query: new WildcardQuery("title", "que*") }).map(([id]) => id).sort()).toEqual(["1", "2", "3"]);
  });

  it("should support regex term queries", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["querylight"] } });
    index.index({ id: "2", fields: { title: ["query planner"] } });
    index.index({ id: "3", fields: { title: ["light query"] } });
    index.index({ id: "4", fields: { title: ["vector search"] } });

    expect(index.searchRequest({ query: new RegexpQuery("title", "^quer") }).map(([id]) => id).sort()).toEqual(["1", "2", "3"]);
  });

  it("should support exists queries", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex(), tags: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["alpha"] } });
    index.index({ id: "2", fields: { title: ["beta"], tags: ["tagged"] } });
    index.index({ id: "3", fields: { title: ["gamma"], tags: [] } });

    expect(index.searchRequest({ query: new ExistsQuery("tags") }).map(([id]) => id)).toEqual(["2"]);
  });

  it("should support multi match queries across fields", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex(), body: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["querylight"], body: ["portable search toolkit"] } });
    index.index({ id: "2", fields: { title: ["portable toolkit"], body: ["querylight search"] } });
    index.index({ id: "3", fields: { title: ["portable"], body: ["nothing relevant"] } });

    expect(index.searchRequest({ query: new MultiMatchQuery(["title", "body"], "querylight portable") }).map(([id]) => id)).toEqual(["1", "2"]);
  });

  it("should prefer the best clause in dis max and blend with the tie breaker", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex(), body: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["alpha"], body: ["nothing"] } });
    index.index({ id: "2", fields: { title: ["alpha"], body: ["alpha"] } });

    const query = new DisMaxQuery([
      new TermQuery("title", "alpha", 2.0),
      new TermQuery("body", "alpha", 1.0)
    ], 0.5);

    expect(index.searchRequest({ query }).map(([id]) => id)).toEqual(["2", "1"]);
  });

  it("should demote negative matches in boosting queries", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex(), tags: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["alpha"], tags: ["featured"] } });
    index.index({ id: "2", fields: { title: ["alpha"], tags: ["deprecated"] } });

    const query = new BoostingQuery(
      new TermQuery("title", "alpha"),
      new TermQuery("tags", "deprecated"),
      0.2
    );

    expect(index.searchRequest({ query }).map(([id]) => id)).toEqual(["1", "2"]);
  });

  it("should support numeric ranges and distance features with numeric indexes", () => {
    const index = new DocumentIndex({ price: new NumericFieldIndex() });
    index.index({ id: "1", fields: { price: ["10"] } });
    index.index({ id: "2", fields: { price: ["15"] } });
    index.index({ id: "3", fields: { price: ["40"] } });

    expect(index.searchRequest({ query: new RangeQuery("price", { gte: "12", lt: "20" }) }).map(([id]) => id)).toEqual(["2"]);
    expect(index.searchRequest({ query: new DistanceFeatureQuery("price", 12, 10) }).map(([id]) => id)).toEqual(["1", "2", "3"]);
  });

  it("should support date distance features with date indexes", () => {
    const index = new DocumentIndex({ publishedAt: new DateFieldIndex() });
    index.index({ id: "1", fields: { publishedAt: ["2025-01-01T00:00:00.000Z"] } });
    index.index({ id: "2", fields: { publishedAt: ["2025-01-05T00:00:00.000Z"] } });
    index.index({ id: "3", fields: { publishedAt: ["2025-02-01T00:00:00.000Z"] } });

    expect(index.searchRequest({
      query: new DistanceFeatureQuery("publishedAt", "2025-01-04T00:00:00.000Z", 7 * 24 * 60 * 60 * 1000)
    }).map(([id]) => id)).toEqual(["2", "1", "3"]);
  });

  it("should support rank feature queries", () => {
    const index = new DocumentIndex({ popularity: new NumericFieldIndex() });
    index.index({ id: "1", fields: { popularity: ["5"] } });
    index.index({ id: "2", fields: { popularity: ["20"] } });
    index.index({ id: "3", fields: { popularity: ["50"] } });

    expect(index.searchRequest({ query: new RankFeatureQuery("popularity") }).map(([id]) => id)).toEqual(["3", "2", "1"]);
  });

  it("should support script queries", () => {
    const index = new DocumentIndex({ popularity: new NumericFieldIndex(), title: new TextFieldIndex() });
    index.index({ id: "1", fields: { popularity: ["5"], title: ["alpha"] } });
    index.index({ id: "2", fields: { popularity: ["20"], title: ["beta"] } });

    expect(index.searchRequest({
      query: new ScriptQuery(({ numericValue }) => (numericValue("popularity") ?? 0) >= 10)
    }).map(([id]) => id)).toEqual(["2"]);
  });

  it("should support script score queries", () => {
    const index = new DocumentIndex({ popularity: new NumericFieldIndex(), title: new TextFieldIndex() });
    index.index({ id: "1", fields: { popularity: ["5"], title: ["alpha alpha"] } });
    index.index({ id: "2", fields: { popularity: ["20"], title: ["alpha"] } });

    const query = new ScriptScoreQuery(
      new TermQuery("title", "alpha"),
      ({ score, numericValue }) => score * (numericValue("popularity") ?? 1)
    );

    expect(index.searchRequest({ query }).map(([id]) => id)).toEqual(["2", "1"]);
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

  it("should highlight fuzzy matches from ngram analyzers", () => {
    const fuzzyAnalyzer = new Analyzer(undefined, undefined, [new NgramTokenFilter(3)]);
    const index = new DocumentIndex({ title: new TextFieldIndex(fuzzyAnalyzer, fuzzyAnalyzer) });
    index.index({ id: "1", fields: { title: ["vector search"] } });

    const result = index.highlight("1", new MatchQuery("title", "vectro", OP.OR), { fields: ["title"] });

    expect(result.fields[0]?.fragments[0]?.parts.some((part) => part.highlighted && part.text.includes("vector"))).toBe(true);
    expect(result.fields[0]?.fragments[0]?.spans[0]?.kind).toBe("fuzzy");
  });

  it("should rescore only the top window similar to elasticsearch", () => {
    const index = new DocumentIndex({
      title: new TextFieldIndex(),
      embedding: new VectorFieldIndex(8, 36 * 36, createSeededRandom(42))
    });

    index.index({ id: "1", fields: { title: ["coffee guide guide guide"] } });
    index.index({ id: "2", fields: { title: ["coffee guide"] } });
    index.index({ id: "3", fields: { title: ["coffee guide"] } });

    (index.getFieldIndex("embedding") as VectorFieldIndex).insert("1", [bigramVector("coffee catalog archive")]);
    (index.getFieldIndex("embedding") as VectorFieldIndex).insert("2", [bigramVector("espresso brewing tutorial")]);
    (index.getFieldIndex("embedding") as VectorFieldIndex).insert("3", [bigramVector("espresso brewing tutorial")]);

    const baseQuery = new MatchQuery("title", "coffee guide");
    expect(index.search(baseQuery).map(([id]) => id)).toEqual(["1", "2", "3"]);

    const rescored = index.search(new VectorRescoreQuery(
      "embedding",
      bigramVector("espresso brewing tutorial"),
      baseQuery,
      { windowSize: 2 }
    ));

    expect(rescored.map(([id]) => id)).toEqual(["2", "1", "3"]);
  });
});
