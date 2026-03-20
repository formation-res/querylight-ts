import { describe, expect, it } from "vitest";
import { BoolQuery, DocumentIndex, MatchQuery, TextFieldIndex, ids, type Hits } from "../src/index";
import { testIndex } from "./testfixture";

function expectAppearsBefore(hits: Hits, id1: string, id2: string): void {
  const i1 = ids(hits).indexOf(id1);
  const i2 = ids(hits).indexOf(id2);
  expect(i1).toBeGreaterThanOrEqual(0);
  expect(i2).toBeGreaterThanOrEqual(0);
  expect(i1).toBeLessThan(i2);
}

describe("bool queries", () => {
  it("should filter correctly", () => {
    const index = testIndex();
    const results = index.search(new BoolQuery([], [], [new MatchQuery("title", "querylight")]));
    expect(results).toHaveLength(1);
  });

  it("should only find ktsearch", () => {
    const index = testIndex();
    const esClause = new MatchQuery("description", "elasticsearch");
    expect(index.search(esClause)).toHaveLength(3);
    expect(index.search(new BoolQuery([], [esClause]))).toHaveLength(3);
    expect(index.search(new BoolQuery([], [esClause], [new MatchQuery("title", "querylight")]))).toHaveLength(1);
  });

  it("should rank", () => {
    const index = testIndex();
    const query = new BoolQuery([new MatchQuery("title", "querylight"), new MatchQuery("description", "querylight")]);
    const results = index.search(query);
    expect(ids(results)).toEqual(expect.arrayContaining(["querylight", "es", "solr"]));
    expectAppearsBefore(results, "querylight", "es");
    expectAppearsBefore(results, "querylight", "solr");
  });

  it("should do boolean logic", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    [
      ["1", "foo"],
      ["2", "bar"],
      ["3", "foobar"],
      ["4", "foo bar"],
      ["5", "bar foo"],
      ["6", "barfoo"],
      ["7", "bar foo baz"]
    ].forEach(([id, title]) => index.index({ id, fields: { title: [title] } }));

    const fooClause = new MatchQuery("title", "foo");
    const barClause = new MatchQuery("title", "bar");
    const bazClause = new MatchQuery("title", "baz");

    expect(ids(index.search(new BoolQuery([], [fooClause, barClause])))).not.toContain("1");
    expect(ids(index.search(new BoolQuery([], [fooClause, barClause])))).toEqual(expect.arrayContaining(["4", "5", "7"]));

    expect(ids(index.search(new BoolQuery([], [], [fooClause, barClause])))).not.toContain("1");
    expect(ids(index.search(new BoolQuery([], [], [fooClause, barClause])))).toEqual(expect.arrayContaining(["4", "5", "7"]));

    const filteredAndMust = ids(index.search(new BoolQuery([], [bazClause], [fooClause, barClause])));
    expect(filteredAndMust).not.toEqual(expect.arrayContaining(["1", "4", "5"]));
    expect(filteredAndMust).toEqual(expect.arrayContaining(["7"]));

    const shouldHits = ids(index.search(new BoolQuery([fooClause, barClause])));
    expect(shouldHits).toEqual(expect.arrayContaining(["1", "2", "4", "5", "7"]));
    expect(shouldHits).not.toEqual(expect.arrayContaining(["6"]));
  });

  it("should exclude documents matching any mustNot clause", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    [
      ["1", "foo"],
      ["2", "bar"],
      ["3", "baz"],
      ["4", "foo bar"]
    ].forEach(([id, title]) => index.index({ id, fields: { title: [title] } }));

    const results = ids(index.search(new BoolQuery([], [], [], [
      new MatchQuery("title", "foo"),
      new MatchQuery("title", "bar")
    ]))).sort();

    expect(results).toEqual(["3"]);
  });

  it("should treat should clauses as optional when must clauses are present", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    [
      ["1", "alpha"],
      ["2", "alpha beta"],
      ["3", "alpha gamma"]
    ].forEach(([id, title]) => index.index({ id, fields: { title: [title] } }));

    const hits = index.search(new BoolQuery(
      [new MatchQuery("title", "beta")],
      [new MatchQuery("title", "alpha")]
    ));

    expect(ids(hits)).toEqual(["2", "1", "3"]);
  });

  it("should support minimumShouldMatch for should-only queries", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    [
      ["1", "alpha"],
      ["2", "beta"],
      ["3", "alpha beta"],
      ["4", "alpha beta gamma"]
    ].forEach(([id, title]) => index.index({ id, fields: { title: [title] } }));

    const hits = index.search(new BoolQuery(
      [new MatchQuery("title", "alpha"), new MatchQuery("title", "beta")],
      [],
      [],
      [],
      undefined,
      2
    ));

    expect(ids(hits)).toEqual(["3", "4"]);
  });

  it("should support minimumShouldMatch together with required clauses", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    [
      ["1", "alpha beta"],
      ["2", "alpha gamma"],
      ["3", "alpha beta gamma"]
    ].forEach(([id, title]) => index.index({ id, fields: { title: [title] } }));

    const hits = index.search(new BoolQuery(
      [new MatchQuery("title", "beta"), new MatchQuery("title", "gamma")],
      [new MatchQuery("title", "alpha")],
      [],
      [],
      undefined,
      2
    ));

    expect(ids(hits)).toEqual(["3"]);
  });
});
