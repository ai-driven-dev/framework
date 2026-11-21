import { describe, expect, it } from "vitest";
import { routeMenuError } from "../../../src/presentation/commands/menu.js";
import { CapturingOutput, ExitRequested } from "../../shared/testing/capturing-output.fake.js";

function exitCodeOf(route: () => never): number {
  try {
    route();
  } catch (error) {
    if (error instanceof ExitRequested) return error.code;
    throw error;
  }
  throw new Error("the route returned instead of exiting");
}

describe("routeMenuError", () => {
  it("exits 0 without reporting when the user aborts a prompt (Ctrl-C)", () => {
    const output = new CapturingOutput(false);
    const abort = Object.assign(new Error("prompt aborted"), { name: "ExitPromptError" });

    expect(exitCodeOf(() => routeMenuError(abort, output))).toBe(0);
    expect(output.at("error")).toEqual([]);
  });

  it("reports any other error and exits 1 instead of swallowing it", () => {
    const output = new CapturingOutput(false);

    expect(exitCodeOf(() => routeMenuError(new Error("manifest is corrupt"), output))).toBe(1);
    expect(output.at("error")).toEqual(["manifest is corrupt"]);
  });

  it("reports non-Error throws too, rather than treating them as an abort", () => {
    const output = new CapturingOutput(false);

    expect(exitCodeOf(() => routeMenuError("boom", output))).toBe(1);
    expect(output.at("error")).toEqual(["boom"]);
  });

  it("does not treat a same-message Error as an abort, only the ExitPromptError name", () => {
    const output = new CapturingOutput(false);

    expect(exitCodeOf(() => routeMenuError(new Error("ExitPromptError"), output))).toBe(1);
    expect(output.at("error")).toEqual(["ExitPromptError"]);
  });
});
