import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failCommand } from "../../../src/presentation/errors/error-translator.js";
import { AuthenticationError, InputRequiredError } from "../../../src/shared/domain/errors.js";
import { CapturingOutput } from "../../shared/testing/capturing-output.js";

/**
 * `process.exit` returns `never`, and so does `failCommand`: a double that returns
 * normally lets a test walk through code the real process would never reach.
 */
class ProcessExited extends Error {
  constructor(readonly code: number | string | null | undefined) {
    super(`process.exit(${String(code)})`);
  }
}

describe("failCommand", () => {
  let output: CapturingOutput;

  /** Asserts the failure ran to the exit it promises, and hands the test the rest. */
  function failing(error: unknown): void {
    expect(() => failCommand(output, error)).toThrow(ProcessExited);
    expect(process.exit).toHaveBeenCalledWith(1);
  }

  beforeEach(() => {
    output = new CapturingOutput(false);
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ProcessExited(code);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes AuthenticationError message to output.error", () => {
    failing(new AuthenticationError("HTTP 401"));

    expect(output.at("error")).toEqual([
      expect.stringContaining("Authentication failed (HTTP 401)"),
    ]);
  });

  it("routes InputRequiredError message to output.error", () => {
    failing(new InputRequiredError("--tools flag is required"));

    expect(output.at("error")).toEqual(["--tools flag is required"]);
  });

  it("falls back to error.message for unknown Error subclasses", () => {
    failing(new Error("unexpected failure"));

    expect(output.at("error")).toEqual(["unexpected failure"]);
  });

  it("falls back to String(value) for non-Error values", () => {
    failing("raw string error");

    expect(output.at("error")).toEqual(["raw string error"]);
  });

  it("falls back to String(value) for numeric values", () => {
    failing(42);

    expect(output.at("error")).toEqual(["42"]);
  });
});
