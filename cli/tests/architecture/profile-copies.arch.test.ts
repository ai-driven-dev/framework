/**
 * The profile copy check runs before push (`pnpm jscpd:profiles`), not here: this file plants
 * the copies it must see and the look-alikes it must not, through the same functions.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASELINE, compare, copiesBetweenProfiles, scan } from "../../scripts/profile-copies.mjs";
import { read, readFromRepoRoot } from "./helpers.js";

const MERGE_LOOP = (name: string): string =>
  [
    `export function ${name}(existing: string, incoming: string): string {`,
    "  const parsed = JSON.parse(existing) as Record<string, string[]>;",
    "  const added = JSON.parse(incoming) as Record<string, string[]>;",
    "  for (const [event, entries] of Object.entries(added)) {",
    "    const kept = (parsed[event] ?? []).filter((entry) => !entries.includes(entry));",
    "    parsed[event] = [...kept, ...entries];",
    "  }",
    "  return JSON.stringify(parsed, null, 2);",
    "}",
    "",
  ].join("\n");

describe("the profile copy check is wired before push", () => {
  it("is a package script the pre-push runs", () => {
    const scripts = (JSON.parse(read("package.json")) as { scripts: Record<string, string> })
      .scripts;

    expect(scripts["jscpd:profiles"]).toBe("node scripts/profile-copies.mjs");
    expect(readFromRepoRoot("lefthook.yml")).toMatch(
      /pre-push:[\s\S]*pnpm --dir cli jscpd:profiles/
    );
  });

  it("gives every baseline entry a count and a reason", () => {
    for (const entry of BASELINE) {
      expect(entry.clones, entry.pair).toBeGreaterThan(0);
      expect(entry.reason.length, entry.pair).toBeGreaterThan(10);
    }
  });
});

describe("the guard itself", () => {
  let planted: string;

  beforeAll(() => {
    planted = mkdtempSync(join(tmpdir(), "aidd-profile-copies-"));
    for (const tool of ["alpha", "beta"]) mkdirSync(join(planted, tool));
    writeFileSync(join(planted, "alpha/hooks-format.ts"), MERGE_LOOP("mergeAlphaHooks"));
    writeFileSync(
      join(planted, "beta/hooks-format.ts"),
      MERGE_LOOP("mergeBetaHooks").replaceAll("parsed", "current").replaceAll("kept", "others")
    );
    writeFileSync(join(planted, "alpha/build.ts"), MERGE_LOOP("buildAlpha"));
    writeFileSync(join(planted, "beta/profile.ts"), MERGE_LOOP("profileBeta"));
  });

  afterAll(() => {
    rmSync(planted, { recursive: true, force: true });
  });

  it("names a block copied between two profiles, renamed, and not their build or profile", () => {
    expect(copiesBetweenProfiles(scan(planted))).toEqual([
      "alpha/hooks-format.ts <> beta/hooks-format.ts (1)",
    ]);
  });

  it("counts clones per pair, and leaves a copy within one tool's folder out", () => {
    const clone = (first: string, second: string) => ({
      firstFile: { name: first },
      secondFile: { name: second },
    });
    const report = {
      duplicates: [
        clone("beta\\a.ts", "alpha\\a.ts"),
        clone("alpha/a.ts", "beta/a.ts"),
        clone("alpha/a.ts", "alpha/b.ts"),
      ],
    };

    expect(copiesBetweenProfiles(report)).toEqual(["alpha/a.ts <> beta/a.ts (2)"]);
  });

  it("fails a pair the baseline does not hold, and a held pair that is gone", () => {
    const baseline = [{ pair: "alpha/old.ts <> beta/old.ts", clones: 1, reason: "planted" }];

    expect(compare(["alpha/a.ts <> beta/a.ts (1)"], baseline)).toEqual({
      added: ["alpha/a.ts <> beta/a.ts (1)"],
      fixed: ["alpha/old.ts <> beta/old.ts (1)"],
    });
  });

  it("fails when jscpd does not run, rather than reading as no copy", () => {
    expect(() => scan(planted, join(planted, "missing-jscpd.js"))).toThrow(/jscpd did not run/);
  });
});
