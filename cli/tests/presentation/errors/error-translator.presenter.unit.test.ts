import { beforeEach, describe, expect, it } from "vitest";
import { failCommand } from "../../../src/presentation/errors/error-translator.presenter.js";
import {
  AuthenticationError,
  InputRequiredError,
} from "../../../src/shared/domain/shared.error.js";
import { CapturingOutput, ExitRequested } from "../../shared/testing/capturing-output.fake.js";

describe("failing a command on an error", () => {
  let output: CapturingOutput;

  /** Asserts the failure ran to the exit it promises, and hands the test the rest. */
  function failing(error: unknown): void {
    expect(() => failCommand(output, error)).toThrow(new ExitRequested(1));
  }

  beforeEach(() => {
    output = new CapturingOutput(false);
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
