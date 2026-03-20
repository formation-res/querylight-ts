import { describe, expect, it } from "vitest";
import {
  QueryContext,
  SimpleStringTrie,
  TrieNode,
  andHits,
  bigramVector,
  createSeededRandom,
  normalizeVector,
  orHits,
  reciprocalRankFusion
} from "../src/index";

describe("algorithmic correctness", () => {
  it("intersects hits by id and sums scores", () => {
    expect(andHits(
      [
        ["a", 2],
        ["b", 1],
        ["c", 0]
      ],
      [
        ["b", 4],
        ["a", 3],
        ["d", 10]
      ]
    )).toEqual([
      ["a", 5],
      ["b", 5]
    ]);
  });

  it("unions hits by id and keeps descending score order", () => {
    expect(orHits(
      [
        ["a", 2],
        ["c", 1]
      ],
      [
        ["b", 4],
        ["a", 3],
        ["d", 0]
      ]
    )).toEqual([
      ["a", 5],
      ["b", 4],
      ["c", 1]
    ]);
  });

  it("uses best rank position and id as reciprocal rank fusion tie breakers", () => {
    const fused = reciprocalRankFusion([
      [
        ["c", 100],
        ["b", 10]
      ],
      [
        ["a", 50],
        ["b", 5]
      ]
    ], { rankConstant: 0 });

    expect(fused.map(([id]) => id).slice(0, 3)).toEqual(["a", "c", "b"]);
  });

  it("validates reciprocal rank fusion parameters", () => {
    expect(() => reciprocalRankFusion([], { rankConstant: -1 })).toThrow("rankConstant should be a finite number >= 0");
    expect(() => reciprocalRankFusion([[]], { weights: [-1] })).toThrow("weights should be finite numbers >= 0");
  });

  it("tracks include and exclude ids in query contexts", () => {
    const context = new QueryContext();
    context.include(["a", "b", "c"]);
    context.exclude(["b"]);

    expect(context.hits()).toEqual([
      ["a", 1],
      ["c", 1]
    ]);
    expect(() => new QueryContext().hits()).toThrow("cannot get hits from uninitialized context");
  });

  it("reconstructs trie state without changing matching behavior", () => {
    const trie = SimpleStringTrie.from({ alpha: true, alpine: true, beta: true });
    const restored = new SimpleStringTrie(new TrieNode(trie.root.toState()));

    expect(restored.get("alphabet")).toBe("alpha");
    expect(restored.match("alp").sort()).toEqual(["alpha", "alpine"]);
  });

  it("produces deterministic seeded randomness in the expected range", () => {
    const left = createSeededRandom(42);
    const right = createSeededRandom(42);

    const leftValues = [left(), left(), left(), left(), left()];
    const rightValues = [right(), right(), right(), right(), right()];

    expect(leftValues).toEqual(rightValues);
    expect(leftValues.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("normalizes vectors and builds consistent bigram vectors from text or tokens", () => {
    const vector = normalizeVector([3, 4]);
    const fromText = bigramVector("A1-b2");
    const fromTokens = bigramVector(["a1", "b2"]);

    expect(vector[0]).toBeCloseTo(0.6);
    expect(vector[1]).toBeCloseTo(0.8);
    expect(fromText).toEqual(fromTokens);
  });
});
