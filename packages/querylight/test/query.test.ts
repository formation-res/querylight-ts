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
  it("should return docs", async () => {
    for (const algorithm of Object.values(RankingAlgorithm)) {
      const index = quotesIndex(algorithm);
      expect(await index.searchRequest({ from: 0, limit: 3, query: new MatchAll() })).toHaveLength(3);
    }
  });

  it("should find shakespeare", async () => {
    for (const algorithm of Object.values(RankingAlgorithm)) {
      const index = quotesIndex(algorithm);
      expect(Object.keys(index.documents).length).toBeGreaterThan(0);
      const results = await index.searchRequest({
        query: new BoolQuery({ should: [new MatchQuery({ field: "description", text: "to be" })] })
      });
      expect(results.length).toBeGreaterThan(0);
    }
  });

  it("should do phrase search", async () => {
    for (const algorithm of Object.values(RankingAlgorithm)) {
      const index = quotesIndex(algorithm);
      expect(await index.searchRequest({ query: new MatchPhrase({ field: "description", text: "to be or not to be" }) })).toHaveLength(1);
    }
  });

  it("should boost things", async () => {
    for (const algorithm of Object.values(RankingAlgorithm)) {
      const index = quotesIndex(algorithm);
      const [id] = (await index.searchRequest({
        query: new BoolQuery({
          should: [
            new MatchQuery({ field: "description", text: "to be", boost: 0.5 }),
            new MatchQuery({ field: "description", text: "basic", boost: 20.0 })
          ]
        })
      }))[0]!;
      expect(index.get(id)?.fields.title?.[0].startsWith("Philip K. Dick")).toBe(true);
    }
  });

  it("should include prefixes", async () => {
    for (const algorithm of Object.values(RankingAlgorithm)) {
      const index = quotesIndex(algorithm);
      expect(await index.searchRequest({ query: new MatchQuery({ field: "description", text: "ba" }) })).toHaveLength(0);
      expect((await index.searchRequest({ query: new MatchQuery({ field: "description", text: "ba", prefixMatch: true }) })).length).toBeGreaterThan(0);
    }
  });

  it("should support prefix queries directly", async () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["querylight"] } });
    index.index({ id: "2", fields: { title: ["query planner"] } });
    index.index({ id: "3", fields: { title: ["light query"] } });

    expect((await index.searchRequest({ query: new PrefixQuery({ field: "title", prefix: "que" }) })).map(([id]) => id).sort()).toEqual(["1", "2", "3"]);

    const result = index.highlight("1", new PrefixQuery({ field: "title", prefix: "que" }), { fields: ["title"] });
    expect(result.fields[0]?.fragments[0]?.spans[0]?.kind).toBe("prefix");
  });

  it("should require all terms for AND match queries", async () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["alpha beta"] } });
    index.index({ id: "2", fields: { title: ["alpha gamma"] } });

    expect((await index.searchRequest({ query: new MatchQuery({ field: "title", text: "alpha beta", operation: OP.AND }) })).map(([id]) => id)).toEqual(["1"]);
  });

  it("should support exact any-of terms queries", async () => {
    const index = new DocumentIndex({ tags: new TextFieldIndex() });
    index.index({ id: "1", fields: { tags: ["alpha"] } });
    index.index({ id: "2", fields: { tags: ["beta"] } });
    index.index({ id: "3", fields: { tags: ["gamma"] } });
    index.index({ id: "4", fields: { tags: ["alpha", "beta"] } });

    expect((await index.searchRequest({ query: new TermsQuery({ field: "tags", terms: ["alpha", "beta"] }) })).map(([id]) => id).sort()).toEqual(["1", "2", "4"]);
  });

  it("should support wildcard term queries", async () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["querylight"] } });
    index.index({ id: "2", fields: { title: ["query planner"] } });
    index.index({ id: "3", fields: { title: ["light query"] } });
    index.index({ id: "4", fields: { title: ["vector search"] } });

    expect((await index.searchRequest({ query: new WildcardQuery({ field: "title", pattern: "que*" }) })).map(([id]) => id).sort()).toEqual(["1", "2", "3"]);
  });

  it("should support regex term queries", async () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["querylight"] } });
    index.index({ id: "2", fields: { title: ["query planner"] } });
    index.index({ id: "3", fields: { title: ["light query"] } });
    index.index({ id: "4", fields: { title: ["vector search"] } });

    expect((await index.searchRequest({ query: new RegexpQuery({ field: "title", pattern: "^quer" }) })).map(([id]) => id).sort()).toEqual(["1", "2", "3"]);
  });

  it("should support exists queries", async () => {
    const index = new DocumentIndex({ title: new TextFieldIndex(), tags: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["alpha"] } });
    index.index({ id: "2", fields: { title: ["beta"], tags: ["tagged"] } });
    index.index({ id: "3", fields: { title: ["gamma"], tags: [] } });

    expect((await index.searchRequest({ query: new ExistsQuery({ field: "tags" }) })).map(([id]) => id)).toEqual(["2"]);
  });

  it("should support multi match queries across fields", async () => {
    const index = new DocumentIndex({ title: new TextFieldIndex(), body: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["querylight"], body: ["portable search toolkit"] } });
    index.index({ id: "2", fields: { title: ["portable toolkit"], body: ["querylight search"] } });
    index.index({ id: "3", fields: { title: ["portable"], body: ["nothing relevant"] } });

    expect((await index.searchRequest({ query: new MultiMatchQuery({ fields: ["title", "body"], text: "querylight portable" }) })).map(([id]) => id)).toEqual(["1", "2"]);
  });

  it("should prefer the best clause in dis max and blend with the tie breaker", async () => {
    const index = new DocumentIndex({ title: new TextFieldIndex(), body: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["alpha"], body: ["nothing"] } });
    index.index({ id: "2", fields: { title: ["alpha"], body: ["alpha"] } });

    const query = new DisMaxQuery({
      queries: [
        new TermQuery({ field: "title", text: "alpha", boost: 2.0 }),
        new TermQuery({ field: "body", text: "alpha", boost: 1.0 })
      ],
      tieBreaker: 0.5
    });

    expect((await index.searchRequest({ query })).map(([id]) => id)).toEqual(["2", "1"]);
  });

  it("should demote negative matches in boosting queries", async () => {
    const index = new DocumentIndex({ title: new TextFieldIndex(), tags: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["alpha"], tags: ["featured"] } });
    index.index({ id: "2", fields: { title: ["alpha"], tags: ["deprecated"] } });

    const query = new BoostingQuery({
      positive: new TermQuery({ field: "title", text: "alpha" }),
      negative: new TermQuery({ field: "tags", text: "deprecated" }),
      negativeBoost: 0.2
    });

    expect((await index.searchRequest({ query })).map(([id]) => id)).toEqual(["1", "2"]);
  });

  it("should support numeric ranges and distance features with numeric indexes", async () => {
    const index = new DocumentIndex({ price: new NumericFieldIndex() });
    index.index({ id: "1", fields: { price: ["10"] } });
    index.index({ id: "2", fields: { price: ["15"] } });
    index.index({ id: "3", fields: { price: ["40"] } });

    expect((await index.searchRequest({ query: new RangeQuery({ field: "price", range: { gte: "12", lt: "20" } }) })).map(([id]) => id)).toEqual(["2"]);
    expect((await index.searchRequest({ query: new DistanceFeatureQuery({ field: "price", origin: 12, pivot: 10 }) })).map(([id]) => id)).toEqual(["1", "2", "3"]);
  });

  it("should support date distance features with date indexes", async () => {
    const index = new DocumentIndex({ publishedAt: new DateFieldIndex() });
    index.index({ id: "1", fields: { publishedAt: ["2025-01-01T00:00:00.000Z"] } });
    index.index({ id: "2", fields: { publishedAt: ["2025-01-05T00:00:00.000Z"] } });
    index.index({ id: "3", fields: { publishedAt: ["2025-02-01T00:00:00.000Z"] } });

    expect((await index.searchRequest({
      query: new DistanceFeatureQuery({ field: "publishedAt", origin: "2025-01-04T00:00:00.000Z", pivot: 7 * 24 * 60 * 60 * 1000 })
    })).map(([id]) => id)).toEqual(["2", "1", "3"]);
  });

  it("should support rank feature queries", async () => {
    const index = new DocumentIndex({ popularity: new NumericFieldIndex() });
    index.index({ id: "1", fields: { popularity: ["5"] } });
    index.index({ id: "2", fields: { popularity: ["20"] } });
    index.index({ id: "3", fields: { popularity: ["50"] } });

    expect((await index.searchRequest({ query: new RankFeatureQuery({ field: "popularity" }) })).map(([id]) => id)).toEqual(["3", "2", "1"]);
  });

  it("should support script queries", async () => {
    const index = new DocumentIndex({ popularity: new NumericFieldIndex(), title: new TextFieldIndex() });
    index.index({ id: "1", fields: { popularity: ["5"], title: ["alpha"] } });
    index.index({ id: "2", fields: { popularity: ["20"], title: ["beta"] } });

    expect((await index.searchRequest({
      query: new ScriptQuery({ script: ({ numericValue }) => (numericValue("popularity") ?? 0) >= 10 })
    })).map(([id]) => id)).toEqual(["2"]);
  });

  it("should support script score queries", async () => {
    const index = new DocumentIndex({ popularity: new NumericFieldIndex(), title: new TextFieldIndex() });
    index.index({ id: "1", fields: { popularity: ["5"], title: ["alpha alpha"] } });
    index.index({ id: "2", fields: { popularity: ["20"], title: ["alpha"] } });

    const query = new ScriptScoreQuery({
      query: new TermQuery({ field: "title", text: "alpha" }),
      script: ({ score, numericValue }) => score * (numericValue("popularity") ?? 1)
    });

    expect((await index.searchRequest({ query })).map(([id]) => id)).toEqual(["2", "1"]);
  });

  it("should highlight exact term matches with source offsets", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["RangeQuery Over Lexical Fields"] } });

    const result = index.highlight("1", new MatchQuery({ field: "title", text: "rangequery" }), { fields: ["title"] });

    expect(result.fields[0]?.fragments[0]?.parts.some((part) => part.highlighted)).toBe(true);
    expect(result.fields[0]?.fragments[0]?.text).toContain("RangeQuery");
  });

  it("should highlight phrase matches across the original source text", () => {
    const index = new DocumentIndex({ body: new TextFieldIndex() });
    index.index({ id: "1", fields: { body: ["Range filters work well for sortable values."] } });

    const result = index.highlight("1", new MatchPhrase({ field: "body", text: "range filters" }), { fields: ["body"] });

    expect(result.fields[0]?.fragments[0]?.parts.filter((part) => part.highlighted).map((part) => part.text).join("")).toContain("Range filters");
  });

  it("should highlight fuzzy matches from ngram analyzers", () => {
    const fuzzyAnalyzer = new Analyzer(undefined, undefined, [new NgramTokenFilter(3)]);
    const index = new DocumentIndex({ title: new TextFieldIndex(fuzzyAnalyzer, fuzzyAnalyzer) });
    index.index({ id: "1", fields: { title: ["vector search"] } });

    const result = index.highlight("1", new MatchQuery({ field: "title", text: "vectro", operation: OP.OR }), { fields: ["title"] });

    expect(result.fields[0]?.fragments[0]?.parts.some((part) => part.highlighted && part.text.includes("vector"))).toBe(true);
    expect(result.fields[0]?.fragments[0]?.spans[0]?.kind).toBe("fuzzy");
  });

  it("should rescore only the top window similar to elasticsearch", async () => {
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

    const baseQuery = new MatchQuery({ field: "title", text: "coffee guide" });
    expect((await index.search(baseQuery)).map(([id]) => id)).toEqual(["1", "2", "3"]);

    const rescored = await index.search(new VectorRescoreQuery({
      field: "embedding",
      vector: bigramVector("espresso brewing tutorial"),
      query: baseQuery,
      options: { windowSize: 2 }
    }));

    expect(rescored.map(([id]) => id)).toEqual(["2", "1", "3"]);
  });

  it("should validate required object params", () => {
    expect(() => new MatchQuery({ text: "foo" } as never)).toThrow("field should be a string");
    expect(() => new TermQuery({ field: "title" } as never)).toThrow("text should be a string");
  });

  it("should keep default options when using value-object params", async () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    index.index({ id: "1", fields: { title: ["alpha beta"] } });
    index.index({ id: "2", fields: { title: ["alpha"] } });

    expect((await index.searchRequest({ query: new MatchQuery({ field: "title", text: "alpha beta" }) })).map(([id]) => id)).toEqual(["1"]);
  });
});
