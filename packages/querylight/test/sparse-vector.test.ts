import { describe, expect, it } from "vitest";
import { SparseVectorFieldIndex, sparseInnerProduct, type SparseVectorFieldIndexState } from "../src/index";

describe("sparse vectors", () => {
  it("computes sparse inner products over overlapping tokens", () => {
    expect(sparseInnerProduct(
      { vector: 2, search: 1.5, sparse: 0.5 },
      { search: 4, sparse: 2, lexical: 10 }
    )).toBeCloseTo(7);
  });

  it("queries by exact sparse token overlap", () => {
    const index = new SparseVectorFieldIndex();
    index.insert("doc-1", [{ vector: 1.2, search: 1.0, sparse: 0.7 }]);
    index.insert("doc-2", [{ lexical: 1.1, bm25: 0.9 }]);
    index.insert("doc-3", [{ vector: 0.5, sparse: 0.2 }]);

    expect(index.query({ vector: 2, sparse: 1 }, 3).map(([id]) => id)).toEqual(["doc-1", "doc-3"]);
  });

  it("supports filtering candidate ids during sparse retrieval", () => {
    const index = new SparseVectorFieldIndex();
    index.insert("doc-1", [{ querylight: 1, sparse: 0.8 }]);
    index.insert("doc-2", [{ querylight: 1, sparse: 0.6 }]);

    expect(index.query({ querylight: 1 }, 10, ["doc-2"])).toEqual([["doc-2", 1]]);
  });

  it("reranks explicit candidate windows using the best sparse vector per document", () => {
    const index = new SparseVectorFieldIndex();
    index.insert("doc-1", [
      { vector: 0.5, sparse: 0.1 },
      { vector: 0.9, sparse: 0.7 }
    ]);
    index.insert("doc-2", [{ vector: 0.8, sparse: 0.2 }]);

    expect(index.rerank({ vector: 1, sparse: 1 }, ["doc-2", "doc-1"]).map(([id]) => id)).toEqual(["doc-1", "doc-2"]);
  });

  it("round-trips sparse index state", () => {
    const index = new SparseVectorFieldIndex();
    index.insert("doc-1", [{ vector: 1.2, search: 0.4 }]);
    index.insert("doc-2", [{ lexical: 0.8 }]);

    const state = JSON.parse(JSON.stringify(index.indexState)) as SparseVectorFieldIndexState;
    const loaded = index.loadState(state);

    expect(loaded.query({ vector: 1 }, 10)).toEqual([["doc-1", 1.2]]);
    expect(loaded.documentVectors("doc-2")).toEqual([{ lexical: 0.8 }]);
  });
});
