import { describe, expect, it } from "vitest";
import { Analyzer, VectorFieldIndex, bigramVector, createSeededRandom } from "../src/index";
import { quotesIndex } from "./testfixture";

describe("syntactic vectors", () => {
  const analyzer = new Analyzer();

  it("should find hamlet via vector search", () => {
    const docs = quotesIndex();
    const index = new VectorFieldIndex(4, 36 * 36, createSeededRandom(42));

    Object.entries(docs.documents).forEach(([id, doc]) => {
      const text = doc.fields.description?.join(" ") ?? "";
      index.insert(id, [bigramVector(analyzer.analyze(text))]);
    });

    const result = index.query(bigramVector(analyzer.analyze("to be or not to be")), 10);
    const hamletId = Object.entries(docs.documents).find(([, entry]) => entry.fields.title?.some((title) => title.includes("Hamlet")))?.[0];
    expect(result[0]?.[0]).toBe(hamletId);
  });
});
