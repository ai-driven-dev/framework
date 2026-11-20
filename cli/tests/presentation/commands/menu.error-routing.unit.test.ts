import { afterEach, describe, expect, it, vi } from "vitest";
import { routeMenuError } from "../../../src/presentation/commands/menu.js";
import { CapturingOutput } from "../../shared/testing/capturing-output.fake.js";

/** Makes the `never` return observable: both routing branches call process.exit. */
class ProcessExited extends Error {
  constructor(readonly code: number) {
    super(`process.exit(${code})`);
  }
}

function exitCodeOf(route: () => never): number {
  try {
    route();
  } catch (error) {
    if (error instanceof ProcessExited) return error.code;
    throw error;
  }
  throw new Error("the route returned instead of exiting");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("routeMenuError", () => {
  function stubExit() {
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ProcessExited(typeof code === "number" ? code : 0);
    });
  }

  it("exits 0 without reporting when the user aborts a prompt (Ctrl-C)", () => {
    stubExit();
    const output = new CapturingOutput(false);
    const abort = Object.assign(new Error("prompt aborted"), { name: "ExitPromptError" });

    expect(exitCodeOf(() => routeMenuError(abort, output))).toBe(0);
    expect(output.at("error")).toEqual([]);
  });

  it("reports any other error and exits 1 instead of swallowing it", () => {
    stubExit();
    const output = new CapturingOutput(false);

    expect(exitCodeOf(() => routeMenuError(new Error("manifest is corrupt"), output))).toBe(1);
    expect(output.at("error")).toEqual(["manifest is corrupt"]);
  });

  it("reports non-Error throws too, rather than treating them as an abort", () => {
    stubExit();
    const output = new CapturingOutput(false);

    expect(exitCodeOf(() => routeMenuError("boom", output))).toBe(1);
    expect(output.at("error")).toEqual(["boom"]);
  });

  it("does not treat a same-message Error as an abort, only the ExitPromptError name", () => {
    stubExit();
    const output = new CapturingOutput(false);

    expect(exitCodeOf(() => routeMenuError(new Error("ExitPromptError"), output))).toBe(1);
    expect(output.at("error")).toEqual(["ExitPromptError"]);
  });
});
