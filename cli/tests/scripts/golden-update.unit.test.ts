import { describe, expect, it } from "vitest";
import { goldenUpdateRun } from "../../scripts/golden-update.mjs";

describe("the golden update command", () => {
  it("runs every golden with the regeneration variable set when no name is given", () => {
    const { args, env } = goldenUpdateRun(undefined, {});

    expect(args).toEqual(["run", "--project=golden"]);
    expect(env.UPDATE_GOLDEN).toBe("1");
  });

  it("narrows the run to the golden files whose path holds the name", () => {
    expect(goldenUpdateRun("help-surface", {}).args).toEqual([
      "run",
      "--project=golden",
      "tests/golden/help-surface",
    ]);
  });

  it("refuses to regenerate in CI, where a golden changes only by a reviewed commit", () => {
    expect(() => goldenUpdateRun(undefined, { CI: "true" })).toThrow(/CI/);
  });
});
