import { describe, expect, it } from "vitest";
import { Analyzer, EdgeNgramsTokenFilter, InterpunctionTextFilter, NgramTokenFilter } from "../src/index";

describe("analysis", () => {
  it("should tokenize", () => {
    const standardAnalyzer = new Analyzer();
    expect(standardAnalyzer.analyze("")).toHaveLength(0);
    expect(standardAnalyzer.analyze("!@#$%^&*()_+=-{}][\\\\|'\"';:/?.>,<`~§±")).toEqual([]);
    expect(standardAnalyzer.analyze("\n\t ")).toHaveLength(0);
    expect(standardAnalyzer.analyze(",.foo -bar_\n\tfoo.")).toEqual(["foo", "bar", "foo"]);
    expect(standardAnalyzer.analyze("foo,bar,foo")).toEqual(["foo", "bar", "foo"]);
  });

  it("should strip", () => {
    const re = /[\]\[]/g;
    expect("[]".replace(re, "")).toBe("");
  });

  it("should generate ngrams", () => {
    const tokens = new Analyzer().analyze("madam i'm adam");
    const ngramTokenFilter = new NgramTokenFilter(3);
    expect(ngramTokenFilter.filter(tokens)).toEqual(["mad", "ada", "dam", "ami", "mim", "ima"]);
    expect(ngramTokenFilter.filter([])).toEqual([]);
    expect(ngramTokenFilter.filter(["1"])).toEqual(["1"]);
    expect(ngramTokenFilter.filter(["12"])).toEqual(["12"]);
    expect(ngramTokenFilter.filter(["123"])).toEqual(["123"]);
    expect(ngramTokenFilter.filter(["1234"])).toEqual(["123", "234"]);
  });

  it("should generate edge ngrams", () => {
    const tokens = new Analyzer().analyze("madam i'm adam");
    const edgeNgramsTokenFilter = new EdgeNgramsTokenFilter(2, 4);
    expect(edgeNgramsTokenFilter.filter(tokens)).toEqual(["ma", "am", "mad", "dam", "mada", "adam", "im", "ad", "ada"]);
    expect(edgeNgramsTokenFilter.filter([])).toEqual([]);
    expect(edgeNgramsTokenFilter.filter(["1"])).toEqual(["1"]);
    expect(edgeNgramsTokenFilter.filter(["12"])).toEqual(["12"]);
    expect(edgeNgramsTokenFilter.filter(["123"])).toEqual(["12", "23", "123"]);
    expect(edgeNgramsTokenFilter.filter(["1234"])).toEqual(["12", "34", "123", "234", "1234"]);
    expect(edgeNgramsTokenFilter.filter(["12345"])).toEqual(["12", "45", "123", "345", "1234", "2345"]);
  });

  it("should not filter out numbers", () => {
    expect(new InterpunctionTextFilter().filter("100")).toBe("100");
  });
});
