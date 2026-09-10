import { describe, expect, it } from "vitest";
import { flatHooksPathWithLoaderEntry } from "../../../src/kernel/materialization/flat-paths.js";

describe("flatHooksPathWithLoaderEntry", () => {
  it("strips only a leading hooks/ segment, never one deeper in the path", () => {
    expect(
      flatHooksPathWithLoaderEntry(".opencode/hooks/", null, "aidd-dev", "scripts/hooks/x.js")
    ).toBe(".opencode/hooks/aidd-dev/scripts/hooks/x.js");
  });
});
