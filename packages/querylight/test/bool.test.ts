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
    const results = index.search(new BoolQuery({ filter: [new MatchQuery({ field: "title", text: "querylight" })] }));
    expect(results).toHaveLength(1);
  });

  it("should only find ktsearch", () => {
    const index = testIndex();
    const esClause = new MatchQuery({ field: "description", text: "elasticsearch" });
    expect(index.search(esClause)).toHaveLength(3);
    expect(index.search(new BoolQuery({ must: [esClause] }))).toHaveLength(3);
    expect(index.search(new BoolQuery({ must: [esClause], filter: [new MatchQuery({ field: "title", text: "querylight" })] }))).toHaveLength(1);
  });

  it("should rank", () => {
    const index = testIndex();
    const query = new BoolQuery({
      should: [
        new MatchQuery({ field: "title", text: "querylight" }),
        new MatchQuery({ field: "description", text: "querylight" })
      ]
    });
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

    const fooClause = new MatchQuery({ field: "title", text: "foo" });
    const barClause = new MatchQuery({ field: "title", text: "bar" });
    const bazClause = new MatchQuery({ field: "title", text: "baz" });

    expect(ids(index.search(new BoolQuery({ must: [fooClause, barClause] })))).not.toContain("1");
    expect(ids(index.search(new BoolQuery({ must: [fooClause, barClause] })))).toEqual(expect.arrayContaining(["4", "5", "7"]));

    expect(ids(index.search(new BoolQuery({ filter: [fooClause, barClause] })))).not.toContain("1");
    expect(ids(index.search(new BoolQuery({ filter: [fooClause, barClause] })))).toEqual(expect.arrayContaining(["4", "5", "7"]));

    const filteredAndMust = ids(index.search(new BoolQuery({ must: [bazClause], filter: [fooClause, barClause] })));
    expect(filteredAndMust).not.toEqual(expect.arrayContaining(["1", "4", "5"]));
    expect(filteredAndMust).toEqual(expect.arrayContaining(["7"]));

    const shouldHits = ids(index.search(new BoolQuery({ should: [fooClause, barClause] })));
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

    const results = ids(index.search(new BoolQuery({
      mustNot: [
        new MatchQuery({ field: "title", text: "foo" }),
        new MatchQuery({ field: "title", text: "bar" })
      ]
    }))).sort();

    expect(results).toEqual(["3"]);
  });

  it("should treat should clauses as optional when must clauses are present", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    [
      ["1", "alpha"],
      ["2", "alpha beta"],
      ["3", "alpha gamma"]
    ].forEach(([id, title]) => index.index({ id, fields: { title: [title] } }));

    const hits = index.search(new BoolQuery({
      should: [new MatchQuery({ field: "title", text: "beta" })],
      must: [new MatchQuery({ field: "title", text: "alpha" })]
    }));

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

    const hits = index.search(new BoolQuery({
      should: [
        new MatchQuery({ field: "title", text: "alpha" }),
        new MatchQuery({ field: "title", text: "beta" })
      ],
      minimumShouldMatch: 2
    }));

    expect(ids(hits)).toEqual(["3", "4"]);
  });

  it("should support minimumShouldMatch together with required clauses", () => {
    const index = new DocumentIndex({ title: new TextFieldIndex() });
    [
      ["1", "alpha beta"],
      ["2", "alpha gamma"],
      ["3", "alpha beta gamma"]
    ].forEach(([id, title]) => index.index({ id, fields: { title: [title] } }));

    const hits = index.search(new BoolQuery({
      should: [
        new MatchQuery({ field: "title", text: "beta" }),
        new MatchQuery({ field: "title", text: "gamma" })
      ],
      must: [new MatchQuery({ field: "title", text: "alpha" })],
      minimumShouldMatch: 2
    }));

    expect(ids(hits)).toEqual(["3"]);
  });
});
