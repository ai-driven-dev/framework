import { describe, expect, it } from "vitest";
import { printNativeActivation } from "../../../../src/presentation/presenters/setup/restore.presenter.js";
import { CapturingOutput } from "../../../shared/testing/capturing-output.fake.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

describe("printing a native activation", () => {
  it("prints nothing when every tool's CLI ran", () => {
    const output = new CapturingOutput(false);

    printNativeActivation(output, []);

    expect(output.lines).toEqual([]);
  });

  it("names each tool and binary whose CLI was not on PATH, and what that means for the plugin", () => {
    const output = new CapturingOutput(false);

    printNativeActivation(output, [
      { toolId: SYNTHETIC_TOOL, binary: "claude" },
      { toolId: SECOND_SYNTHETIC_TOOL, binary: "codex" },
    ]);

    expect(output.lines).toEqual([
      "synthetic: the plugin will not load until the claude CLI has run.",
      "syntheticb: the plugin will not load until the codex CLI has run.",
    ]);
  });
});
