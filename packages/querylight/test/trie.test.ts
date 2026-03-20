import { describe, expect, it } from "vitest";
import { SimpleStringTrie } from "../src/index";

describe("SimpleStringTrie", () => {
  it("should trie prefixes", () => {
    const trie = new SimpleStringTrie();
    ["foofo", "foofoo", "fooboooooo", "1234", "123"].forEach((value) => trie.add(value));
    expect(trie.get("foo")).toBeNull();
    expect(trie.get("foobar")).toBeNull();
    expect(trie.get("abc")).toBeNull();
    expect(trie.get("1200")).toBeNull();
    expect(trie.get("foofo")).toBe("foofo");
    expect(trie.get("foofoxxxxxxxxxx")).toBe("foofo");
    expect(trie.get("foofoo")).toBe("foofoo");
    expect(trie.get("foofoooo")).toBe("foofoo");
    expect(trie.get("fooboooooo")).toBe("fooboooooo");
    expect(trie.get("1234")).toBe("1234");
    expect(trie.get("1230")).toBe("123");
  });

  it("should produce all except albania", () => {
    const trie = new SimpleStringTrie();
    ["australia", "austria", "albania"].forEach((value) => trie.add(value));
    const matches = trie.match("au").join(" ");
    expect(matches).toContain("austria");
    expect(matches).toContain("australia");
  });

  it("should produce all nested prefixes", () => {
    const trie = new SimpleStringTrie();
    ["ab", "abc", "abcd", "abcde"].forEach((value) => trie.add(value));
    expect(trie.match("ab")).toHaveLength(4);
    const match = trie.match("a").join(" ");
    ["ab", "abc", "abcd", "abcde"].forEach((value) => expect(match).toContain(value));
    expect(trie.match("abc")).toHaveLength(3);
    const match2 = trie.match("abc").join(" ");
    ["abc", "abcd", "abcde"].forEach((value) => expect(match2).toContain(value));
    expect(match2).not.toContain('ab"');
  });

  it("should produce all postfixes", () => {
    const trie = new SimpleStringTrie();
    const strings = ["a", "aa", "aaa", "ab", "abb", "aab"];
    strings.forEach((value) => trie.add(value));
    expect(trie.match("a")).toHaveLength(strings.length);
  });

  it("should match", () => {
    const trie = new SimpleStringTrie();
    ["foofoo", "foobar", "bar"].forEach((value) => trie.add(value));
    const match = trie.match("fo");
    expect(match).toContain("foofoo");
    expect(match).toContain("foobar");
    expect(match).not.toContain("bar");
    expect(trie.match("fff")).toHaveLength(0);
  });

  it("should return matching prefix", () => {
    const trie = new SimpleStringTrie();
    ["a", "b", "c"].forEach((value) => trie.add(value));
    const match = trie.match("abc");
    expect(match).toContain("a");
    expect(match).not.toContain("abc");
  });
});
