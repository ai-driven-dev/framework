import { describe, expect, it } from "vitest";
import { ForeignSuffixFilter } from "../../../../../src/contexts/tools/domain/profile/foreign-suffix-filter.js";

const registered = [".claude.md", ".zed.md", ".nova.md"];

describe("ForeignSuffixFilter", () => {
  const claude = ForeignSuffixFilter.keeping(".claude.md", registered);

  it("accepts a file name without any tool suffix", () => {
    expect(claude.accepts("a/b/plan.md")).toBe(true);
  });

  it("accepts a file name carrying the suffix it keeps", () => {
    expect(claude.accepts("a/b/plan.claude.md")).toBe(true);
  });

  it.each([".zed.md", ".nova.md"])("refuses a registered %s file name", (suffix) => {
    expect(claude.accepts(`a/b/plan${suffix}`)).toBe(false);
  });

  it("refuses every registered suffix when it keeps none", () => {
    const keepingNone = ForeignSuffixFilter.keeping("", registered);
    expect(registered.some((suffix) => keepingNone.accepts(`plan${suffix}`))).toBe(false);
  });

  it("accepts a suffix no registered tool owns", () => {
    expect(claude.accepts("plan.other.md")).toBe(true);
  });
});
