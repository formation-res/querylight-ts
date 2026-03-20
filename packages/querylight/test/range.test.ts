import { describe, expect, it } from "vitest";
import { DocumentIndex, RangeQuery, TextFieldIndex, ids } from "../src/index";

describe("range query", () => {
  const index = new DocumentIndex({ value: new TextFieldIndex() });
  for (let num = 100; num <= 200; num += 1) {
    index.index({ id: String(num), fields: { value: [String(num)] } });
  }

  it("should filter correctly", () => {
    expect(ids(index.searchRequest({ query: new RangeQuery("value", { gt: "150", lt: "152" }) })).sort()).toEqual(["151"]);
    expect(ids(index.searchRequest({ query: new RangeQuery("value", { gte: "150", lt: "152" }) })).sort()).toEqual(["150", "151"]);
    expect(ids(index.searchRequest({ query: new RangeQuery("value", { gt: "150", lte: "152" }) })).sort()).toEqual(["151", "152"]);
    expect(ids(index.searchRequest({ query: new RangeQuery("value", { gte: "150", lte: "152" }) })).sort()).toEqual(["150", "151", "152"]);
    expect(index.searchRequest({ query: new RangeQuery("value", { lte: "150", gte: "152" }) })).toHaveLength(0);
    expect(index.searchRequest({ query: new RangeQuery("value") })).toHaveLength(101);
  });
});
