import { describe, expect, it } from "vitest";
import { TermQuery, TextFieldIndex } from "../src/index";
import { quotesIndex } from "./testfixture";

describe("significant terms", () => {
  it("should calculate significant-term buckets", async () => {
    const index = quotesIndex();
    const tagsIndex = index.getFieldIndex("tags") as TextFieldIndex;
    for (const term of Object.keys(tagsIndex.termsAggregation(10))) {
      const hits = await index.searchRequest({ query: new TermQuery({ field: "tags", text: term }) });
      const ids = new Set(hits.map(([id]) => id));
      const buckets = (index.getFieldIndex("title") as TextFieldIndex).significantTermsAggregation(5, ids);
      expect(buckets.length).toBeGreaterThan(0);
      expect(buckets[0]).toMatchObject({
        key: expect.any(String),
        score: expect.any(Number),
        subsetDocCount: expect.any(Number),
        backgroundDocCount: expect.any(Number)
      });
    }
  });

  it("should sort buckets by descending significance score and preserve counts", () => {
    const index = new TextFieldIndex();

    index.indexValue("a", "apple");
    index.indexValue("a", "banana");
    index.indexValue("b", "apple");
    index.indexValue("c", "carrot");

    const buckets = index.significantTermsAggregation(10, new Set(["a", "b"]));

    expect(buckets).toEqual([
      {
        key: "apple",
        score: 1.5,
        subsetDocCount: 2,
        backgroundDocCount: 2
      },
      {
        key: "banana",
        score: 1.5,
        subsetDocCount: 1,
        backgroundDocCount: 1
      }
    ]);
    expect(buckets.map((bucket) => bucket.score)).toEqual([1.5, 1.5]);
  });
});
