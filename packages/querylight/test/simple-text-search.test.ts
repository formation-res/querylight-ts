import { describe, expect, it } from "vitest";
import { createSimpleTextSearchIndex, simpleTextSearch, RankingAlgorithm } from "../src/index";

type DemoDoc = {
  id: string;
  title: string;
  description: string;
  body: string;
  tags: string[];
};

const docs: DemoDoc[] = [
  {
    id: "range-filters",
    title: "RangeQuery Over Lexical Fields",
    description: "Use lexical ranges over sortable string values.",
    body: "RangeQuery compares lexical terms and supports range filters over string values.",
    tags: ["query", "range"]
  },
  {
    id: "testing-patterns",
    title: "Testing Patterns from the Repository",
    description: "The test suite documents expected ranking, query, vector, and geo behavior.",
    body: "Coverage includes range filters, phrase search, and retrieval behavior for examples.",
    tags: ["testing"]
  },
  {
    id: "prefix-search",
    title: "Aggregations and Prefix Search",
    description: "Prefix expansion is useful for short queries.",
    body: "Use prefix queries when users type incomplete search terms.",
    tags: ["prefix"]
  },
  {
    id: "serialization",
    title: "Index State Serialization",
    description: "Portable JSON index state for browser apps.",
    body: "Serialize and restore the in-memory index state.",
    tags: ["serialization"]
  }
];

function buildIndex() {
  return createSimpleTextSearchIndex({
    documents: docs,
    primaryFields: ["title"],
    secondaryFields: ["description", "body", "tags"],
    ranking: RankingAlgorithm.BM25
  });
}

describe("simple text search", () => {
  it("builds a beginner bundle and exposes the underlying document index", () => {
    const index = buildIndex();

    expect(index.documentIndex.get("range-filters")).toBeDefined();
    expect(index.documentsById.get("range-filters")?.title).toBe("RangeQuery Over Lexical Fields");
  });

  it("rejects documents with invalid ids", () => {
    expect(() =>
      createSimpleTextSearchIndex({
        documents: [{ id: 42, title: "bad", description: "bad" }] as unknown as Array<Record<string, unknown>>,
        primaryFields: ["title"],
        secondaryFields: ["description"]
      })
    ).toThrow("id field 'id' should be a non-empty string");
  });

  it("rejects unsupported field types", () => {
    expect(() =>
      createSimpleTextSearchIndex({
        documents: [{ id: "1", title: "bad", description: { nested: true } }] as unknown as Array<Record<string, unknown>>,
        primaryFields: ["title"],
        secondaryFields: ["description"]
      })
    ).toThrow("field 'description' should be a string or string[]");
  });

  it("prefers primary-field hits over secondary-only hits", async () => {
    const hits = await simpleTextSearch(buildIndex(), { query: "range" });

    expect(hits[0]?.[0]).toBe("range-filters");
  });

  it("supports prefix behavior through the beginner defaults", async () => {
    const hits = await simpleTextSearch(buildIndex(), { query: "agg" });

    expect(hits[0]?.[0]).toBe("prefix-search");
  });

  it("recovers typo-tolerant matches through the fuzzy branch", async () => {
    const hits = await simpleTextSearch(buildIndex(), { query: "seralization" });

    expect(hits[0]?.[0]).toBe("serialization");
  });

  it("makes quoted queries stricter than unquoted queries", async () => {
    const index = buildIndex();
    const quoted = await simpleTextSearch(index, { query: "\"range filters\"" });
    const unquoted = await simpleTextSearch(index, { query: "range filters" });

    expect(quoted.map(([id]) => id)).toContain("range-filters");
    expect(unquoted[0]?.[0]).toBe("range-filters");
  });

  it("respects from and limit", async () => {
    const hits = await simpleTextSearch(buildIndex(), { query: "search", from: 1, limit: 1 });

    expect(hits).toHaveLength(1);
  });
});
