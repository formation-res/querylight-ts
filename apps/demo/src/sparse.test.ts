import { describe, expect, it } from "vitest";
import { buildSparseQueryVector } from "./sparse";

describe("buildSparseQueryVector", () => {
  it("uses learned token weights and deduplicates repeated token ids", () => {
    const vector = buildSparseQueryVector([5, 9, 5, 2, 100], [
      0,
      0,
      0,
      0,
      0,
      1.5,
      0,
      0,
      0,
      3.25
    ]);

    expect(vector).toEqual({
      "5": 1.5,
      "9": 3.25
    });
  });

  it("ignores tokens with missing, zero, or negative learned weights", () => {
    const vector = buildSparseQueryVector([1, 2, 3, 4], [0, 0, -1, 0.75]);

    expect(vector).toEqual({
      "3": 0.75
    });
  });
});
