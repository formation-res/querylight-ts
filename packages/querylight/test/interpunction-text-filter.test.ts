import { describe, expect, it } from "vitest";
import { InterpunctionTextFilter } from "../src/index";

describe("InterpunctionTextFilter", () => {
  const filter = new InterpunctionTextFilter();

  it("removes interpunction characters", () => {
    expect(filter.filter("Hello, World! 123")).toBe("Hello  World  123");
  });

  it("handles multiple interpunction characters", () => {
    expect(filter.filter("Test@String#2021")).toBe("Test String 2021");
  });

  it("handles special characters", () => {
    expect(filter.filter("Special$Chars%^&*()")).toBe("Special Chars");
  });

  it("handles empty strings", () => {
    expect(filter.filter("")).toBe("");
  });

  it("handles strings with no interpunction characters", () => {
    expect(filter.filter("NoInterpunction123")).toBe("NoInterpunction123");
  });

  it("handles strings with only interpunction characters", () => {
    expect(filter.filter("!@#$%^&*()")).toBe("");
  });

  it("handles strings with numbers and interpunction characters", () => {
    expect(filter.filter("123!@#456")).toBe("123   456");
  });
});
