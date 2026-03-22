import { describe, expect, it } from "vitest";
import { MatchQuery, TextFieldIndex } from "../src/index";
import { testIndex } from "./testfixture";

describe("index", () => {
  it("should add terms", () => {
    const index = new TextFieldIndex();
    index.add("1", "foo");
    index.add("1", "foo");
    index.add("1", "bar");
    index.add("1", "bar");
    index.add("2", "foo");
    index.add("2", "foobar");
    index.add("2", "foobar");
    index.add("2", "foobar");
    index.add("3", "bar");
    index.add("3", "foobar");

    const results = index.searchTerm("foo");
    expect(results).toHaveLength(2);
    expect(results[0]?.[0]).toBe("1");
    expect(results[1]?.[0]).toBe("2");
  });

  it("should index documents", async () => {
    const index = testIndex();
    expect(await index.search(new MatchQuery({ field: "title", text: "Elasticsearch" }))).toHaveLength(1);
  });
});
