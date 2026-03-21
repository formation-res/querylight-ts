import { describe, expect, it } from "vitest";
import { DateFieldIndex, DocumentIndex, NumericFieldIndex } from "../src/index";

function createNumericIndex(): NumericFieldIndex {
  const index = new DocumentIndex({
    price: new NumericFieldIndex()
  });

  index.index({ id: "a", fields: { price: ["5", "12"] } });
  index.index({ id: "b", fields: { price: ["15"] } });
  index.index({ id: "c", fields: { price: ["18", "25"] } });
  index.index({ id: "ignored", fields: { price: ["not-a-number"] } });

  return index.getFieldIndex("price") as NumericFieldIndex;
}

function createDateIndex(): DateFieldIndex {
  const index = new DocumentIndex({
    publishedAt: new DateFieldIndex()
  });

  index.index({
    id: "a",
    fields: {
      publishedAt: ["2025-01-02T10:00:00.000Z", "2025-01-02T18:00:00.000Z"]
    }
  });
  index.index({
    id: "b",
    fields: {
      publishedAt: ["2025-01-03T09:00:00.000Z"]
    }
  });
  index.index({
    id: "c",
    fields: {
      publishedAt: ["2025-01-04T12:00:00.000Z"]
    }
  });

  return index.getFieldIndex("publishedAt") as DateFieldIndex;
}

describe("numeric aggregations", () => {
  it("calculates metric aggregations across all indexed values", () => {
    const index = createNumericIndex();

    expect(index.valueCount()).toBe(5);
    expect(index.min()).toBe(5);
    expect(index.max()).toBe(25);
    expect(index.sum()).toBe(75);
    expect(index.avg()).toBe(15);
    expect(index.stats()).toEqual({
      count: 5,
      min: 5,
      max: 25,
      sum: 75,
      avg: 15
    });
  });

  it("supports subset metric aggregations", () => {
    const index = createNumericIndex();
    const subset = new Set(["a", "c"]);

    expect(index.valueCount(subset)).toBe(4);
    expect(index.min(subset)).toBe(5);
    expect(index.max(subset)).toBe(25);
    expect(index.sum(subset)).toBe(60);
    expect(index.avg(subset)).toBe(15);
  });

  it("returns empty metric values when no documents match the subset", () => {
    const index = createNumericIndex();
    const subset = new Set(["missing"]);

    expect(index.valueCount(subset)).toBe(0);
    expect(index.min(subset)).toBeNull();
    expect(index.max(subset)).toBeNull();
    expect(index.sum(subset)).toBe(0);
    expect(index.avg(subset)).toBeNull();
    expect(index.stats(subset)).toEqual({
      count: 0,
      min: null,
      max: null,
      sum: 0,
      avg: null
    });
  });

  it("computes range aggregations with doc-count semantics for multi-valued fields", () => {
    const index = createNumericIndex();

    expect(index.rangeAggregation([
      { key: "short", to: 10 },
      { key: "medium", from: 10, to: 20 },
      { key: "long", from: 20 }
    ])).toEqual([
      { key: "short", from: null, to: 10, docCount: 1 },
      { key: "medium", from: 10, to: 20, docCount: 3 },
      { key: "long", from: 20, to: null, docCount: 1 }
    ]);
  });

  it("computes histogram buckets with one count per matching document", () => {
    const index = createNumericIndex();

    expect(index.histogram(10)).toEqual([
      { key: 0, docCount: 1 },
      { key: 10, docCount: 3 },
      { key: 20, docCount: 1 }
    ]);
  });

  it("supports subset filtering for range and histogram aggregations", () => {
    const index = createNumericIndex();
    const subset = new Set(["a", "b"]);

    expect(index.rangeAggregation([
      { key: "short", to: 10 },
      { key: "medium", from: 10, to: 20 },
      { key: "long", from: 20 }
    ], subset)).toEqual([
      { key: "short", from: null, to: 10, docCount: 1 },
      { key: "medium", from: 10, to: 20, docCount: 2 },
      { key: "long", from: 20, to: null, docCount: 0 }
    ]);

    expect(index.histogram(10, subset)).toEqual([
      { key: 0, docCount: 1 },
      { key: 10, docCount: 2 }
    ]);
  });

  it("validates histogram intervals and range bounds", () => {
    const index = createNumericIndex();

    expect(() => index.histogram(0)).toThrow();
    expect(() => index.histogram(Number.NaN)).toThrow();
    expect(() => index.rangeAggregation([{ from: "not-a-number" }])).toThrow();
  });
});

describe("date aggregations", () => {
  it("calculates metric aggregations over parsed timestamps", () => {
    const index = createDateIndex();
    const stats = index.stats();

    expect(stats.count).toBe(4);
    expect(stats.min).toBe(Date.parse("2025-01-02T10:00:00.000Z"));
    expect(stats.max).toBe(Date.parse("2025-01-04T12:00:00.000Z"));
    expect(stats.sum).toBe(
      Date.parse("2025-01-02T10:00:00.000Z") +
      Date.parse("2025-01-02T18:00:00.000Z") +
      Date.parse("2025-01-03T09:00:00.000Z") +
      Date.parse("2025-01-04T12:00:00.000Z")
    );
    expect(stats.avg).toBe(stats.sum / stats.count);
  });

  it("supports date range aggregations using string/date bounds", () => {
    const index = createDateIndex();

    expect(index.rangeAggregation([
      { key: "day-2", to: new Date("2025-01-03T00:00:00.000Z") },
      { key: "day-3", from: "2025-01-03T00:00:00.000Z", to: "2025-01-04T00:00:00.000Z" },
      { key: "day-4+", from: "2025-01-04T00:00:00.000Z" }
    ])).toEqual([
      { key: "day-2", from: null, to: Date.parse("2025-01-03T00:00:00.000Z"), docCount: 1 },
      { key: "day-3", from: Date.parse("2025-01-03T00:00:00.000Z"), to: Date.parse("2025-01-04T00:00:00.000Z"), docCount: 1 },
      { key: "day-4+", from: Date.parse("2025-01-04T00:00:00.000Z"), to: null, docCount: 1 }
    ]);
  });

  it("computes fixed-interval date histograms", () => {
    const index = createDateIndex();
    const dayMs = 24 * 60 * 60 * 1000;

    expect(index.dateHistogram(dayMs)).toEqual([
      {
        key: Date.parse("2025-01-02T00:00:00.000Z"),
        keyAsString: "2025-01-02T00:00:00.000Z",
        docCount: 1
      },
      {
        key: Date.parse("2025-01-03T00:00:00.000Z"),
        keyAsString: "2025-01-03T00:00:00.000Z",
        docCount: 1
      },
      {
        key: Date.parse("2025-01-04T00:00:00.000Z"),
        keyAsString: "2025-01-04T00:00:00.000Z",
        docCount: 1
      }
    ]);
  });

  it("supports subset filtering for date histograms", () => {
    const index = createDateIndex();
    const dayMs = 24 * 60 * 60 * 1000;

    expect(index.dateHistogram(dayMs, new Set(["a", "c"]))).toEqual([
      {
        key: Date.parse("2025-01-02T00:00:00.000Z"),
        keyAsString: "2025-01-02T00:00:00.000Z",
        docCount: 1
      },
      {
        key: Date.parse("2025-01-04T00:00:00.000Z"),
        keyAsString: "2025-01-04T00:00:00.000Z",
        docCount: 1
      }
    ]);
  });

  it("validates date histogram intervals", () => {
    const index = createDateIndex();

    expect(() => index.dateHistogram(0)).toThrow();
    expect(() => index.dateHistogram(Number.NaN)).toThrow();
  });
});
