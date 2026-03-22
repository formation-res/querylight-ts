import { describe, expect, it } from "vitest";
import {
  type AsyncVectorScorer,
  CpuVectorScorer,
  VectorFieldIndex,
  cosineSimilarity,
  createSeededRandom,
  hashFunction,
  populateLSHBuckets,
  type PreparedVector,
  type VectorFieldIndexParams,
  type VectorScorer,
  type VectorFieldIndexState
} from "../src/index";

describe("aknn", () => {
  const vectors = {
    id1: [1.0, 2.0, 3.0],
    id2: [4.0, 5.0, 6.0],
    id3: [7.0, 8.0, 9.0],
    id4: [1.1, 2.1, 3.1]
  };

  it("cosine similarity", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBe(1);
  });

  it("hash function", () => {
    const vector = [1.0, 2.0, 3.0];
    const randomVectors = [
      [0.1, 0.3, 0.5],
      [0.7, 0.2, 0.6]
    ];
    const hash = hashFunction(vector, randomVectors);
    expect(hash).toBe(hashFunction(vector, randomVectors));
  });

  it("populate lsh buckets", () => {
    const randomVectors = [
      [0.1, 0.3, 0.5],
      [0.7, 0.2, 0.6]
    ];
    expect(populateLSHBuckets(vectors, randomVectors).size).toBeGreaterThan(0);
  });

  it("vector field index query", () => {
    const index = new VectorFieldIndex(2, 3, createSeededRandom(42));
    index.insert("id1", [[1.0, 2.0, 3.0]]);
    index.insert("id2", [[4.0, 5.0, 6.0]]);
    index.insert("id3", [[1.1, 2.1, 3.1]]);
    expect(index.query([1.0, 2.0, 3.0], 1)[0]?.[0]).toBe("id1");
  });

  it("reranks an explicit candidate window exactly", () => {
    const index = new VectorFieldIndex(2, 3, createSeededRandom(42));
    index.insert("id1", [[1.0, 2.0, 3.0]]);
    index.insert("id2", [[4.0, 5.0, 6.0]]);
    index.insert("id3", [[1.1, 2.1, 3.1]]);

    expect(index.rerank([1.0, 2.0, 3.0], ["id2", "id3", "missing"]).map(([id]) => id)).toEqual(["id3", "id2"]);
  });

  it("vector field index state round trip", () => {
    const index = new VectorFieldIndex(2, 3, createSeededRandom(42));
    index.insert("id1", [[1.0, 2.0, 3.0]]);
    index.insert("id2", [[4.0, 5.0, 6.0]]);
    const state = index.indexState as VectorFieldIndexState;
    const loaded = index.loadState(state) as VectorFieldIndex;
    expect(loaded.query([1.0, 2.0, 3.0], 1)[0]?.[0]).toBe("id1");
  });

  it("vector field index serialization", () => {
    const index = new VectorFieldIndex(2, 3, createSeededRandom(42));
    index.insert("id1", [[1.0, 2.0, 3.0]]);
    const state = JSON.parse(JSON.stringify(index.indexState)) as VectorFieldIndexState;
    const loaded = index.loadState(state) as VectorFieldIndex;
    expect(loaded.query([1.0, 2.0, 3.0], 1)[0]?.[0]).toBe("id1");
  });

  it("supports params-object construction and persists hash bit settings", () => {
    const params: VectorFieldIndexParams = {
      numHashTables: 2,
      dimensions: 3,
      random: createSeededRandom(42),
      options: { hashBitsPerTable: 2 }
    };
    const index = new VectorFieldIndex(params);
    index.insert("id1", [[1.0, 2.0, 3.0]]);

    const state = index.indexState as VectorFieldIndexState;
    expect(state.hashBitsPerTable).toBe(2);

    const loaded = index.loadState(state) as VectorFieldIndex;
    expect(loaded.query([1.0, 2.0, 3.0], 1)[0]?.[0]).toBe("id1");
  });

  it("supports more than 32 hash projections without overflowing bitwise operations", () => {
    const vector = [1, 1];
    const randomVectors = Array.from({ length: 40 }, () => [1, 0]);

    expect(hashFunction(vector, randomVectors)).toBe(2 ** 40 - 1);
  });

  it("uses the configured scorer backend for dense candidate scoring", () => {
    class FirstCoordinateScorer implements VectorScorer {
      prepare(vector: ArrayLike<number>, dimensions: number): PreparedVector {
        if (vector.length !== dimensions) {
          throw new Error("Vectors must be of the same size");
        }
        return Float32Array.from(Array.from({ length: dimensions }, (_, index) => vector[index] ?? 0));
      }

      bestScore(query: PreparedVector, candidates: ReadonlyArray<PreparedVector>): number {
        return Math.max(...candidates.map((candidate) => candidate[0]! * query[0]!));
      }
    }

    const index = new VectorFieldIndex({
      numHashTables: 2,
      dimensions: 2,
      random: createSeededRandom(42),
      options: { hashBitsPerTable: 2, scorer: new FirstCoordinateScorer() }
    });

    index.insert("id1", [[1, 100]]);
    index.insert("id2", [[2, 0]]);

    expect(index.rerank([1, 0], ["id1", "id2"]).map(([id]) => id)).toEqual(["id2", "id1"]);
  });

  it("exports the cpu scorer backend", () => {
    const scorer = new CpuVectorScorer();
    const prepared = scorer.prepare([3, 4], 2);

    expect(scorer.bestScore(prepared, [prepared])).toBeCloseTo(1);
  });

  it("supports async query fallback with the default cpu scorer", async () => {
    const index = new VectorFieldIndex(2, 3, createSeededRandom(42));
    index.insert("id1", [[1.0, 2.0, 3.0]]);
    index.insert("id2", [[4.0, 5.0, 6.0]]);

    await expect(index.queryAsync([1.0, 2.0, 3.0], 1)).resolves.toSatisfy((hits) =>
      hits[0]?.[0] === "id1" && Math.abs((hits[0]?.[1] ?? 0) - 1) < 1e-6
    );
  });

  it("uses the async scorer backend when available", async () => {
    class AsyncFirstCoordinateScorer implements VectorScorer, AsyncVectorScorer {
      prepare(vector: ArrayLike<number>, dimensions: number): PreparedVector {
        if (vector.length !== dimensions) {
          throw new Error("Vectors must be of the same size");
        }
        return Float32Array.from(Array.from({ length: dimensions }, (_, index) => vector[index] ?? 0));
      }

      bestScore(query: PreparedVector, candidates: ReadonlyArray<PreparedVector>): number {
        return Math.max(...candidates.map((candidate) => candidate[0]! * query[0]!));
      }

      async rankCandidatesAsync(query: PreparedVector, candidatesById: ReadonlyMap<string, ReadonlyArray<PreparedVector>>, k: number) {
        return [...candidatesById.entries()]
          .map(([id, candidates]) => [id, this.bestScore(query, candidates) + 10] as const)
          .sort((left, right) => right[1] - left[1])
          .slice(0, k);
      }
    }

    const index = new VectorFieldIndex({
      numHashTables: 2,
      dimensions: 2,
      random: createSeededRandom(42),
      options: { hashBitsPerTable: 2, scorer: new AsyncFirstCoordinateScorer() }
    });

    index.insert("id1", [[1, 0]]);
    index.insert("id2", [[2, 0]]);

    await expect(index.rerankAsync([1, 0], ["id1", "id2"])).resolves.toEqual([["id2", 12], ["id1", 11]]);
  });
});
