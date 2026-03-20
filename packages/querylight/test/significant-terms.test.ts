import { describe, expect, it } from "vitest";
import { TermQuery, TextFieldIndex } from "../src/index";
import { quotesIndex } from "./testfixture";

describe("significant terms", () => {
  it("should calculate most significant terms", () => {
    const index = quotesIndex();
    const tagsIndex = index.getFieldIndex("tags") as TextFieldIndex;
    for (const term of Object.keys(tagsIndex.termsAggregation(10))) {
      const hits = index.searchRequest({ query: new TermQuery("tags", term) });
      const ids = new Set(hits.map(([id]) => id));
      const terms = (index.getFieldIndex("title") as TextFieldIndex).getTopSignificantTerms(5, ids);
      expect(Object.keys(terms).length).toBeGreaterThan(0);
    }
  });
});
