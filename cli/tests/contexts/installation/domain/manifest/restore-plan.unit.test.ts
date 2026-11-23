import { describe, expect, it } from "vitest";
import type { DriftVerdict } from "../../../../../src/contexts/installation/domain/drift.js";
import { planRestore } from "../../../../../src/contexts/installation/domain/manifest/restore-plan.js";

const recorded = (relativePath: string, verdict: DriftVerdict) => ({ relativePath, verdict });

describe("restore plan", () => {
  it("plans nothing for files that did not drift", () => {
    expect(planRestore([recorded("a.md", "ok")], new Set(["a.md"]))).toStrictEqual([]);
  });

  it("rewrites a missing file the distribution still provides, as deleted", () => {
    expect(planRestore([recorded("a.md", "missing")], new Set(["a.md"]))).toStrictEqual([
      { kind: "rewrite", relativePath: "a.md", reason: "deleted" },
    ]);
  });

  it("rewrites a modified file the distribution still provides", () => {
    expect(planRestore([recorded("a.md", "modified")], new Set(["a.md"]))).toStrictEqual([
      { kind: "rewrite", relativePath: "a.md", reason: "modified" },
    ]);
  });

  it("reports a drifted file the distribution no longer provides as unrestorable", () => {
    expect(planRestore([recorded("gone.md", "modified")], new Set())).toStrictEqual([
      { kind: "unrestorable", relativePath: "gone.md", reason: "modified" },
    ]);
  });

  it("keeps the recorded order across a mix of verdicts", () => {
    const steps = planRestore(
      [recorded("b.md", "modified"), recorded("c.md", "ok"), recorded("a.md", "missing")],
      new Set(["a.md", "b.md", "c.md"])
    );

    expect(steps.map((step) => step.relativePath)).toStrictEqual(["b.md", "a.md"]);
  });
});
