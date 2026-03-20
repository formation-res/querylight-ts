import { describe, expect, it } from "vitest";
import {
  VectorFieldIndex,
  cosineSimilarity,
  createSeededRandom,
  hashFunction,
  populateLSHBuckets,
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
});
