import { describe, expect, it } from "vitest";
import { DocumentIndex, RankingAlgorithm, TextFieldIndex, type TextFieldIndexState } from "../src/index";
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
});
