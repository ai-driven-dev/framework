import { describe, expect, it } from "vitest";
import { ForeignSuffixFilter } from "../../../../../src/contexts/tools/domain/profile/foreign-suffix-filter.js";
import { catalogOf } from "../../testing/catalog-of.js";

describe("ForeignSuffixFilter", () => {
  const claude = ForeignSuffixFilter.keeping(".claude.md");

  it("accepts a file name without any tool suffix", () => {
    expect(claude.accepts("a/b/plan.md")).toBe(true);
  });

  it("accepts a file name carrying the suffix it keeps", () => {
    expect(claude.accepts("a/b/plan.claude.md")).toBe(true);
  });

  it.each(
    catalogOf()
      .idsInCanonicalOrder("ai")
      .filter((id) => id !== "claude")
  )("refuses a %s file name", (id) => {
    expect(claude.accepts(`a/b/plan.${id}.md`)).toBe(false);
  });

  it("refuses every tool suffix when it keeps none", () => {
    const keepingNone = ForeignSuffixFilter.keeping("");
    expect(
      catalogOf()
        .idsInCanonicalOrder("ai")
        .some((id) => keepingNone.accepts(`plan.${id}.md`))
    ).toBe(false);
  });

  it("accepts a suffix no tool owns", () => {
    expect(claude.accepts("plan.other.md")).toBe(true);
  });
});
