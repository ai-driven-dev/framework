import { describe, expect, it } from "vitest";
import { TaskNameMissingError } from "../../../../src/shared/domain/errors/task-name-missing-error.js";

describe("TaskNameMissingError", () => {
  it("says exactly what went wrong", () => {
    const error = new TaskNameMissingError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "TaskNameMissingError",
      message:
        "A task needs a name: aidd telemetry task <name> [--ticket <ref>], or --none. See what the work is bound to with aidd telemetry status.",
    });
  });

  it("carries its stable code", () => {
    expect(new TaskNameMissingError().code).toBe("task-name-missing");
  });
});
